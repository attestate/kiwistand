//@format
import "dotenv/config";
import { env } from "process";
import path from "path";
import Database from "better-sqlite3";
import log from "./logger.mjs";

// Database setup
const DB_FILE = path.join(env.DATA_DIR, "fid_labels.db");
const db = new Database(DB_FILE);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS fid_labels (
    fid INTEGER PRIMARY KEY,
    labels TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );
  CREATE INDEX IF NOT EXISTS idx_fid_labels_created_at ON fid_labels(created_at);
`);

// Core database functions
export function storeLabels(fid, labels) {
  const stmt = db.prepare("INSERT OR REPLACE INTO fid_labels (fid, labels) VALUES (?, ?)");
  stmt.run(fid, JSON.stringify(labels));
}

export function isLabeled(fid) {
  const stmt = db.prepare("SELECT 1 FROM fid_labels WHERE fid = ? LIMIT 1");
  return !!stmt.get(fid);
}

export function getLabeledCount() {
  const stmt = db.prepare("SELECT COUNT(*) as count FROM fid_labels");
  return stmt.get().count;
}

// Main labeling function
export async function labelNewFids() {
  const NEYNAR_API_KEY = env.NEYNAR_API_KEY;
  const MBD_API_KEY = env.MBD_API_KEY;
  
  if (!NEYNAR_API_KEY || !MBD_API_KEY) {
    throw new Error("Missing required API keys: NEYNAR_API_KEY and MBD_API_KEY");
  }
  
  log("Starting FID labeling process...");
  log(`Using MBD API key: ${MBD_API_KEY ? MBD_API_KEY.substring(0, 10) + '...' : 'NOT SET'}`);
  
  // 1. Fetch all notification tokens from Neynar
  const tokens = [];
  let cursor = null;
  
  do {
    const url = new URL("https://api.neynar.com/v2/farcaster/frame/notification_tokens/");
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);
    
    const response = await fetch(url, {
      headers: {
        "x-api-key": NEYNAR_API_KEY,
        "accept": "application/json"
      }
    });
    
    if (!response.ok) {
      throw new Error(`Neynar API error: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.notification_tokens) {
      tokens.push(...data.notification_tokens);
    }
    cursor = data.next?.cursor;
  } while (cursor);
  
  log(`Fetched ${tokens.length} notification tokens`);
  
  // 2. Extract unique FIDs that need labeling
  const fidSet = new Set();
  for (const token of tokens) {
    if (token.fid && token.status === "enabled" && !isLabeled(token.fid)) {
      fidSet.add(token.fid);
    }
  }
  
  const unlabeledFids = Array.from(fidSet);
  log(`Found ${unlabeledFids.length} FIDs to label`);
  
  if (unlabeledFids.length === 0) {
    log("All FIDs already labeled!");
    return { processed: 0, total: 0 };
  }
  
  // 3. Label FIDs in batches
  const BATCH_SIZE = 50;
  const RATE_LIMIT_DELAY = 200; // 5 requests per second
  let processed = 0;
  
  for (let i = 0; i < unlabeledFids.length; i += BATCH_SIZE) {
    const batch = unlabeledFids.slice(i, i + BATCH_SIZE);
    log(`Processing batch with FIDs: ${batch.slice(0, 5).join(", ")}${batch.length > 5 ? "..." : ""}`);
    
    try {
      const response = await fetch("https://api.mbd.xyz/v2/farcaster/users/labels/for-users", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "authorization": `Bearer ${MBD_API_KEY}`,
          "content-type": "application/json",
          "HTTP-Referer": "https://docs.mbd.xyz/",
          "X-Title": "mbd_docs"
        },
        body: JSON.stringify({
          users_list: batch.map(fid => fid.toString()),
          label_category: "topics"
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        log(`MBD API error for batch: ${response.status} - ${errorText}`);
        continue;
      }
      
      const result = await response.json();
      
      if (result.status_code === 200 && result.body) {
        for (const userLabel of result.body) {
          storeLabels(parseInt(userLabel.user_id), userLabel);
          processed++;
        }
        log(`Successfully labeled ${result.body.length} FIDs in this batch`);
      } else {
        log(`Unexpected response structure: ${JSON.stringify(result).substring(0, 200)}`);
      }
      
      log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(unlabeledFids.length / BATCH_SIZE)}`);
      
      // Rate limiting
      if (i + BATCH_SIZE < unlabeledFids.length) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      }
      
    } catch (err) {
      log(`Error processing batch: ${err.message}`);
    }
  }
  
  log(`Labeling complete: ${processed}/${unlabeledFids.length} FIDs labeled`);
  return { processed, total: unlabeledFids.length };
}

// Get FIDs by topics
export function getFidsByTopics(topics) {
  if (!topics || topics.length === 0) {
    return [];
  }
  
  const placeholders = topics.map(() => '?').join(' OR ');
  const query = `
    SELECT DISTINCT fid 
    FROM fid_labels 
    WHERE ${topics.map(() => `json_extract(labels, '$.labels.topics') LIKE ?`).join(' OR ')}
  `;
  
  const stmt = db.prepare(query);
  const params = topics.map(topic => `%"${topic}"%`);
  const results = stmt.all(...params);
  
  return results.map(row => row.fid);
}


// If running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  labelNewFids()
    .then(result => {
      log(`Done! Processed ${result.processed} FIDs`);
      process.exit(0);
    })
    .catch(err => {
      log(`Error: ${err.message}`);
      process.exit(1);
    });
}