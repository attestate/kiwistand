// @format
// Limits for /api/v1/image-upload-token, which hands out Cloudflare Images
// upload URLs that Kiwi pays for.
//
// A request is a Kiwi message signed like the ones in bookmarks.mjs:
//
//   { type: "image-upload", href: "", title: "", timestamp }
//
// Accounts with at least KARMA karma get TRUSTED uploads per rolling day,
// everyone else (e.g. a new passkey account picking its picture during
// onboarding) gets NEWCOMER. Any fresh key counts as its own account, so all
// newcomers together are also held to NEWCOMER_POOL, which keeps throwaway
// keys from using up the DAILY_LIMIT that applies to everyone.
import { join } from "path";
import Database from "better-sqlite3";

export const TYPE = "image-upload";
export const WINDOW = 24 * 60 * 60;
export const KARMA = 5;
export const TRUSTED = 20;
export const NEWCOMER = 3;
export const NEWCOMER_POOL = 100;
export const DAILY_LIMIT =
  parseInt(process.env.IMAGE_UPLOAD_DAILY_LIMIT, 10) || 500;

let db;
function open() {
  if (db) return db;
  db = new Database(
    join(process.env.CACHE_DIR || "./cache", "imageuploads.db"),
  );
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS uploads (
      id INTEGER PRIMARY KEY,
      identity TEXT NOT NULL,
      newcomer INTEGER NOT NULL,
      timestamp INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_uploads_time ON uploads(timestamp);
    CREATE INDEX IF NOT EXISTS idx_uploads_identity_time
      ON uploads(identity, timestamp);
  `);
  return db;
}

function limited(message) {
  const err = new Error(message);
  err.status = 429;
  return err;
}

const count = (where, ...params) =>
  open().prepare(`SELECT COUNT(*) AS n FROM uploads WHERE ${where}`).get(
    ...params,
  ).n;

// NOTE: Counts and records in one IMMEDIATE transaction, as all HTTP workers
// share the file. Returns the row's id for release, throws with status 429.
export function take(identity, karma, now = Math.floor(Date.now() / 1000)) {
  const newcomer = karma < KARMA;
  const run = open().transaction(() => {
    db.prepare(`DELETE FROM uploads WHERE timestamp <= ?`).run(now - WINDOW);
    if (count("1") >= DAILY_LIMIT) {
      throw limited("Kiwi's daily image upload limit is reached, try tomorrow");
    }
    const allowance = newcomer ? NEWCOMER : TRUSTED;
    if (count("identity = ?", identity) >= allowance) {
      throw limited(`You can upload up to ${allowance} images a day`);
    }
    if (newcomer && count("newcomer = 1") >= NEWCOMER_POOL) {
      throw limited("Too many image uploads today, try tomorrow");
    }
    return db
      .prepare(
        `INSERT INTO uploads (identity, newcomer, timestamp) VALUES (?, ?, ?)`,
      )
      .run(identity, newcomer ? 1 : 0, now).lastInsertRowid;
  });
  return run.immediate();
}

// Gives the upload back when Cloudflare didn't hand out a URL.
export function release(id) {
  open().prepare(`DELETE FROM uploads WHERE id = ?`).run(id);
}
