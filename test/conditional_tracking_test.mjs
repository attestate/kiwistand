//@format
import test from "ava";
import { readFileSync } from "fs";
import vm from "vm";

const source = readFileSync("src/public/conditional-tracking.js", "utf8");

const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

// Runs public/conditional-tracking.js in a fake, already loaded page, lets
// the 5s timer fire and returns the scripts it added.
function run({ userAgent = CHROME, webdriver = false } = {}) {
  const added = [];
  const timers = [];
  const element = () => ({});
  const context = {
    navigator: { userAgent, webdriver },
    localStorage: { getItem: () => null },
    document: {
      readyState: "complete",
      documentElement: { classList: { contains: () => false } },
      createElement: element,
      body: { appendChild: (el) => added.push(el.src) },
    },
    window: { addEventListener() {}, removeEventListener() {} },
    setTimeout: (fn) => timers.push(fn),
  };
  vm.runInNewContext(source, context);
  timers.forEach((fn) => fn());
  return added;
}

test("loads Google Analytics for a visitor", (t) => {
  const added = run();
  t.true(added.some((src) => /googletagmanager\.com\/gtag/.test(src)));
  t.true(added.includes("ga.js"));
});

test("skips Google Analytics in automated browsers (Lighthouse)", (t) => {
  // Lighthouse 13's emulated user agent: plain Chrome, but webdriver is set.
  const added = run({
    userAgent:
      "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
    webdriver: true,
  });
  t.false(added.some((src) => /gtag|ga\.js/.test(src)));
});

test("skips Google Analytics for our checks and headless Chrome", (t) => {
  for (const userAgent of [
    `${CHROME} KiwiPagespeed`,
    `${CHROME} Chrome-Lighthouse`,
    CHROME.replace("Chrome/", "HeadlessChrome/"),
  ]) {
    t.false(run({ userAgent }).some((src) => /gtag|ga\.js/.test(src)), userAgent);
  }
});
