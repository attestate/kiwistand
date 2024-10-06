import { env } from "process";
import path from "path";
import fs from "fs";

import webpush from "web-push";
import Database from "better-sqlite3";

import log from "./logger.mjs";
import { getSubmission } from "./cache.mjs";
import { resolve } from "./ens.mjs";
import { truncateComment } from "./views/activity.mjs";

if (env.NODE_ENV == "production")
  webpush.setVapidDetails(
    "mailto:tim@daubenschuetz.de",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );

const DATA_DIR = process.env.DATA_DIR;
const DB_FILE = path.join(DATA_DIR, "web_push_subscriptions.db");

const db = new Database(DB_FILE);

db.exec(`
   CREATE TABLE IF NOT EXISTS subscriptions (
     address TEXT PRIMARY KEY,
     subscription JSON
   )
 `);
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

db.exec(`
    CREATE INDEX IF NOT EXISTS idx_address_subscription ON subscriptions (address,
 subscription)
  `);

export async function triggerNotification(message) {
  if (message.type !== "comment") return;

  const [_, index] = message.href.split("kiwi:");
  const submission = await getSubmission(index);

  const ensData = await resolve(message.identity);
  if (!ensData.displayName) return;

  const receivers = [
    submission.identity,
    ...submission.comments.map((comment) => comment.identity),
  ].filter((receiver) => receiver !== message.identity);
  const uniqueReceivers = Array.from(new Set(receivers));

  const maxChars = 140;
  await Promise.allSettled(
    uniqueReceivers.map(
      async (receiver) =>
        await send(receiver, {
          title: `${ensData.displayName} replied`,
          message: truncateComment(message.title, maxChars),
          data: {
            url: `https://news.kiwistand.com/stories?index=0x${submission.index}&cachebuster=0x${message.index}#0x${message.index}`,
          },
        }),
    ),
  );
}

export function store(address, subscription) {
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO subscriptions (address, subscription) VALUES (?, ?)",
  );
  stmt.run(address, JSON.stringify(subscription));
}

export function get(address) {
  const stmt = db.prepare(
    "SELECT subscription FROM subscriptions WHERE address = ?",
  );
  const rows = stmt.all(address);
  return rows.map((row) => JSON.parse(row.subscription));
}

export async function send(address, payload) {
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
          `Error sending a notification to "${address}", err "${err.toString()}"`,
        );
      }
    }),
  );
}
