// @format
// Saved stories ("bookmarks"), private to each account.
//
// Every request is an EIP-712 Kiwi message, the same format as upvotes and
// comments, signed by the account or by its delegated device key (so the iOS
// app saves without a wallet prompt). The signer resolves to the account
// through the delegations, like impressions in interactions.mjs.
//
//   save:    { type: "bookmark",   href: "kiwi:0x<story index>", title: "", timestamp }
//   unsave:  { type: "unbookmark", href: "kiwi:0x<story index>", title: "", timestamp }
//   list:    { type: "bookmarks",  href: "", title: "", timestamp }
//
// A message is only accepted within MAX_AGE of its timestamp, so a leaked
// list request can't be replayed later to read someone's saved stories.
import { join } from "path";
import Database from "better-sqlite3";
import { resolveIdentity } from "@attestate/delegator2";

import { ecrecover } from "./id.mjs";
import { EIP712_MESSAGE } from "./constants.mjs";
import * as registry from "./chainstate/registry.mjs";

export const MAX_AGE = 5 * 60;
const MAX_FUTURE = 60;
export const LIMIT = 500;
const INDEX = /^0x[0-9a-f]{72}$/;

let db;
function open() {
  if (db) return db;
  db = new Database(join(process.env.CACHE_DIR || "./cache", "bookmarks.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      identity TEXT NOT NULL,
      story_index TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      signature TEXT NOT NULL,
      PRIMARY KEY (identity, story_index)
    );
    CREATE INDEX IF NOT EXISTS idx_bookmarks_identity_time
      ON bookmarks(identity, timestamp DESC);
  `);
  return db;
}

// Throws with a message meant for the client when the request isn't valid.
export async function verify(message, types, now = Math.floor(Date.now() / 1000)) {
  if (
    !message ||
    typeof message.type !== "string" ||
    typeof message.href !== "string" ||
    typeof message.title !== "string" ||
    typeof message.signature !== "string" ||
    !Number.isInteger(message.timestamp)
  ) {
    throw new Error("Invalid message");
  }
  if (!types.includes(message.type)) throw new Error("Invalid message type");
  if (message.timestamp < now - MAX_AGE || message.timestamp > now + MAX_FUTURE) {
    throw new Error("Message expired, sign it again");
  }
  let signer;
  try {
    signer = ecrecover(message, EIP712_MESSAGE);
  } catch {
    signer = null;
  }
  if (!signer) throw new Error("Invalid signature");
  const identity = resolveIdentity(await registry.delegations(), signer);
  if (!identity) throw new Error("Signer isn't linked to an account");
  return identity.toLowerCase();
}

export function storyIndex(href) {
  const index = href.startsWith("kiwi:") ? href.slice(5).toLowerCase() : "";
  if (!INDEX.test(index)) throw new Error("href must be kiwi:0x<story index>");
  return index;
}

export function save(identity, index, message) {
  const db = open();
  const saved = db
    .prepare(`SELECT 1 FROM bookmarks WHERE identity = ? AND story_index = ?`)
    .get(identity, index);
  if (saved) return;
  const { n } = db
    .prepare(`SELECT COUNT(*) AS n FROM bookmarks WHERE identity = ?`)
    .get(identity);
  if (n >= LIMIT) throw new Error(`You can save up to ${LIMIT} stories`);
  db.prepare(
    `INSERT INTO bookmarks (identity, story_index, timestamp, signature)
     VALUES (?, ?, ?, ?)`,
  ).run(identity, index, message.timestamp, message.signature);
}

export function remove(identity, index) {
  open()
    .prepare(`DELETE FROM bookmarks WHERE identity = ? AND story_index = ?`)
    .run(identity, index);
}

// Newest first.
export function list(identity) {
  return open()
    .prepare(
      `SELECT story_index AS "index", timestamp FROM bookmarks
       WHERE identity = ? ORDER BY timestamp DESC`,
    )
    .all(identity);
}
