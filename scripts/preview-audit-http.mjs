#!/usr/bin/env node
// @format
//
// Link preview audit over the public HTTP API, for machines without the
// production DB (e.g. GitHub Actions): takes the stories the site serves,
// refetches each link with this checkout's parser ("after") and, with
// --baseline, with another checkout's parser ("base", e.g. main) on the same
// machine, and reports what changed.
//
//   node scripts/preview-audit-http.mjs --pages 10 --baseline ../base
//
// Compare base vs. after, not production vs. after: production fetched from
// its own IP, and sites like Substack challenge datacenter IPs (GitHub
// runners), so production vs. after mixes parser changes with blocking.
// Production's stored preview is still shown for reference.
//
// Options:
//   --api <url>        site to read stories from (default https://news.kiwistand.com)
//   --pages <n>        pages of /api/v1/feeds/best per period (default 10)
//   --concurrency <n>  parallel fetches (default 4)
//   --timeout <ms>     give up on a single URL after this long (default 30000)
//   --out <prefix>     also write <prefix>.json and <prefix>.md
//   --baseline <dir>   checkout whose src/parser.mjs is the "base" parser
//
// The parser's caches go to a throwaway temp dir, so every link is fetched
// fresh. The report is printed to stdout.
import { env } from "process";
import path from "path";
import os from "os";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { pathToFileURL } from "url";
import { parseArgs } from "util";

const { values: args } = parseArgs({
  options: {
    api: { type: "string", default: "https://news.kiwistand.com" },
    pages: { type: "string", default: "10" },
    concurrency: { type: "string", default: "4" },
    timeout: { type: "string", default: "30000" },
    out: { type: "string" },
    baseline: { type: "string" },
  },
});
const pages = parseInt(args.pages, 10);
const concurrency = parseInt(args.concurrency, 10);
const timeout = parseInt(args.timeout, 10);

// Each parser gets its own empty cache dir, so neither reads the other's
// (or production's) cached metadata. The parser and its cache read
// CACHE_DIR at import time.
const tmp = mkdtempSync(path.join(os.tmpdir(), "preview-audit-http-"));
async function loadParser(file, name) {
  env.CACHE_DIR = path.join(tmp, name);
  mkdirSync(env.CACHE_DIR, { recursive: true });
  return (await import(pathToFileURL(file).href)).metadata;
}
const metadata = await loadParser(path.resolve("src/parser.mjs"), "after");
const baseMetadata = args.baseline
  ? await loadParser(path.resolve(args.baseline, "src/parser.mjs"), "base")
  : null;
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

async function fetchScore(parse, href) {
  try {
    return { result: score(href, (await withTimeout(parse(href), timeout)) || {}) };
  } catch (err) {
    return { error: err?.message || String(err) };
  }
}

async function audit(story) {
  const production = score(story.href, story.metadata || {});
  const after = await fetchScore(metadata, story.href);
  const base = baseMetadata ? await fetchScore(baseMetadata, story.href) : null;
  return {
    href: story.href,
    host: hostOf(story.href),
    production,
    // Without --baseline, production stands in for the base parser.
    before: base ? base.result : production,
    beforeError: base?.error,
    after: after.result,
    error: after.error,
  };
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
const isEmbed = (r) => r.production.embed;
const good = (s) => Boolean(s?.good);
// Blocked here: a challenge page or a fetch error with both parsers, so the
// link says nothing about the parser (production may still have a preview).
const blocked = (r) =>
  !isEmbed(r) &&
  !good(r.after) &&
  !good(r.before) &&
  (r.after?.cloudflare || r.error) &&
  (r.before?.cloudflare || r.beforeError || !args.baseline);
const compared = results.filter((r) => !isEmbed(r));
const total = results.length;
const pct = (n, of) => (of ? ((n / of) * 100).toFixed(1) : "0.0");
const count = (pick) => results.filter((r) => (isEmbed(r) ? r.production.good : good(pick(r)))).length;
const goodProduction = results.filter((r) => r.production.good).length;
const goodBefore = count((r) => r.before);
const goodAfter = count((r) => r.after);
const improved = compared.filter((r) => !good(r.before) && good(r.after));
const regressed = compared.filter((r) => good(r.before) && !good(r.after));
const blockedHere = compared.filter(blocked);

const byHost = new Map();
for (const r of results) {
  const entry = byHost.get(r.host) || { host: r.host, total: 0, production: 0, before: 0, after: 0, blocked: 0 };
  entry.total++;
  if (r.production.good) entry.production++;
  if (isEmbed(r) ? r.production.good : good(r.before)) entry.before++;
  if (isEmbed(r) ? r.production.good : good(r.after)) entry.after++;
  if (blocked(r)) entry.blocked++;
  byHost.set(r.host, entry);
}
// Hosts where the parser itself falls short: bad after, not blocked here.
const worst = [...byHost.values()]
  .map((h) => ({ ...h, bad: h.total - h.after - h.blocked }))
  .filter((h) => h.bad > 0)
  .sort((a, b) => b.bad - a.bad)
  .slice(0, 30);
const blockedHosts = [...byHost.values()]
  .filter((h) => h.blocked > 0)
  .sort((a, b) => b.blocked - a.blocked);

const failureCounts = {};
for (const r of compared.filter((r) => !blocked(r))) {
  for (const failure of r.after?.failures || ["error"]) {
    failureCounts[failure] = (failureCounts[failure] || 0) + 1;
  }
}

const reason = (s, error) => (error ? `error: ${error}` : (s?.failures || []).join(", ") || "good");
const line = (r) => `- ${r.href} (base: ${reason(r.before, r.beforeError)} → after: ${reason(r.after, r.error)})`;
const stillBad = compared.filter((r) => !good(r.after) && !blocked(r));
const report = [
  `# Preview audit (HTTP) — ${new Date().toISOString().slice(0, 10)}`,
  "",
  `Links: ${total} (compared with a fresh fetch: ${compared.length}; embeds kept as in production)`,
  "",
  `| | good previews |`,
  `|---|---|`,
  `| production (stored) | ${goodProduction} (${pct(goodProduction, total)}%) |`,
  ...(args.baseline ? [`| base parser, fetched here | ${goodBefore} (${pct(goodBefore, total)}%) |`] : []),
  `| this parser, fetched here | ${goodAfter} (${pct(goodAfter, total)}%) |`,
  "",
  `${args.baseline ? "Base → this parser" : "Production → this parser"}: improved ${improved.length} · regressed ${regressed.length}`,
  `Blocked on this machine (challenge or error with both): ${blockedHere.length}`,
  "",
  "## Failure classes after (non-embeds, not blocked)",
  "",
  ...Object.entries(failureCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([failure, n]) => `- ${failure}: ${n}`),
  "",
  "## Domains with the most bad previews after (not blocked)",
  "",
  "| domain | links | good in production | good base | good after | blocked here |",
  "|---|---|---|---|---|---|",
  ...worst.map((h) => `| ${h.host} | ${h.total} | ${h.production} | ${h.before} | ${h.after} | ${h.blocked} |`),
  "",
  "## Regressed",
  "",
  ...(regressed.length ? regressed.map(line) : ["none"]),
  "",
  "## Improved",
  "",
  ...(improved.length ? improved.map(line) : ["none"]),
  "",
  "## Still bad after (not blocked)",
  "",
  ...(stillBad.length ? stillBad.map(line) : ["none"]),
  "",
  "## Blocked on this machine, by domain",
  "",
  ...(blockedHosts.length
    ? blockedHosts.map((h) => `- ${h.host}: ${h.blocked} (good in production: ${h.production}/${h.total})`)
    : ["none"]),
  "",
].join("\n");

console.log(report);
if (args.out) {
  writeFileSync(`${args.out}.md`, report);
  writeFileSync(`${args.out}.json`, JSON.stringify(results, null, 2));
}
// The parser keeps cache handles open; nothing else is pending here.
process.exit(0);
