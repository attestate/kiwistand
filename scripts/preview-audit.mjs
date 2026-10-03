#!/usr/bin/env node
// @format
//
// Link preview audit: refetches Open Graph metadata for recent submissions
// with the same parser the site uses (src/parser.mjs `metadata`) and reports
// how many stories get a good preview, broken down by domain and failure.
//
// Usage (from the repo root on the server, so .env and cache/ are found):
//
//   node scripts/preview-audit.mjs --days 180 --limit 2000
//
// Options:
//   --days <n>         look back n days of submissions (default 180)
//   --limit <n>        audit at most n submissions, newest first (default: all)
//   --concurrency <n>  parallel fetches (default 4)
//   --delay <ms>       pause per worker between URLs (default 250)
//   --timeout <ms>     give up on a single URL after this long (default 30000)
//   --out <prefix>     output path prefix (default ./preview-audit-<date>),
//                      writes <prefix>.json and <prefix>.md
//
// Safety: the submissions DB is opened read-only. The parser normally reads
// and writes its metadata cache and HTTP fetch cache in CACHE_DIR; before
// importing it we point CACHE_DIR at a throwaway temp directory, so every URL
// is refetched fresh and nothing in the production cache is touched. The temp
// directory is deleted at the end. No titles are generated (no Claude calls).
import "dotenv/config";
import { env } from "process";
import path from "path";
import os from "os";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { parseArgs } from "util";
import { setTimeout as sleep } from "timers/promises";

import Database from "better-sqlite3";

const { values: args } = parseArgs({
  options: {
    days: { type: "string", default: "180" },
    limit: { type: "string" },
    concurrency: { type: "string", default: "4" },
    delay: { type: "string", default: "250" },
    timeout: { type: "string", default: "30000" },
    out: { type: "string" },
  },
});
const days = parseInt(args.days, 10);
const limit = args.limit ? parseInt(args.limit, 10) : -1;
const concurrency = parseInt(args.concurrency, 10);
const delay = parseInt(args.delay, 10);
const timeout = parseInt(args.timeout, 10);
const date = new Date().toISOString().slice(0, 10);
const out = args.out || path.resolve(`preview-audit-${date}`);

// Read submissions read-only from the app's DB before swapping CACHE_DIR.
const dbPath = path.join(path.resolve(env.CACHE_DIR || "cache"), "database.db");
const db = new Database(dbPath, { readonly: true, fileMustExist: true });
const since = Math.floor(Date.now() / 1000) - days * 86400;
const submissions = db
  .prepare(
    `SELECT href, title, timestamp FROM submissions
     WHERE timestamp >= ? AND href NOT LIKE 'data:%' AND href NOT LIKE 'kiwi:%'
     ORDER BY timestamp DESC LIMIT ?`,
  )
  .all(since, limit);
db.close();

const tmp = mkdtempSync(path.join(os.tmpdir(), "preview-audit-"));
env.CACHE_DIR = tmp;
const { metadata, isGenericTitle, twitterFrontends } = await import(
  "../src/parser.mjs"
);

function hostOf(href) {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "invalid-url";
  }
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    sleep(ms).then(() => {
      throw new Error(`Audit timeout after ${ms}ms`);
    }),
  ]);
}

function score(href, data) {
  const host = hostOf(href);
  const isTweet = twitterFrontends.includes(host) || host === "firefly.social";
  const embed = Boolean(
    data.farcasterCast ||
      data.blueskyPost ||
      data.isXArticle ||
      (isTweet && data.ogDescription),
  );
  const title = Boolean(data.ogTitle) && !isGenericTitle(data.ogTitle, host);
  const image = Boolean(data.image);
  const description = Boolean(data.ogDescription);
  const cloudflare = Boolean(data.isCloudflareChallenge);
  const good = embed || (image && !cloudflare);

  const failures = [];
  if (cloudflare) failures.push("cloudflare");
  if (!embed && !title) failures.push("no_title");
  if (!embed && !image) failures.push("no_image");
  if (!embed && !description) failures.push("no_description");
  return { good, embed, title, image, description, cloudflare, failures };
}

async function audit(submission) {
  const { href, title, timestamp } = submission;
  const base = { href, submittedTitle: title, timestamp, host: hostOf(href) };
  let data;
  try {
    data = await withTimeout(metadata(href), timeout);
  } catch (err) {
    return {
      ...base,
      good: false,
      error: err?.message || String(err),
      failures: ["error"],
    };
  }
  return { ...base, ...score(href, data || {}), metadata: data };
}

const results = [];
let next = 0;
async function worker() {
  while (next < submissions.length) {
    const submission = submissions[next++];
    results.push(await audit(submission));
    if (results.length % 50 === 0) {
      console.error(`[preview-audit] ${results.length}/${submissions.length}`);
    }
    await sleep(delay);
  }
}
console.error(`[preview-audit] auditing ${submissions.length} submissions`);
await Promise.allSettled(Array.from({ length: concurrency }, worker));

const total = results.length;
const pct = (n) => (total ? ((n / total) * 100).toFixed(1) : "0.0");
const count = (key) => results.filter((r) => r[key]).length;

const failureClasses = {};
const domains = {};
for (const r of results) {
  domains[r.host] ??= { total: 0, failing: 0, failures: {}, examples: [] };
  const d = domains[r.host];
  d.total++;
  for (const f of r.failures) {
    failureClasses[f] = (failureClasses[f] || 0) + 1;
    d.failures[f] = (d.failures[f] || 0) + 1;
  }
  if (r.good) continue;
  d.failing++;
  if (d.examples.length < 3) d.examples.push(r.error ? `${r.href} (${r.error})` : r.href);
}

const summary = {
  date,
  days,
  total,
  good: count("good"),
  embed: count("embed"),
  title: count("title"),
  image: count("image"),
  description: count("description"),
  cloudflare: count("cloudflare"),
  errors: results.filter((r) => r.error).length,
  failureClasses,
};
const failingDomains = Object.entries(domains)
  .filter(([, d]) => d.failing > 0)
  .sort(([, a], [, b]) => b.failing - a.failing);

writeFileSync(
  `${out}.json`,
  JSON.stringify({ summary, domains, results }, null, 2),
);

const lines = [
  `# Link preview audit ${date}`,
  "",
  `Submissions of the last ${days} days: ${total}`,
  "",
  `**Overall score: ${pct(summary.good)}%** (embed, or image without Cloudflare challenge)`,
  "",
  "| Metric | Count | % |",
  "| --- | --- | --- |",
  ...["good", "embed", "title", "image", "description", "cloudflare", "errors"].map(
    (key) => `| ${key} | ${summary[key]} | ${pct(summary[key])} |`,
  ),
  "",
  "## Failure classes",
  "",
  "| Class | Count |",
  "| --- | --- |",
  ...Object.entries(failureClasses)
    .sort(([, a], [, b]) => b - a)
    .map(([name, n]) => `| ${name} | ${n} |`),
  "",
  "## Top failing domains",
  "",
  ...failingDomains.slice(0, 30).flatMap(([host, d]) => [
    `### ${host} (${d.failing}/${d.total} failing)`,
    "",
    Object.entries(d.failures)
      .map(([name, n]) => `${name}: ${n}`)
      .join(", "),
    "",
    ...d.examples.map((href) => `- ${href}`),
    "",
  ]),
];
writeFileSync(`${out}.md`, lines.join("\n"));

rmSync(tmp, { recursive: true, force: true });
console.error(`[preview-audit] wrote ${out}.md and ${out}.json`);
process.exit(0);
