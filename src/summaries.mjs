// @format
// Short AI summaries of the article a story links to. A story page alone is
// thin (a title, a byline, a few comments), so the summary gives readers and
// crawlers unique text about what's behind the link.
//
// Each story is summarized once and stored by its index. Failures are stored
// too (summary NULL) so they don't retry on every page view, but they retry
// after RETRY_AFTER. A failed Claude request (rate limit, outage) isn't
// stored: generation pauses for PAUSE_AFTER_ERROR and the story is retried on
// a later view. Rendering never waits on Claude: getSummary() only reads the
// store and scheduleSummary() generates in the background.
import { join } from "path";
import { env } from "process";
import Database from "better-sqlite3";

import log from "./logger.mjs";
import { isCloudflareImage } from "./utils.mjs";
import { generateStorySummary } from "./parser.mjs";
import { extractArticleCached } from "./lib/listen/extract.mjs";

export const RETRY_AFTER = 7 * 24 * 60 * 60 * 1000;
export const PAUSE_AFTER_ERROR = 10 * 60 * 1000;
// Crawlers can open hundreds of old, unsummarized stories in a row; each job
// fetches an article and calls Claude, so only a few run at a time and the
// rest are picked up on a later view.
export const MAX_JOBS = 2;

let db;
function open() {
  if (db) return db;
  db = new Database(join(env.CACHE_DIR || "./cache", "summaries.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS summaries (
      story_index TEXT PRIMARY KEY,
      summary TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  return db;
}

// Story pages pass the index without 0x, /stories/context with it.
function key(index) {
  return String(index).toLowerCase().replace(/^0x/, "");
}

// Text posts (data:), kiwi: references and image uploads have no article.
export function isSummarizable(href) {
  return (
    typeof href === "string" &&
    /^https?:\/\//.test(href) &&
    !isCloudflareImage(href)
  );
}

export function read(index) {
  const row = open()
    .prepare(
      `SELECT summary, created_at AS createdAt FROM summaries WHERE story_index = ?`,
    )
    .get(key(index));
  return row || null;
}

export function write(index, summary, now = Date.now()) {
  open()
    .prepare(
      `INSERT OR REPLACE INTO summaries (story_index, summary, created_at) VALUES (?, ?, ?)`,
    )
    .run(key(index), summary || null, now);
}

// Used while rendering, so a broken store only hides the summary.
export function getSummary(index) {
  try {
    return read(index)?.summary || null;
  } catch (err) {
    log(`Reading story summary for ${key(index)} failed: ${err}`);
    return null;
  }
}

export function needsSummary(index, now = Date.now()) {
  const row = read(index);
  if (!row) return true;
  return !row.summary && now - row.createdAt > RETRY_AFTER;
}

// Concurrent page views of the same story share one generation per process.
const inflight = new Map();
let pausedUntil = 0;

// For tests.
export function resetPause() {
  pausedUntil = 0;
}

// Starts generating a summary if the story has none (or its last attempt
// failed long enough ago). Returns the pending promise, or null when there's
// nothing to do. Never throws.
export function scheduleSummary(index, title, href, deps = {}) {
  if (!env.ANTHROPIC_API_KEY || !isSummarizable(href)) return null;
  const k = key(index);
  if (inflight.has(k)) return inflight.get(k);
  if (inflight.size >= MAX_JOBS || Date.now() < pausedUntil) return null;
  try {
    if (!needsSummary(k)) return null;
  } catch (err) {
    log(`Reading story summary for ${k} failed: ${err}`);
    return null;
  }

  const { extract = extractArticleCached, summarize = generateStorySummary } =
    deps;
  const job = (async () => {
    let article;
    try {
      article = await extract(href);
    } catch (err) {
      log(`Story summary for ${k} failed: ${err.message || err}`);
    }
    let summary = null;
    try {
      summary = await summarize(title, article?.plainText);
    } catch (err) {
      log(`Story summary for ${k} paused: ${err.message || err}`);
      pausedUntil = Date.now() + PAUSE_AFTER_ERROR;
      return null;
    }
    try {
      write(k, summary);
    } catch (err) {
      log(`Storing story summary for ${k} failed: ${err}`);
    }
    return summary;
  })().finally(() => inflight.delete(k));
  inflight.set(k, job);
  return job;
}
