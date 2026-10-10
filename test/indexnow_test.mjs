import test from "ava";
import { env } from "process";

import * as indexnow from "../src/indexnow.mjs";
import { buildMonthlySitemap } from "../src/sitemap.mjs";

const KEY = "0123456789abcdef0123456789abcdef";
const story = (index, title) => ({
  index,
  title,
  href: `https://example.com/${index}`,
  identity: "0xee324c588ceef1bf1c1360883e4318834af66366",
});
const keep = async (stories) => stories;

let calls;
const realFetch = globalThis.fetch;
test.beforeEach(() => {
  calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return { ok: true, status: 200 };
  };
});
test.afterEach.always(async () => {
  env.INDEXNOW_KEY = KEY;
  await indexnow.flush(async () => []);
  globalThis.fetch = realFetch;
  delete env.INDEXNOW_KEY;
});

test("storyUrl matches the sitemap's story URLs", (t) => {
  const entry = { title: "Hello, World! It's Kiwi", index: "abc123", timestamp: 1 };
  const url = indexnow.storyUrl(entry);
  t.is(
    url,
    "https://news.kiwistand.com/stories/Hello-World-Its-Kiwi?index=0xabc123",
  );
  t.true(buildMonthlySitemap([entry]).includes(`<loc>${url}</loc>`));
});

test("is a no-op without a valid key", async (t) => {
  for (const value of [undefined, "", "abc", "not-hex-not-hex", "g".repeat(16)]) {
    if (value === undefined) delete env.INDEXNOW_KEY;
    else env.INDEXNOW_KEY = value;
    t.is(indexnow.key(), null);
    indexnow.queue(story("01", "A story"));
    await indexnow.flush(keep);
  }
  t.is(calls.length, 0);
});

test("batches queued stories into one request", async (t) => {
  env.INDEXNOW_KEY = KEY;
  indexnow.queue(story("01", "First story"));
  indexnow.queue(story("02", "Second story"));
  await indexnow.flush(keep);

  t.is(calls.length, 1);
  const [{ url, options, body }] = calls;
  t.is(url, "https://api.indexnow.org/indexnow");
  t.is(options.method, "POST");
  t.truthy(options.signal);
  t.deepEqual(body, {
    host: "news.kiwistand.com",
    key: KEY,
    keyLocation: `https://news.kiwistand.com/${KEY}.txt`,
    urlList: [
      "https://news.kiwistand.com/stories/First-story?index=0x01",
      "https://news.kiwistand.com/stories/Second-story?index=0x02",
    ],
  });

  await indexnow.flush(keep);
  t.is(calls.length, 1, "flush empties the queue");
});

test("skips stories the filter hides and doesn't send empty batches", async (t) => {
  env.INDEXNOW_KEY = KEY;
  indexnow.queue(story("04", "Hidden"));
  indexnow.queue(story("05", "Shown"));
  await indexnow.flush(async (stories) =>
    stories.filter(({ index }) => index !== "04"),
  );
  t.deepEqual(calls[0].body.urlList, [
    "https://news.kiwistand.com/stories/Shown?index=0x05",
  ]);

  indexnow.queue(story("06", "Hidden too"));
  await indexnow.flush(async () => []);
  t.is(calls.length, 1);
});

test("never throws when the request fails", async (t) => {
  env.INDEXNOW_KEY = KEY;
  globalThis.fetch = async () => {
    throw new Error("network down");
  };
  indexnow.queue(story("07", "Story"));
  await t.notThrowsAsync(indexnow.flush(keep));

  globalThis.fetch = async () => ({ ok: false, status: 422 });
  indexnow.queue(story("08", "Story"));
  await t.notThrowsAsync(indexnow.flush(keep));
});

function serve(path) {
  const res = { body: undefined, contentType: undefined };
  res.type = (value) => ((res.contentType = value), res);
  res.send = (value) => ((res.body = value), res);
  let nextCalled = false;
  indexnow.serveKey({ path }, res, () => (nextCalled = true));
  return { ...res, nextCalled };
}

test("serves the key file only for the configured key", (t) => {
  env.INDEXNOW_KEY = KEY;
  const hit = serve(`/${KEY}.txt`);
  t.false(hit.nextCalled);
  t.is(hit.contentType, "text/plain");
  t.is(hit.body, KEY);

  t.true(serve("/deadbeefdeadbeef.txt").nextCalled);

  delete env.INDEXNOW_KEY;
  t.true(serve(`/${KEY}.txt`).nextCalled);
});
