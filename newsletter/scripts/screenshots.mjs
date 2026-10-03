// Screenshots of out/Digest.html as mail clients show it: light, dark
// (clients that honor prefers-color-scheme, e.g. Apple Mail) and forced
// dark (clients that invert colors themselves, e.g. Gmail and Outlook apps;
// simulated by inverting everything except images). Needs Playwright:
//   npx playwright install chromium   (or PLAYWRIGHT_CHROMIUM=/path/to/chrome)
//   node scripts/screenshots.mjs [out/Digest.html] [out/screenshots]
import fs from "fs/promises";
import path from "path";

const { chromium } = await import("playwright").catch(() => {
  console.error("Playwright isn't installed: npm i -D playwright");
  process.exit(1);
});

const file = path.resolve(process.argv[2] || "out/Digest.html");
const dir = path.resolve(process.argv[3] || "out/screenshots");
await fs.mkdir(dir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
});

// Assets on news.kiwistand.com are served from ../src/public, so new
// images show up before they're deployed. Behind an HTTPS proxy (sandboxes),
// Chromium may not trust the proxy's CA, so other remote images are fetched
// by Node instead (run with NODE_USE_ENV_PROXY=1 so fetch uses the proxy).
const publicDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../src/public");
const types = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml" };
async function routeImages(page) {
  await page.route(/^https?:/, async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "news.kiwistand.com") {
      const local = path.join(publicDir, path.normalize(url.pathname));
      const body = local.startsWith(publicDir) && (await fs.readFile(local).catch(() => null));
      if (body) {
        const ext = local.split(".").pop().toLowerCase();
        return route.fulfill({ status: 200, headers: { "content-type": types[ext] || "application/octet-stream" }, body });
      }
    }
    if (!process.env.HTTPS_PROXY) return route.continue();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      await route.fulfill({
        status: response.status,
        headers: { "content-type": response.headers.get("content-type") || "" },
        body: Buffer.from(await response.arrayBuffer()),
      });
    } catch {
      await route.abort();
    }
  });
}

const modes = [
  { name: "light", colorScheme: "light" },
  { name: "dark", colorScheme: "dark" },
  {
    name: "forced-dark",
    colorScheme: "light",
    css: "html{filter:invert(1) hue-rotate(180deg);background:#fff} img{filter:invert(1) hue-rotate(180deg)}",
  },
];
for (const width of [375, 640]) {
  for (const mode of modes) {
    const page = await browser.newPage({
      viewport: { width, height: 800 },
      colorScheme: mode.colorScheme,
      deviceScaleFactor: 1,
    });
    await routeImages(page);
    await page.goto(`file://${file}`, { waitUntil: "networkidle" }).catch(() => {});
    if (mode.css) await page.addStyleTag({ content: mode.css });
    const out = path.join(dir, `${mode.name}-${width}.png`);
    await page.screenshot({ path: out, fullPage: true });
    console.log(out);
    await page.close();
  }
}
await browser.close();
