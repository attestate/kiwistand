// @format
import { join } from "path";
import Database from "better-sqlite3";
import { utils } from "ethers";
import { eligible } from "@attestate/delegator2";

import log from "./logger.mjs";
import { verify, ecrecover, toDigest } from "./id.mjs";
import { EIP712_MESSAGE } from "./constants.mjs";
import * as registry from "./chainstate/registry.mjs";

// Initialize SQLite database
const dbPath = join(process.env.CACHE_DIR || "./cache", "interactions.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// Create tables if they don't exist
// Note: user_identity is the custody address (NFT holder), resolved from the signer via delegator2
db.exec(`
  CREATE TABLE IF NOT EXISTS impressions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL,
    user_identity TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    signature TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    UNIQUE(content_id, user_identity)
  );

  CREATE TABLE IF NOT EXISTS clicks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL,
    user_identity TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    signature TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_impressions_user ON impressions(user_identity);
  CREATE INDEX IF NOT EXISTS idx_impressions_content ON impressions(content_id);
  CREATE INDEX IF NOT EXISTS idx_impressions_timestamp ON impressions(timestamp);
  CREATE INDEX IF NOT EXISTS idx_clicks_user ON clicks(user_identity);
  CREATE INDEX IF NOT EXISTS idx_clicks_content ON clicks(content_id);
  CREATE INDEX IF NOT EXISTS idx_clicks_timestamp ON clicks(timestamp);
`);

// Prepare statements for better performance
const statements = {
  insertImpression: db.prepare(`
    INSERT OR IGNORE INTO impressions (content_id, content_type, user_identity, timestamp, signature)
    VALUES (?, ?, ?, ?, ?)
  `),
  
  insertClick: db.prepare(`
    INSERT INTO clicks (content_id, content_type, user_identity, timestamp, signature)
    VALUES (?, ?, ?, ?, ?)
  `),
  
  getUserImpressions: db.prepare(`
    SELECT content_id, content_type, timestamp, signature
    FROM impressions
    WHERE user_identity = ?
    ORDER BY timestamp DESC
  `),
  
  getUserClicks: db.prepare(`
    SELECT content_id, content_type, timestamp, signature
    FROM clicks
    WHERE user_identity = ?
    ORDER BY timestamp DESC
  `),
  
  getContentImpressions: db.prepare(`
    SELECT user_identity, timestamp
    FROM impressions
    WHERE content_id = ?
    ORDER BY timestamp DESC
  `),
  
  getContentClicks: db.prepare(`
    SELECT user_identity, timestamp
    FROM clicks
    WHERE content_id = ?
    ORDER BY timestamp DESC
  `),
  
  getImpressionsSince: db.prepare(`
    SELECT content_id, content_type, user_identity, timestamp, signature
    FROM impressions
    WHERE timestamp > ?
    ORDER BY timestamp DESC
  `),
  
  getClicksSince: db.prepare(`
    SELECT content_id, content_type, user_identity, timestamp, signature
    FROM clicks
    WHERE timestamp > ?
    ORDER BY timestamp DESC
  `)
};

// Verify and extract user identity (custody address) from interaction message and signature
export async function verifyInteraction(message, signature) {
  try {
    // Validate message structure
    if (!message || !message.timestamp || !message.title || !message.href || !message.type) {
      throw new Error("Invalid message structure");
    }
    
    // Check timestamp is recent (within last hour) to prevent replay attacks
    const now = Math.floor(Date.now() / 1000);
    const oneHourAgo = now - 3600;
    if (message.timestamp < oneHourAgo || message.timestamp > now + 60) {
      throw new Error("Message timestamp is too old or in the future");
    }
    
    // Use ecrecover directly to get the signer address
    // (verify() only accepts "amplify" and "comment" types)
    const signerAddress = ecrecover({ ...message, signature }, EIP712_MESSAGE);
    if (!signerAddress) {
      throw new Error("Invalid signature");
    }
    
    // Get the allowlist and delegations
    const allowlist = await registry.allowlist();
    const delegations = await registry.delegations();
    
    // Resolve to the identity (custody address) using delegator2
    // This handles both direct custody keys and delegate keys
    const identity = eligible(allowlist, delegations, signerAddress);
    
    if (!identity) {
      throw new Error(`Address "${signerAddress}" is not eligible (not in allowlist or delegations)`);
    }
    
    // Return the identity (custody address), not the signer
    return identity.toLowerCase();
  } catch (error) {
    log(`Error verifying interaction: ${error.message}`);
    return null;
  }
}

// Record an impression (idempotent - first view wins)
export async function recordImpression(contentId, contentType, message, signature) {
  try {
    const userIdentity = await verifyInteraction(message, signature);
    if (!userIdentity) {
      throw new Error("Failed to verify signature or resolve identity");
    }

    // Verify the message content matches what we're recording
    if (message.href !== contentId) {
      throw new Error("Content ID mismatch - signed message doesn't match submission");
    }
    
    if (message.type !== "impression") {
      throw new Error("Invalid interaction type for impression");
    }
    
    // Verify contentType is in the title
    if (!message.title.includes(contentType)) {
      throw new Error("Content type mismatch");
    }

    const result = statements.insertImpression.run(
      contentId,
      contentType,
      userIdentity,
      message.timestamp,
      signature
    );

    if (result.changes > 0) {
      log(`Recorded impression for ${contentId} by ${userIdentity}`);
    } else {
      log(`Impression already exists for ${contentId} by ${userIdentity}`);
    }

    return { success: true, userIdentity };
  } catch (error) {
    log(`Error recording impression: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Record a click (always appends)
export async function recordClick(contentId, contentType, message, signature) {
  try {
    const userIdentity = await verifyInteraction(message, signature);
    if (!userIdentity) {
      throw new Error("Failed to verify signature or resolve identity");
    }

    // Verify the message content matches what we're recording
    if (message.href !== contentId) {
      throw new Error("Content ID mismatch - signed message doesn't match submission");
    }
    
    if (message.type !== "click") {
      throw new Error("Invalid interaction type for click");
    }
    
    // Verify contentType is in the title
    if (!message.title.includes(contentType)) {
      throw new Error("Content type mismatch");
    }

    const result = statements.insertClick.run(
      contentId,
      contentType,
      userIdentity,
      message.timestamp,
      signature
    );

    log(`Recorded click for ${contentId} by ${userIdentity}`);
    return { success: true, userIdentity };
  } catch (error) {
    log(`Error recording click: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Batch record multiple interactions
export async function recordBatch(impressions = [], clicks = []) {
  const results = {
    impressions: { success: 0, failed: 0 },
    clicks: { success: 0, failed: 0 }
  };

  try {
    // Process impressions
    for (const impression of impressions) {
      const { contentId, contentType, message, signature } = impression;
      const result = await recordImpression(contentId, contentType, message, signature);
      if (result.success) {
        results.impressions.success++;
      } else {
        results.impressions.failed++;
      }
    }

    // Process clicks
    for (const click of clicks) {
      const { contentId, contentType, message, signature } = click;
      const result = await recordClick(contentId, contentType, message, signature);
      if (result.success) {
        results.clicks.success++;
      } else {
        results.clicks.failed++;
      }
    }

    log(`Batch processed: ${results.impressions.success} impressions, ${results.clicks.success} clicks`);
    return { success: true, results };
  } catch (error) {
    log(`Error in batch recording: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Get all interactions for a user (for sync)
// Note: userIdentity should be the custody address (NFT holder), not the delegate
export function getUserInteractions(userIdentity) {
  try {
    const normalizedIdentity = userIdentity.toLowerCase();
    
    // Limit to last 5 days to keep sync payload small
    const fiveDaysAgo = Math.floor(Date.now() / 1000) - (5 * 24 * 60 * 60);
    
    // Need to create new prepared statements for filtered queries
    const getUserImpressionsLimited = db.prepare(`
      SELECT content_id, content_type, timestamp, signature
      FROM impressions
      WHERE user_identity = ? AND timestamp > ?
      ORDER BY timestamp DESC
    `);
    
    const getUserClicksLimited = db.prepare(`
      SELECT content_id, content_type, timestamp, signature
      FROM clicks
      WHERE user_identity = ? AND timestamp > ?
      ORDER BY timestamp DESC
    `);
    
    const impressions = getUserImpressionsLimited.all(normalizedIdentity, fiveDaysAgo);
    const clicks = getUserClicksLimited.all(normalizedIdentity, fiveDaysAgo);

    return {
      impressions,
      clicks,
      totalImpressions: impressions.length,
      totalClicks: clicks.length
    };
  } catch (error) {
    log(`Error getting user interactions: ${error.message}`);
    return {
      impressions: [],
      clicks: [],
      totalImpressions: 0,
      totalClicks: 0
    };
  }
}


// Get recent interactions (for analytics)
export function getRecentInteractions(since) {
  try {
    const timestamp = since || Math.floor(Date.now() / 1000) - 86400; // Default to last 24 hours
    
    const impressions = statements.getImpressionsSince.all(timestamp);
    const clicks = statements.getClicksSince.all(timestamp);

    return {
      impressions,
      clicks
    };
  } catch (error) {
    log(`Error getting recent interactions: ${error.message}`);
    return {
      impressions: [],
      clicks: []
    };
  }
}

// Clean up old interactions (optional maintenance)
export function cleanupOldInteractions(daysToKeep = 90) {
  try {
    const cutoffTime = Math.floor(Date.now() / 1000) - (daysToKeep * 86400);
    
    const deleteOldImpressions = db.prepare(`
      DELETE FROM impressions WHERE timestamp < ?
    `);
    
    const deleteOldClicks = db.prepare(`
      DELETE FROM clicks WHERE timestamp < ?
    `);
    
    const impressionsDeleted = deleteOldImpressions.run(cutoffTime).changes;
    const clicksDeleted = deleteOldClicks.run(cutoffTime).changes;
    
    log(`Cleaned up ${impressionsDeleted} old impressions and ${clicksDeleted} old clicks`);
    
    return {
      impressionsDeleted,
      clicksDeleted
    };
  } catch (error) {
    log(`Error cleaning up old interactions: ${error.message}`);
    return {
      impressionsDeleted: 0,
      clicksDeleted: 0
    };
  }
}

export default {
  recordImpression,
  recordClick,
  recordBatch,
  getUserInteractions,
  getRecentInteractions,
  cleanupOldInteractions
};