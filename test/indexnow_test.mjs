import test from "ava";
import { existsSync, readFileSync } from "fs";
import { env } from "process";

import * as indexnow from "../src/indexnow.mjs";
import { buildMonthlySitemap } from "../src/sitemap.mjs";

const KEY = indexnow.KEY;
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
const nodeEnv = env.NODE_ENV;
test.afterEach.always(async () => {
  env.NODE_ENV = "production";
  await indexnow.flush(async () => []);
  globalThis.fetch = realFetch;
  if (nodeEnv === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = nodeEnv;
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

test("is a no-op outside production", async (t) => {
  for (const value of [undefined, "development", "staging"]) {
    if (value === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = value;
    t.is(indexnow.key(), null);
    indexnow.queue(story("01", "A story"));
    await indexnow.flush(keep);
  }
  t.is(calls.length, 0);
});

test("batches queued stories into one request", async (t) => {
  env.NODE_ENV = "production";
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
  env.NODE_ENV = "production";
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
  env.NODE_ENV = "production";
  globalThis.fetch = async () => {
    throw new Error("network down");
  };
  indexnow.queue(story("07", "Story"));
  await t.notThrowsAsync(indexnow.flush(keep));

  globalThis.fetch = async () => ({ ok: false, status: 422 });
  indexnow.queue(story("08", "Story"));
  await t.notThrowsAsync(indexnow.flush(keep));
});

test("the key file in src/public contains the key", (t) => {
  t.regex(KEY, /^[0-9a-f]{32}$/);
  const file = `src/public/${KEY}.txt`;
  t.true(existsSync(file));
  t.is(readFileSync(file, "utf8").trim(), KEY);
});
