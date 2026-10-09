import test from "ava";

import { isLinkAlive } from "../src/linkcheck.mjs";

const respond = (status, calls = []) => async (url) => {
  calls.push(url);
  return new Response(null, { status });
};

test("a deleted tweet is dead", async (t) => {
  const calls = [];
  const alive = await isLinkAlive(
    "https://x.com/DeanEigenmann/status/2107892494847688754?s=46",
    respond(404, calls),
  );
  t.false(alive);
  t.is(calls[0], "https://api.fxtwitter.com/status/2107892494847688754");
});

test("a tweet from an account that went private is dead", async (t) => {
  t.false(await isLinkAlive("https://twitter.com/a/status/1", respond(401)));
});

test("an existing tweet is alive", async (t) => {
  t.true(await isLinkAlive("https://x.com/a/status/1", respond(200)));
});

test("articles that return 404 or 410 are dead", async (t) => {
  t.false(await isLinkAlive("https://example.com/a", respond(404)));
  t.false(await isLinkAlive("https://example.com/a", respond(410)));
});

test("bot blocks, server errors and timeouts keep the story", async (t) => {
  t.true(await isLinkAlive("https://example.com/a", respond(403)));
  t.true(await isLinkAlive("https://example.com/a", respond(503)));
  const timeout = async () => {
    throw new DOMException("timed out", "TimeoutError");
  };
  t.true(await isLinkAlive("https://example.com/a", timeout));
});

test("a domain that no longer exists is dead", async (t) => {
  const notFound = async () => {
    const err = new TypeError("fetch failed");
    err.cause = { code: "ENOTFOUND" };
    throw err;
  };
  t.false(await isLinkAlive("https://gone.example/a", notFound));
});

test("text posts and kiwi references are not fetched", async (t) => {
  const calls = [];
  t.true(await isLinkAlive("data:text/plain,hello", respond(404, calls)));
  t.true(await isLinkAlive("kiwi:0xabc", respond(404, calls)));
  t.is(calls.length, 0);
});
