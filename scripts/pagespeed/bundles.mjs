// Bundle size budgets for the client code and stylesheets.
//
// Reads the vite build (src/public/.vite/manifest.json and src/public/assets,
// so run `cd src/web && npx vite build` first) and measures every chunk
// gzipped (budgets) and brotli-compressed (shown for reference):
//
// - eager: the entry (src/main.jsx) and every chunk it imports statically.
//   Every page downloads and parses these before anything is interactive,
//   so each has its own budget, and a new eager chunk without a budget fails
//   the check: add one to bundle-budgets.json if it is on purpose.
// - lazy: chunks loaded with import(). The app's own components and the
//   bigger dependencies have their own budgets, everything else counts
//   towards "lazy total".
// - css: news.css, fonts/inter.css and the stylesheets vite emits.
//
// Chunk filenames contain a content hash, so chunks are matched by a stable
// name: the source path for modules (src/Vote.jsx), otherwise the chunk's name
// (wallet-vendor). Shared chunks with the same name (vite calls many of them
// "index") are summed up as one.
//
// Budgets are gzip bytes in bundle-budgets.json. When a chunk gets smaller on
// purpose, lower its budget so it can't quietly grow back. To print the
// current sizes as budgets with headroom: UPDATE_BUDGETS=1 (writes the file).
//
// Other env: PUBLIC_DIR (default src/public), SUMMARY_FILE appends the
// markdown report (GitHub sets GITHUB_STEP_SUMMARY). PAGE_ASSETS is a JSON
// file written by check.mjs ({ page: { device: [asset paths] } }): then the
// JS each page type loads initially is checked against "pages" too.
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const publicDir = path.resolve(root, process.env.PUBLIC_DIR || "src/public");
const budgetsPath = path.join(here, "bundle-budgets.json");
const budgets = JSON.parse(fs.readFileSync(budgetsPath, "utf8"));
const manifest = JSON.parse(
  fs.readFileSync(path.join(publicDir, ".vite", "manifest.json"), "utf8"),
);
const ENTRY = "src/main.jsx";
// NOTE: Lazy chunks smaller than this go into "lazy total" instead of
// getting a budget each (rainbowkit's locales and wallet icons, ...).
const LAZY_MIN = 10 * 1024;

const sizeCache = new Map();
function sizes(file) {
  if (sizeCache.has(file)) return sizeCache.get(file);
  const buf = fs.readFileSync(path.join(publicDir, file));
  const result = {
    raw: buf.length,
    gzip: zlib.gzipSync(buf, { level: 9 }).length,
    brotli: zlib.brotliCompressSync(buf, {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
    }).length,
  };
  sizeCache.set(file, result);
  return result;
}
const sum = (list) =>
  list.reduce(
    (a, s) => ({
      raw: a.raw + s.raw,
      gzip: a.gzip + s.gzip,
      brotli: a.brotli + s.brotli,
    }),
    { raw: 0, gzip: 0, brotli: 0 },
  );

function stableName(key) {
  const chunk = manifest[key];
  if (chunk.src) return chunk.src;
  return chunk.name || key.replace(/^_/, "").replace(/-[\w-]{8}\.\w+$/, "");
}

// The entry and its static imports, recursively.
const eagerKeys = new Set();
(function walk(key) {
  if (eagerKeys.has(key) || !manifest[key]) return;
  eagerKeys.add(key);
  for (const dep of manifest[key].imports || []) walk(dep);
})(ENTRY);

const eagerFiles = new Set([...eagerKeys].map((k) => manifest[k].file));
const groups = { eager: new Map(), lazy: new Map(), css: new Map() };
function add(kind, name, file) {
  const group = groups[kind].get(name) || new Set();
  group.add(file);
  groups[kind].set(name, group);
}
for (const [key, chunk] of Object.entries(manifest)) {
  if (!chunk.file) continue;
  if (chunk.file.endsWith(".css")) {
    add("css", stableName(key), chunk.file);
  } else if (eagerKeys.has(key)) {
    add("eager", stableName(key), chunk.file);
  } else if (!eagerFiles.has(chunk.file)) {
    add("lazy", stableName(key), chunk.file);
  }
  for (const css of chunk.css || []) add("css", `${stableName(key)} (css)`, css);
}
for (const file of ["news.css", "fonts/inter.css"]) {
  if (fs.existsSync(path.join(publicDir, file))) add("css", file, file);
}

const rows = [];
const failures = [];
const notes = [];
const kb = (n) => (n / 1024).toFixed(1);
function check(kind, name, files, budget, { required }) {
  const s = sum([...files].map(sizes));
  let status = "";
  if (budget === undefined) {
    if (required) {
      failures.push(
        `${kind} ${name}: new chunk (${kb(s.gzip)} KB gzip) has no budget in bundle-budgets.json`,
      );
      status = "❌ no budget";
    } else {
      status = "no budget";
    }
  } else if (s.gzip > budget) {
    failures.push(
      `${kind} ${name}: ${kb(s.gzip)} KB gzip > budget ${kb(budget)} KB (+${(((s.gzip - budget) / budget) * 100).toFixed(1)}%)`,
    );
    status = "❌ over";
  }
  rows.push({ kind, name, files: files.size, ...s, budget, status });
  return s;
}

// Eager chunks: each budgeted, a new one fails.
const eagerSizes = [];
for (const [name, files] of [...groups.eager].sort()) {
  eagerSizes.push(
    check("eager", name, files, budgets.eager?.[name], { required: true }),
  );
}
const eagerTotal = sum(eagerSizes);
const eagerTotalFiles = new Set([...groups.eager.values()].flatMap((s) => [...s]));
check("eager", "eager total", eagerTotalFiles, budgets.totals?.eager, {
  required: true,
});

// Lazy chunks: the app's own modules and big ones budgeted, the rest summed.
const restFiles = new Set();
for (const [name, files] of [...groups.lazy].sort()) {
  const s = sum([...files].map(sizes));
  const own = name.startsWith("src/");
  const budget = budgets.lazy?.[name];
  if (own || s.gzip >= LAZY_MIN || budget !== undefined) {
    check("lazy", name, files, budget, { required: false });
    if (budget === undefined) {
      notes.push(`lazy ${name} (${kb(s.gzip)} KB gzip) has no budget yet`);
    }
  } else {
    for (const f of files) restFiles.add(f);
  }
}
for (const name of Object.keys(budgets.lazy || {})) {
  if (!groups.lazy.has(name)) notes.push(`lazy ${name} is gone, its budget can be removed`);
}
check("lazy", `other lazy chunks`, restFiles, budgets.totals?.lazyOther, {
  required: true,
});
const allLazyFiles = new Set([...groups.lazy.values()].flatMap((s) => [...s]));
check("lazy", "lazy total", allLazyFiles, budgets.totals?.lazy, {
  required: true,
});

// Stylesheets.
for (const [name, files] of [...groups.css].sort()) {
  check("css", name, files, budgets.css?.[name], { required: true });
}

// JS a page type loads before it settles, as recorded by check.mjs.
if (process.env.PAGE_ASSETS) {
  const pages = JSON.parse(fs.readFileSync(process.env.PAGE_ASSETS, "utf8"));
  for (const [page, devices] of Object.entries(pages)) {
    for (const [device, assets] of Object.entries(devices)) {
      const files = new Set(
        assets.filter((a) => a.endsWith(".js") && fs.existsSync(path.join(publicDir, a))),
      );
      const name = `${page} (${device})`;
      check("page", name, files, budgets.pages?.[page]?.[device], {
        required: false,
      });
    }
  }
}

if (process.env.UPDATE_BUDGETS) {
  // NOTE: 7% headroom, so the check passes today but catches real growth.
  const headroom = (n) => Math.ceil((n * 1.07) / 100) * 100;
  const next = { ...budgets, eager: {}, lazy: {}, css: {}, totals: {} };
  if (budgets.pages || process.env.PAGE_ASSETS) next.pages = { ...budgets.pages };
  for (const r of rows) {
    if (r.kind === "page") {
      const [, page, device] = /^(.*) \((\w+)\)$/.exec(r.name);
      next.pages[page] = { ...next.pages[page], [device]: headroom(r.gzip) };
    } else if (r.name === "eager total") next.totals.eager = headroom(r.gzip);
    else if (r.name === "lazy total") next.totals.lazy = headroom(r.gzip);
    else if (r.name === "other lazy chunks") next.totals.lazyOther = headroom(r.gzip);
    else next[r.kind][r.name] = headroom(r.gzip);
  }
  fs.writeFileSync(budgetsPath, JSON.stringify(next, null, 2) + "\n");
  console.log(`Wrote ${path.relative(root, budgetsPath)}`);
}

const report = [
  "## Bundle sizes",
  "",
  "| Kind | Chunk | Files | Raw KB | Gzip KB | Brotli KB | Budget KB (gzip) | |",
  "|---|---|---|---|---|---|---|---|",
  ...rows.map(
    (r) =>
      `| ${r.kind} | ${r.name} | ${r.files} | ${kb(r.raw)} | ${kb(r.gzip)} | ${kb(r.brotli)} | ${r.budget === undefined ? "" : kb(r.budget)} | ${r.status} |`,
  ),
  "",
  `Every page loads the eager chunks: ${kb(eagerTotal.gzip)} KB gzip, ${kb(eagerTotal.brotli)} KB brotli. Budgets are in scripts/pagespeed/bundle-budgets.json.`,
  "",
];
if (notes.length) report.push("Notes:", "", ...notes.map((n) => `- ${n}`), "");
if (failures.length) report.push("## Failed", "", ...failures.map((f) => `- ${f}`), "");

console.log(report.join("\n"));
const summary = process.env.SUMMARY_FILE || process.env.GITHUB_STEP_SUMMARY;
if (summary) fs.appendFileSync(summary, report.join("\n") + "\n");

if (failures.length && !process.env.UPDATE_BUDGETS) {
  console.log(`\n${failures.length} failed:\n${failures.join("\n")}`);
  process.exit(1);
}
console.log("All bundles within budget.");
