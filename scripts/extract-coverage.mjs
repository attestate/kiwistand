// Measures how many submissions get enough article text for a story summary
// (src/summaries.mjs only calls Claude when extraction returns at least
// SUMMARY_MIN_CHARS). Re-runs extractArticleCached for every href in a JSONL
// dataset (one {id, href, domain, kind} object per line) and prints aggregate
// numbers only, never article text:
//
//   node scripts/extract-coverage.mjs path/to/dataset.jsonl [--json out.json]
//
// --json writes per-story outcomes (id, kind, domain, chars, error) for
// diffing two runs. Casts need NEYNAR_API_KEY and are reported separately.
import { readFileSync, writeFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : null;
if (!file) {
  console.error("usage: node scripts/extract-coverage.mjs dataset.jsonl [--json out.json]");
  process.exit(1);
}

// parser.mjs opens its fetch cache in CACHE_DIR at import time.
process.env.CACHE_DIR = mkdtempSync(join(tmpdir(), "extract-coverage-"));
const { extractArticleCached } = await import("../src/lib/listen/extract.mjs");
const { summaryInput } = await import("../src/parser.mjs");
// jsdom reports every stylesheet it can't parse; that's noise here.
console.error = () => {};

const CONCURRENCY = 4;
const TIMEOUT = 30_000;

const rows = readFileSync(file, "utf8")
  .split("\n")
  .filter((line) => line.trim())
  .map((line) => JSON.parse(line));

async function run(row) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Timed out after 30s")), TIMEOUT);
  });
  try {
    const article = await Promise.race([extractArticleCached(row.href), timeout]);
    const input = summaryInput(article?.plainText);
    return {
      chars: article?.plainText?.length || 0,
      ok: !!input,
      error: input ? null : `Too short for a summary (${article?.plainText?.length || 0} chars)`,
    };
  } catch (err) {
    return { chars: 0, ok: false, error: String(err?.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

const results = new Array(rows.length);
let next = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < rows.length) {
      const i = next++;
      const row = rows[i];
      const host = (() => {
        try {
          return new URL(row.href).hostname;
        } catch {
          return row.domain || "?";
        }
      })();
      results[i] = { id: row.id, kind: row.kind || "?", domain: host, ...(await run(row)) };
    }
  }),
);

// Normalizes an error so similar ones group together.
function reason(error) {
  return error
    .replace(/\(\d+ chars[^)]*\)/g, "(N chars)")
    .replace(/\(og:type is "[^"]*"\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

const casts = results.filter((r) => r.kind === "cast");
const counted = results.filter((r) => r.kind !== "cast");
const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : "-");
const ok = (list) => list.filter((r) => r.ok).length;

console.log(`Dataset: ${rows.length} stories`);
console.log(
  `Reach >= summary minimum: ${ok(results)}/${results.length} overall, ` +
    `${ok(counted)}/${counted.length} (${pct(ok(counted), counted.length)}) excluding casts, ` +
    `casts ${ok(casts)}/${casts.length} (need NEYNAR_API_KEY)`,
);

console.log("\nBy kind:");
const kinds = [...new Set(results.map((r) => r.kind))].sort();
for (const kind of kinds) {
  const list = results.filter((r) => r.kind === kind);
  console.log(`  ${kind.padEnd(8)} ${String(ok(list)).padStart(3)}/${String(list.length).padEnd(3)} ${pct(ok(list), list.length)}`);
}

const failures = counted.filter((r) => !r.ok);
const byReason = new Map();
for (const r of failures) {
  const key = reason(r.error);
  byReason.set(key, (byReason.get(key) || 0) + 1);
}
console.log("\nTop failure reasons (excluding casts):");
for (const [key, n] of [...byReason].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  ${String(n).padStart(3)}  ${key}`);
}

console.log("\nFailures by domain (excluding casts):");
const byDomain = new Map();
for (const r of failures) {
  if (!byDomain.has(r.domain)) byDomain.set(r.domain, []);
  byDomain.get(r.domain).push(r);
}
for (const [domain, list] of [...byDomain].sort((a, b) => b[1].length - a[1].length)) {
  const reasons = [...new Set(list.map((r) => reason(r.error)))].join("; ");
  console.log(`  ${String(list.length).padStart(3)}  ${domain}: ${reasons}`);
}

if (jsonOut) {
  writeFileSync(jsonOut, JSON.stringify(results, null, 2));
}
process.exit(0);
