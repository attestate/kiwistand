// Layout shift and Lighthouse checks for news.kiwistand.com.
//
// Loads every page type on a throttled connection and CPU (desktop and
// phone), sums its layout shifts and fails when a page shifts more than the
// budget in budgets.json. Then runs Lighthouse on the main pages and fails
// when a score drops below its floor. Raise the floors when pages get faster
// so they can't quietly get slower again.
//
// It measures production because pages need real stories, comments and
// profiles to be representative. To check a change before it ships, pass the
// stylesheets from a checkout and they replace the live ones:
//
//   LOCAL_CSS=src/public/news.css LOCAL_INTER=src/public/fonts/inter.css \
//     node scripts/pagespeed/check.mjs
//
// Other env: BASE_URL (default https://news.kiwistand.com), ONLY_CLS=1 skips
// Lighthouse, CHROME_PATH uses another Chromium, SUMMARY_FILE appends a
// markdown report (GitHub sets GITHUB_STEP_SUMMARY).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const budgets = JSON.parse(
  fs.readFileSync(path.join(here, "budgets.json"), "utf8"),
);
const BASE = (process.env.BASE_URL || "https://news.kiwistand.com").replace(
  /\/$/,
  "",
);
const CHROME = process.env.CHROME_PATH || chromium.executablePath();
const UA = {
  desktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  mobile:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
};
const VIEWPORT = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

// NOTE: Behind an intercepting proxy (e.g. a sandbox), go through it.
const proxy = process.env.HTTPS_PROXY;
const browser = await chromium.launch({
  executablePath: CHROME,
  ...(proxy
    ? { proxy: { server: proxy }, args: ["--ignore-certificate-errors"] }
    : {}),
});

async function newContext(device) {
  const ctx = await browser.newContext({
    viewport: VIEWPORT[device],
    isMobile: device === "mobile",
    hasTouch: device === "mobile",
    userAgent: UA[device],
  });
  for (const [env, pattern] of [
    ["LOCAL_CSS", /\/news\.css/],
    ["LOCAL_INTER", /\/fonts\/inter\.css/],
  ]) {
    if (!process.env[env]) continue;
    const body = fs.readFileSync(process.env[env], "utf8");
    await ctx.route(pattern, (route) =>
      route.fulfill({ status: 200, contentType: "text/css", body }),
    );
  }
  await ctx.addInitScript(() => {
    window.__shifts = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.hadRecentInput) continue;
        const sources = (e.sources || []).map((s) => {
          const el =
            s.node && (s.node.nodeType === 1 ? s.node : s.node.parentElement);
          if (!el) return "?";
          const cls =
            typeof el.className === "string" && el.className.trim()
              ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
              : "";
          const r = s.previousRect;
          const n = s.currentRect;
          return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${cls} ${Math.round(r.y)}+${Math.round(r.height)} -> ${Math.round(n.y)}+${Math.round(n.height)}`;
        });
        window.__shifts.push({
          value: e.value,
          at: Math.round(e.startTime),
          sources,
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  return ctx;
}

// Cloudflare may show a browser check first; it passes on its own.
async function waitForChallenge(page) {
  for (let i = 0; i < 30; i++) {
    if (!/Just a moment/i.test(await page.title())) return true;
    await page.waitForTimeout(1000);
  }
  return false;
}

async function discover() {
  const ctx = await newContext("desktop");
  const page = await ctx.newPage();
  await page.goto(`${BASE}/best`, { timeout: 60000 });
  await waitForChallenge(page);
  await page.waitForSelector('a[href^="/stories/"]', { timeout: 30000 });
  const links = await page.$$eval("a[href]", (as) =>
    as.map((a) => a.getAttribute("href")),
  );
  await ctx.close();
  const stories = [
    ...new Set(links.filter((h) => /^\/stories\/.+\?index=0x/.test(h))),
  ].slice(0, 2);
  const address = links
    .map((h) => /^\/upvotes\?address=(0x[0-9a-fA-F]{40})/.exec(h))
    .find(Boolean)?.[1];
  return { stories, address };
}

async function pages() {
  const { stories, address } = await discover();
  const list = [
    ["home", "/"],
    ["new", "/new"],
    ["best", "/best"],
    ["best week", "/best?period=week"],
    ["notifications", "/notifications"],
    ["submit", "/submit"],
    ["search", "/search"],
    ["newsletter", "/newsletter"],
    ["weekly", "/weekly"],
    ["guidelines", "/guidelines"],
    ["privacy", "/privacy-policy"],
    ...stories.map((s, i) => [`story ${i + 1}`, s]),
  ];
  if (address) {
    list.push(
      ["activity", `/activity?address=${address}`],
      ["profile", `/upvotes?address=${address}`],
      ["profile app", `/profile?address=${address}`],
    );
  }
  return list;
}

// NOTE: The cache-busting parameter makes the edge fetch the page from the
// server, so this measures the deployed code, not a copy cached days ago.
function fresh(url) {
  return url + (url.includes("?") ? "&" : "?") + "pagespeed=" + Date.now();
}

async function measure(ctx, url) {
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  // Roughly a mid-range phone on a slow 4G connection.
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const response = await page.goto(fresh(BASE + url), {
    waitUntil: "load",
    timeout: 90000,
  });
  if (!(await waitForChallenge(page))) throw new Error("stuck on Cloudflare");
  if (response && response.status() >= 400 && response.status() !== 403) {
    throw new Error(`HTTP ${response.status()}`);
  }
  // Late shifts happen when the app bundle mounts, which takes a while on a
  // throttled CPU.
  await page.waitForTimeout(12000);
  const shifts = await page.evaluate(() => window.__shifts);
  await page.close();
  return {
    cls: shifts.reduce((sum, s) => sum + s.value, 0),
    shifts: shifts.filter((s) => s.value >= 0.001),
  };
}

const failures = [];
const report = ["## Layout shift", "", "| Page | Desktop | Phone |", "|---|---|---|"];

const list = await pages();
const results = {};
for (const device of ["desktop", "mobile"]) {
  const ctx = await newContext(device);
  for (const [name, url] of list) {
    let result;
    // One retry: a page sometimes renders while a request stalls.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        result = await measure(ctx, url);
      } catch (err) {
        result = { error: err.message.split("\n")[0] };
      }
      if (!result.error && result.cls <= budgets.cls) break;
    }
    results[name] ??= { url };
    results[name][device] = result;
    const shown = result.error ? `error: ${result.error}` : result.cls.toFixed(4);
    console.log(`${device.padEnd(8)} ${name.padEnd(14)} CLS ${shown}`);
    if (result.error) {
      failures.push(`${name} (${device}): ${result.error}`);
    } else if (result.cls > budgets.cls) {
      failures.push(
        `${name} (${device}): CLS ${result.cls.toFixed(4)} > ${budgets.cls}`,
      );
      for (const s of result.shifts) {
        console.log(`  ${s.at}ms +${s.value.toFixed(4)} ${s.sources.join(" | ")}`);
      }
    }
  }
  await ctx.close();
}
await browser.close();

for (const [name, r] of Object.entries(results)) {
  const cell = (x) =>
    !x ? "" : x.error ? "error" : `${x.cls > budgets.cls ? "❌ " : ""}${x.cls.toFixed(4)}`;
  report.push(`| [${name}](${BASE}${r.url}) | ${cell(r.desktop)} | ${cell(r.mobile)} |`);
}
report.push("", `Budget: ${budgets.cls} per page.`, "");

if (!process.env.ONLY_CLS) {
  report.push(
    "## Lighthouse",
    "",
    "| Page | Device | Performance | Accessibility | Best practices | SEO | LCP | TBT |",
    "|---|---|---|---|---|---|---|---|",
  );
  const lighthouse = path.join(here, "node_modules", ".bin", "lighthouse");
  const lhPages = list.filter(([name]) => budgets.lighthousePages.includes(name));
  for (const [name, url] of lhPages) {
    for (const device of ["desktop", "mobile"]) {
      const out = path.join(here, `lh-${name.replace(/\W/g, "_")}-${device}.json`);
      try {
        execFileSync(
          lighthouse,
          [
            BASE + url,
            ...(device === "desktop" ? ["--preset=desktop"] : []),
            "--output=json",
            `--output-path=${out}`,
            "--quiet",
            "--chrome-flags=--headless=new --no-sandbox",
          ],
          { env: { ...process.env, CHROME_PATH: CHROME }, timeout: 180000 },
        );
      } catch (err) {
        failures.push(`lighthouse ${name} (${device}): ${err.message.split("\n")[0]}`);
        continue;
      }
      const lhr = JSON.parse(fs.readFileSync(out, "utf8"));
      if (lhr.runtimeError) {
        failures.push(`lighthouse ${name} (${device}): ${lhr.runtimeError.code}`);
        continue;
      }
      const score = (k) => Math.round((lhr.categories[k]?.score ?? 0) * 100);
      const scores = {
        performance: score("performance"),
        accessibility: score("accessibility"),
        "best-practices": score("best-practices"),
        seo: score("seo"),
      };
      // NOTE: Overrides are for pages where a category doesn't apply, e.g.
      // /activity is personal and kept out of search engines on purpose.
      const floors = {
        ...budgets.lighthouse[device],
        ...budgets.lighthouseOverrides?.[name],
      };
      const cells = Object.entries(scores).map(([k, v]) => {
        if (v < floors[k]) {
          failures.push(`lighthouse ${name} (${device}): ${k} ${v} < ${floors[k]}`);
          return `❌ ${v}`;
        }
        return String(v);
      });
      const a = lhr.audits;
      report.push(
        `| ${name} | ${device} | ${cells.join(" | ")} | ${a["largest-contentful-paint"].displayValue} | ${a["total-blocking-time"].displayValue} |`,
      );
      console.log(`lighthouse ${device.padEnd(8)} ${name.padEnd(14)} ${JSON.stringify(scores)}`);
    }
  }
  report.push("", "Floors are in scripts/pagespeed/budgets.json.", "");
}

if (failures.length) {
  report.push("## Failed", "", ...failures.map((f) => `- ${f}`), "");
}
const summary = process.env.SUMMARY_FILE || process.env.GITHUB_STEP_SUMMARY;
if (summary) fs.appendFileSync(summary, report.join("\n") + "\n");

if (failures.length) {
  console.log(`\n${failures.length} failed:\n${failures.join("\n")}`);
  process.exit(1);
}
console.log("\nAll pages within budget.");
