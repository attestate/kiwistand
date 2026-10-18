// @format
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import test from "ava";

process.env.CACHE_DIR = mkdtempSync(join(tmpdir(), "extract-limits-"));
const { extractArticle, setPageFetchForTests, setParseTimeoutForTests } = await import(
  "../src/lib/listen/extract.mjs"
);

// JSDOM and Readability are superlinear in the number of unclosed tags: this
// 24KB page used to block the event loop for minutes.
const NESTED = `<html><head><title>x</title></head><body>${"<div><a>".repeat(3000)}</body></html>`;

function serve(t, routes) {
  setPageFetchForTests(async (url) => {
    const route = routes[String(url)];
    if (!route) return new Response("not found", { status: 404 });
    return route.clone();
  });
  setParseTimeoutForTests(1000);
  t.teardown(() => {
    setPageFetchForTests();
    setParseTimeoutForTests();
  });
}

async function measure(fn) {
  let last = Date.now();
  let gap = 0;
  const timer = setInterval(() => {
    gap = Math.max(gap, Date.now() - last);
    last = Date.now();
  }, 20);
  const start = Date.now();
  const error = await fn().then(() => null, (err) => err);
  clearInterval(timer);
  gap = Math.max(gap, Date.now() - last);
  return { error, duration: Date.now() - start, gap };
}

test.serial("pathological pages are parsed off the main thread", async (t) => {
  const url = "https://blog.example.com/nested";
  serve(t, { [url]: new Response(NESTED, { headers: { "content-type": "text/html" } }) });
  const { error, duration, gap } = await measure(() => extractArticle(url));
  t.is(error?.message, "HTML parsing timeout");
  t.true(duration < 5000);
  t.true(gap < 500, `event loop blocked for ${gap}ms`);
});

test.serial("pathological Discourse posts are parsed off the main thread", async (t) => {
  const url = "https://forum.example.com/t/nested/1";
  const topic = { title: "Nested", post_stream: { posts: [{ cooked: NESTED }] } };
  serve(t, {
    "https://forum.example.com/t/nested/1.json": new Response(JSON.stringify(topic), {
      headers: { "content-type": "application/json" },
    }),
  });
  const { error, duration, gap } = await measure(() => extractArticle(url));
  // The topic times out, and the page fallback finds nothing.
  t.is(error?.message, "Failed to fetch: 404");
  t.true(duration < 5000);
  t.true(gap < 500, `event loop blocked for ${gap}ms`);
});
