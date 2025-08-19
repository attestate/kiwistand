import { env } from "process";
import path from "path";
import fs from "fs";

import webpush from "web-push";
import Database from "better-sqlite3";

import log from "./logger.mjs";
import { getSubmission } from "./cache.mjs";
import { resolve } from "./ens.mjs";
import * as email from "./email.mjs";
import { truncateComment } from "./views/activity.mjs";
import { getSlug } from "./utils.mjs";
import { sendNotification, getFidsFromAddresses } from "./neynar.mjs";
import * as moderation from "./views/moderation.mjs";

if (env.NODE_ENV == "production")
  webpush.setVapidDetails(
    "mailto:tim@daubenschuetz.de",
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );

const DATA_DIR = env.DATA_DIR;
const DB_FILE = path.join(DATA_DIR, "web_push_subscriptions.db");

const db = new Database(DB_FILE);

db.exec(`
   CREATE TABLE IF NOT EXISTS subscriptions (
     address TEXT PRIMARY KEY,
     subscription JSON
   )
 `);
try {
  db.exec(`
    PRAGMA foreign_keys=off;
    CREATE TABLE subscriptions_temp AS SELECT * FROM subscriptions;
    DROP TABLE subscriptions;
    CREATE TABLE subscriptions (
      address TEXT,
      subscription JSON
    );
    INSERT INTO subscriptions SELECT address, subscription FROM subscriptions_temp;
    DROP TABLE subscriptions_temp;
    PRAGMA foreign_keys=on;
  `);
} catch (err) {
  // Migration already completed or temp table exists
  if (!err.message.includes('already exists')) {
    throw err;
  }
}

db.exec(`
    CREATE INDEX IF NOT EXISTS idx_address_subscription ON subscriptions (address,
 subscription)
  `);

export async function triggerUpvoteNotification(message) {
  if (message.type !== "amplify") return;

  try {
    // Get the submission that was upvoted
    const submission = getSubmission(null, message.href);
    if (!submission || !submission.identity) return;

    // Don't notify if the upvoter is the author
    if (message.identity === submission.identity) return;

    // Get upvoter's display name
    const ensData = await resolve(message.identity);
    if (!ensData.displayName) return;

    // Filter out banned users from receiving notifications
    let receivers = [submission.identity];
    try {
      const policy = await moderation.getLists();
      const bannedAddresses = policy.addresses || [];
      receivers = receivers.filter(
        receiver => !bannedAddresses.includes(receiver.toLowerCase())
      );
    } catch (err) {
      log(`Failed to get banned addresses for upvote notification filtering: ${err}`);
    }

    if (receivers.length === 0) return;

    const slug = getSlug(submission.title);
    const url = `https://news.kiwistand.com/stories/${slug}?index=0x${submission.index}`;

    // Get FID for Neynar notification
    let targetFids = [];
    try {
      targetFids = await getFidsFromAddresses(receivers);
    } catch (err) {
      log(`Failed to get FIDs for upvote Neynar notifications: ${err}`);
    }

    // Send Neynar notification if we have FID (production only)
    if (targetFids.length > 0 && env.NODE_ENV === "production") {
      try {
        const fcTitle = "New upvote"; // Max 32 chars
        const fcBody = `${ensData.displayName} upvoted: ${submission.title.substring(0, 128 - ensData.displayName.length - 11)}`; // Max 128 chars total
        
        await sendNotification(
          url,
          fcBody,
          fcTitle,
          targetFids
        );
        log(`Sent upvote Neynar notification to FID ${targetFids[0]}`);
      } catch (err) {
        log(`Failed to send upvote Neynar notification: ${err}`);
      }
    }
  } catch (err) {
    log(`Error in triggerUpvoteNotification: ${err}`);
  }
}

export async function triggerNotification(message) {
  if (message.type !== "comment") return;

  const [_, index] = message.href.split("kiwi:");
  const submission = getSubmission(index);

  const ensData = await resolve(message.identity);
  if (!ensData.displayName) return;

  const receivers = [
    submission.identity,
    ...submission.comments.map((comment) => comment.identity),
  ].filter((receiver) => receiver !== message.identity);
  let uniqueReceivers = Array.from(new Set(receivers));

  // Filter out banned users from receiving notifications
  try {
    const policy = await moderation.getLists();
    const bannedAddresses = policy.addresses || [];
    uniqueReceivers = uniqueReceivers.filter(
      receiver => !bannedAddresses.includes(receiver.toLowerCase())
    );
  } catch (err) {
    log(`Failed to get banned addresses for notification filtering: ${err}`);
    // Continue with unfiltered list if moderation fails
  }

  const maxChars = 140;
  const slug = getSlug(submission.title);
  const url = `https://news.kiwistand.com/stories/${slug}?index=0x${submission.index}#0x${message.index}`;

  // Get FIDs for Neynar notifications
  let targetFids = [];
  try {
    targetFids = await getFidsFromAddresses(uniqueReceivers);
  } catch (err) {
    log(`Failed to get FIDs for Neynar notifications: ${err}`);
  }

  // Send Neynar notifications if we have FIDs (production only)
  if (targetFids.length > 0 && env.NODE_ENV === "production") {
    try {
      const fcTitle = "New comment"; // Max 32 chars
      const fcBody = `${ensData.displayName}: ${truncateComment(message.title, 128 - ensData.displayName.length - 2)}`; // Max 128 chars total
      
      await sendNotification(
        url,
        fcBody,
        fcTitle,
        targetFids
      );
      log(`Sent Neynar notifications to ${targetFids.length} FIDs`);
    } catch (err) {
      log(`Failed to send Neynar notifications: ${err}`);
    }
  }

  await Promise.allSettled(
    uniqueReceivers.map(async (receiver) => {
      await send(receiver, {
        title: `${ensData.displayName} replied`,
        message: truncateComment(message.title, maxChars),
        data: {
          url,
        },
      });
      await email.send(receiver, {
        sender: ensData.displayName,
        title: `New comment in: ${submission.title}`,
        message: message.title,
        data: { url },
      });
    }),
  );
}

export function store(address, subscription) {
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO subscriptions (address, subscription) VALUES (?, ?)",
  );
  stmt.run(address, JSON.stringify(subscription));
}

export function remove(address, subscription) {
  const endpoint = subscription.endpoint;
  const stmt = db.prepare(
    "DELETE FROM subscriptions WHERE address = ? AND subscription LIKE ?",
  );
  // Using a LIKE clause to match the endpoint URL directly, which should work if the URL is unique.
  const likePattern = `%${endpoint}%`;
  stmt.run(address, likePattern);
}

export function get(address) {
  const stmt = db.prepare(
    "SELECT subscription FROM subscriptions WHERE address = ?",
  );
  const rows = stmt.all(address);
  return rows.map((row) => JSON.parse(row.subscription));
}

export async function send(address, payload) {
  if (env.NODE_ENV !== "production") return;

  const subscriptions = get(address);
  if (!subscriptions || subscriptions.length === 0) return;

  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        return await webpush.sendNotification(
          subscription,
          JSON.stringify(payload),
        );
      } catch (error) {
        log(
          `Error sending a notification to "${address}", err "${error.toString()}"`,
        );
        remove(address, subscription);
      }
    }),
  );
}
