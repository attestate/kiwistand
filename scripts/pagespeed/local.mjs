// Runs this checkout's server offline with the fixture and checks its pages,
// so a pull request's templates, client code and styles are measured before
// they ship (pagespeed-pr.yml). Needs the client built first (npm run build)
// and the server's dependencies installed (npm ci).
//
//   node scripts/pagespeed/local.mjs
//
// 1. seed.mjs fills a fresh data and cache directory from
//    test/fixtures/pagespeed (stories, comments, upvotes, profiles, link
//    previews, summaries) and generates the images.
// 2. Serves those images from 127.0.0.1:ASSET_PORT, standing in for the
//    third-party image hosts.
// 3. Starts the load balancer and the node like `npm start` does, with
//    NODE_ENV=production, no peers, no chain and no internet (offline.mjs).
// 4. Runs check.mjs against it with BUDGETS=local and MEDIAN_RUNS (default
//    3), then bundles.mjs with the JS each page type loaded.
//
// Env: HTTP_PORT (default 4000), ASSET_PORT (default 4100), WORK_DIR (default
// a new temp directory; holds the databases and server.log), KEEP_RUNNING=1
// leaves the server up after the checks (to poke at it), SKIP_CHECKS=1 only
// starts it. Other env is passed on to check.mjs (CHROME_PATH, ONLY_CLS,
// SKIP_CLS, ...).
import fs from "fs";
import os from "os";
import path from "path";
import http from "http";
import { spawn, spawnSync } from "child_process";
import { fileURLToPath, pathToFileURL } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const HTTP_PORT = Number(process.env.HTTP_PORT || 4000);
const ASSET_PORT = Number(process.env.ASSET_PORT || 4100);
const BASE = `http://localhost:${HTTP_PORT}`;
const work =
  process.env.WORK_DIR || fs.mkdtempSync(path.join(os.tmpdir(), "kiwi-pagespeed-"));
const dirs = {
  DATA_DIR: path.join(work, "data"),
  CACHE_DIR: path.join(work, "cache"),
  ASSET_DIR: path.join(work, "assets"),
};
for (const dir of Object.values(dirs)) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}
const started = Date.now();
const elapsed = () => `${((Date.now() - started) / 1000).toFixed(0)}s`;

if (!fs.existsSync(path.join(root, "src/public/manifest.json"))) {
  console.error("src/public/manifest.json is missing: run `npm run build` first");
  process.exit(1);
}
// NOTE: Story pages write their share preview image there (gitignored, it
// exists on the production server).
fs.mkdirSync(path.join(root, "src/public/previews"), { recursive: true });

// NOTE: No proxy: the server and the browser only talk to this machine.
const env = { ...process.env };
for (const k of ["HTTPS_PROXY", "HTTP_PROXY", "https_proxy", "http_proxy"]) {
  delete env[k];
}

// 1. Seed.
const assetOrigin = `http://127.0.0.1:${ASSET_PORT}`;
const seeded = spawnSync(process.execPath, [path.join(here, "seed.mjs")], {
  cwd: root,
  env: { ...env, ...dirs, ASSET_ORIGIN: assetOrigin, NODE_ENV: "production" },
  stdio: "inherit",
});
if (seeded.status !== 0) process.exit(seeded.status || 1);
console.log(`[${elapsed()}] seeded ${work}`);

// 2. The stand-in for third-party image hosts.
const types = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const assets = http.createServer((req, res) => {
  const file = path.join(dirs.ASSET_DIR, path.normalize(decodeURIComponent(req.url.split("?")[0])));
  if (!file.startsWith(dirs.ASSET_DIR) || !fs.existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    "Content-Type": types[path.extname(file).slice(1)] || "application/octet-stream",
    "Cache-Control": "public, max-age=86400",
    "Access-Control-Allow-Origin": "*",
  });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => assets.listen(ASSET_PORT, "127.0.0.1", resolve));

// 3. The server, as `npm start` runs it.
const log = fs.openSync(path.join(work, "server.log"), "w");
const serverEnv = {
  ...env,
  ...dirs,
  NODE_ENV: "production",
  HTTP_PORT: String(HTTP_PORT),
  API_PORT: String(HTTP_PORT + 500),
  WORKER_COUNT: "2",
  BIND_ADDRESS_V4: "127.0.0.1",
  PORT: "0",
  IS_BOOTSTRAP_NODE: "false",
  USE_EPHEMERAL_ID: "true",
  AUTO_SYNC: "false",
  MIN_TIMESTAMP_SECS: "1672527600",
  MAX_TIMESTAMP_DELTA_SECS: "60",
  HTTP_MESSAGES_MAX_PAGE_SIZE: "500",
  ROOT_ADVERTISEMENT_TIMEOUT: "60000",
  TOTAL_STORIES: "20",
  TOTAL_USERS: "20",
  USER_AGENT: "KiwiNewsBot/1.0 (https://news.kiwistand.com)",
  // NOTE: Nothing listens there; offline.mjs refuses other hosts anyway.
  OPTIMISM_RPC_HTTP_HOST: "http://127.0.0.1:9",
  RPC_HTTP_HOST: "http://127.0.0.1:9",
  BASE_RPC_HTTP_HOST: "http://127.0.0.1:9",
  ENSDATA_KEY: "pagespeed",
  CF_IMAGES_SECRET: "pagespeed",
  SOCIAL_AUTOPOST: "false",
  DAILY_PUSH: "false",
  DEBUG: "@attestate/kiwistand",
  NODE_OPTIONS: [
    process.env.NODE_OPTIONS,
    `--import=${pathToFileURL(path.join(here, "offline.mjs")).href}`,
  ]
    .filter(Boolean)
    .join(" "),
};
const servers = ["src/load-balancer.mjs", "src/launch.mjs"].map((script) =>
  spawn(process.execPath, [script], {
    cwd: root,
    env: serverEnv,
    stdio: ["ignore", log, log],
    detached: true,
  }),
);
let stopping = false;
function stop() {
  stopping = true;
  for (const s of servers) {
    try {
      process.kill(-s.pid, "SIGTERM");
    } catch {}
  }
  assets.close();
}
for (const s of servers) {
  s.on("exit", (code) => {
    if (stopping) return;
    console.error(`${s.spawnargs[1]} exited with ${code}, see ${path.join(work, "server.log")}`);
    stop();
    process.exit(1);
  });
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stop();
    process.exit(130);
  });
}
process.on("exit", () => stopping || stop());

// Ready when the feeds show stories. Each page is requested once, so the
// measured loads don't include the server's first-render work.
const ready = [
  ["/", 'href="/stories/'],
  ["/new", 'href="/stories/'],
  ["/best", 'href="/stories/'],
  ["/best?period=week", 'href="/stories/'],
];
async function get(url) {
  try {
    const res = await fetch(BASE + url, { signal: AbortSignal.timeout(30000) });
    return { status: res.status, body: await res.text() };
  } catch (err) {
    return { status: 0, body: "" };
  }
}
for (const [url, marker] of ready) {
  for (let i = 0; ; i++) {
    const { status, body } = await get(url);
    if (status === 200 && body.includes(marker)) break;
    if (i >= 120) {
      console.error(`${url} not ready after 4 minutes (HTTP ${status}), see ${path.join(work, "server.log")}`);
      stop();
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}
console.log(`[${elapsed()}] server ready at ${BASE}`);
if (process.env.SKIP_CHECKS) {
  console.log("SKIP_CHECKS is set, the server keeps running (ctrl-c stops it)");
  await new Promise(() => {});
}

// 4. The checks.
const pageAssets = path.join(work, "page-assets.json");
const run = (script, extra) =>
  spawnSync(process.execPath, [path.join(here, script)], {
    cwd: root,
    env: { ...env, ...extra },
    stdio: "inherit",
  }).status;
const checked = run("check.mjs", {
  BASE_URL: BASE,
  BUDGETS: "local",
  OFFLINE: "1",
  MEDIAN_RUNS: process.env.MEDIAN_RUNS || "3",
  PAGE_ASSETS_OUT: pageAssets,
});
console.log(`[${elapsed()}] check.mjs done`);
const bundled = !process.env.SKIP_CLS && fs.existsSync(pageAssets)
  ? run("bundles.mjs", { PAGE_ASSETS: pageAssets })
  : 0;

if (process.env.KEEP_RUNNING) {
  console.log(`KEEP_RUNNING is set, the server keeps running at ${BASE} (ctrl-c stops it)`);
  await new Promise(() => {});
}
stop();
console.log(`[${elapsed()}] done`);
process.exit(checked || bundled ? 1 : 0);
