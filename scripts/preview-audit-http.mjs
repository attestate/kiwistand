#!/usr/bin/env node
// @format
//
// Link preview audit over the public HTTP API, for machines without the
// production DB (e.g. GitHub Actions): takes the stories the site serves,
// scores the preview production shows today ("before"), refetches each link
// with this checkout's parser ("after") and reports what changed.
//
//   node scripts/preview-audit-http.mjs --pages 10
//
// Options:
//   --api <url>        site to read stories from (default https://news.kiwistand.com)
//   --pages <n>        pages of /api/v1/feeds/best per period (default 10)
//   --concurrency <n>  parallel fetches (default 4)
//   --timeout <ms>     give up on a single URL after this long (default 30000)
//   --out <prefix>     also write <prefix>.json and <prefix>.md
//
// The parser's caches go to a throwaway temp dir, so every link is fetched
// fresh. The report is printed to stdout.
import { env } from "process";
import path from "path";
import os from "os";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { parseArgs } from "util";

const { values: args } = parseArgs({
  options: {
    api: { type: "string", default: "https://news.kiwistand.com" },
    pages: { type: "string", default: "10" },
    concurrency: { type: "string", default: "4" },
    timeout: { type: "string", default: "30000" },
    out: { type: "string" },
  },
});
const pages = parseInt(args.pages, 10);
const concurrency = parseInt(args.concurrency, 10);
const timeout = parseInt(args.timeout, 10);

const tmp = mkdtempSync(path.join(os.tmpdir(), "preview-audit-http-"));
env.CACHE_DIR = tmp;
const { metadata } = await import("../src/parser.mjs");
const { hostOf, withTimeout, score } = await import("./preview-score.mjs");

async function feed(name, query = {}) {
  const url = new URL(`/api/v1/feeds/${name}`, args.api);
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  try {
    const response = await fetch(url);
    const body = await response.json();
    return body?.data?.stories || [];
  } catch (err) {
    console.error(`[preview-audit-http] ${url}: ${err.message}`);
    return [];
  }
}

// Stories with the metadata production currently stores for them.
const lists = [await feed("hot"), await feed("new")];
for (const period of ["year", "all"]) {
  for (let page = 0; page < pages; page++) {
    lists.push(await feed("best", { period, page, domain: "" }));
  }
}
const stories = new Map();
for (const story of lists.flat()) {
  if (!/^https?:\/\//.test(story.href || "")) continue;
  if (!stories.has(story.href)) stories.set(story.href, story);
}
const links = [...stories.values()];
console.error(`[preview-audit-http] ${links.length} links`);

async function audit(story) {
  const before = score(story.href, story.metadata || {});
  let after;
  let error;
  try {
    after = score(story.href, (await withTimeout(metadata(story.href), timeout)) || {});
  } catch (err) {
    error = err?.message || String(err);
  }
  return { href: story.href, host: hostOf(story.href), before, after, error };
}

const results = [];
let next = 0;
async function worker() {
  while (next < links.length) {
    results.push(await audit(links[next++]));
    if (results.length % 50 === 0) {
      console.error(`[preview-audit-http] ${results.length}/${links.length}`);
    }
  }
}
await Promise.allSettled(Array.from({ length: concurrency }, worker));
rmSync(tmp, { recursive: true, force: true });

// NOTE: Casts and Bluesky posts need API keys the audit machine may not
// have, so links that are embeds in production aren't compared.
const compared = results.filter((r) => !r.before.embed);
const total = results.length;
const pct = (n, of) => (of ? ((n / of) * 100).toFixed(1) : "0.0");
const goodBefore = results.filter((r) => r.before.good).length;
const goodAfter = results.filter((r) => (r.before.embed ? r.before.good : r.after?.good)).length;
const improved = compared.filter((r) => !r.before.good && r.after?.good);
const regressed = compared.filter((r) => r.before.good && !r.after?.good);

const byHost = new Map();
for (const r of results) {
  const entry = byHost.get(r.host) || { host: r.host, total: 0, before: 0, after: 0, examples: [] };
  entry.total++;
  if (r.before.good) entry.before++;
  if (r.before.embed ? r.before.good : r.after?.good) entry.after++;
  if (!r.before.good && entry.examples.length < 3) entry.examples.push(r.href);
  byHost.set(r.host, entry);
}
const worst = [...byHost.values()]
  .filter((h) => h.total - h.after > 0)
  .sort((a, b) => b.total - b.after - (a.total - a.after))
  .slice(0, 30);

const failureCounts = {};
for (const r of compared) {
  for (const failure of r.after?.failures || ["error"]) {
    failureCounts[failure] = (failureCounts[failure] || 0) + 1;
  }
}

const line = (r) =>
  `- ${r.href}${r.error ? ` (error: ${r.error})` : ` (after: ${(r.after?.failures || []).join(", ") || "good"})`}`;
const report = [
  `# Preview audit (HTTP) — ${new Date().toISOString().slice(0, 10)}`,
  "",
  `Links: ${total} (compared with a fresh fetch: ${compared.length}; embeds kept as in production)`,
  "",
  `| | good previews |`,
  `|---|---|`,
  `| production (before) | ${goodBefore} (${pct(goodBefore, total)}%) |`,
  `| this parser (after) | ${goodAfter} (${pct(goodAfter, total)}%) |`,
  "",
  `Improved: ${improved.length} · Regressed: ${regressed.length}`,
  "",
  "## Failure classes after (non-embeds)",
  "",
  ...Object.entries(failureCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([failure, n]) => `- ${failure}: ${n}`),
  "",
  "## Domains with the most links without a good preview (after)",
  "",
  "| domain | links | good before | good after | examples (bad before) |",
  "|---|---|---|---|---|",
  ...worst.map((h) => `| ${h.host} | ${h.total} | ${h.before} | ${h.after} | ${h.examples.join("<br>")} |`),
  "",
  "## Regressed",
  "",
  ...(regressed.length ? regressed.map(line) : ["none"]),
  "",
  "## Improved",
  "",
  ...(improved.length ? improved.map(line) : ["none"]),
  "",
].join("\n");

console.log(report);
if (args.out) {
  writeFileSync(`${args.out}.md`, report);
  writeFileSync(`${args.out}.json`, JSON.stringify(results, null, 2));
}
// The parser keeps cache handles open; nothing else is pending here.
process.exit(0);
