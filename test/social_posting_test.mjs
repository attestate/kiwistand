import test from "ava";
import { mkdtempSync, rmSync, readFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

import * as social from "../src/social-posting.mjs";

const ALL = {
  CONSUMER_KEY: "ck",
  CONSUMER_SECRET: "cs",
  TWITTER_ACCESS_TOKEN: "at",
  TWITTER_ACCESS_TOKEN_SECRET: "ats",
  NEYNAR_API_KEY: "neynar-key",
  FC_SIGNER_UUID: "signer-uuid",
  TG_KEY: "123:tg-secret",
  TG_CHANNEL_ID: "-100123",
  // NOTE: Every day, so tests don't depend on today's weekday.
  TELEGRAM_POST_WEEKDAYS: "0,1,2,3,4,5,6",
};

// A test key and the hub settings for the direct-to-hub path.
const HUB = {
  FC_FID: "1234",
  FC_SIGNER_PRIVATE_KEY: "0x" + "11".repeat(32),
  FC_HUB_URL: "https://hub.example.org:2281/",
};

const story = (index, upvotes = 5, title = `Story ${index}`) => ({
  index,
  title,
  upvotes,
  href: `https://www.example.com/${index}`,
});

// A fetch mock that records calls and answers per host.
function mockFetch(answers = {}) {
  const calls = [];
  const fetch = async (url, options) => {
    let body;
    try {
      body = JSON.parse(options.body);
    } catch (err) {
      body = options.body;
    }
    calls.push({ url, options, body });
    const host = new URL(url).hostname;
    const answer = answers[host] || { status: 200, body: "{}" };
    if (answer.throws) throw new Error(answer.throws);
    return {
      ok: answer.status >= 200 && answer.status < 300,
      status: answer.status,
      text: async () => answer.body,
    };
  };
  return { fetch, calls };
}

let dir, statePath, errors, logs;
const realError = console.error;
const realLog = console.log;
test.beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "social-"));
  statePath = path.join(dir, "social-posts.json");
  errors = [];
  logs = [];
  console.error = (...args) => errors.push(args.join(" "));
  console.log = (...args) => logs.push(args.join(" "));
});
test.afterEach.always(() => {
  console.error = realError;
  console.log = realLog;
  rmSync(dir, { recursive: true, force: true });
});

test("status lines name missing vars but never values", (t) => {
  const lines = social.statusLines({ ...ALL, CONSUMER_KEY: "", TG_KEY: undefined });
  t.deepEqual(lines, [
    "social: X disabled (missing CONSUMER_KEY)",
    "social: Farcaster enabled",
    "social: Telegram disabled (missing TG_KEY)",
  ]);
  t.false(lines.join("\n").includes("neynar-key"));
  t.deepEqual(social.enabledChannels({}), []);
  t.deepEqual(social.enabledChannels(ALL), ["x", "farcaster", "telegram"]);
});

test("formats posts per channel", (t) => {
  const s = { index: "abc", title: "hello, World!", href: "https://www.example.com/a" };
  const url = social.storyUrl(s);
  t.is(url, "https://news.kiwistand.com/stories/hello-World?index=0xabc");
  t.is(social.formatForX(s), `Hello, World!\n\nvia example.com\n\n${url}`);
  t.deepEqual(social.formatForFarcaster(s), {
    text: "Hello, World!\n\nvia example.com",
    embeds: [url],
  });
  t.is(social.formatForTelegram(s), `Hello, World!\n\nvia example.com\n\n${url}`);
  // NOTE: Text posts have no source.
  const text = { index: "def", title: "Ask Kiwi", href: "data:text/plain,hi" };
  t.true(social.formatForX(text).startsWith("Ask Kiwi\n\nhttps://"));
});

test("posts name the X handle and lead with the summary's first sentence", (t) => {
  const s = {
    index: "abc",
    title: "how tampered Ledger devices steal seeds",
    href: "https://x.com/joegrand/status/123",
    summary: "A counterfeit Ledger Nano X hides an implant that reads seed words. It sends them out over 4G.",
  };
  t.is(social.sourceOf(s.href), "via @joegrand");
  t.is(social.sourceOf("https://x.com/i/web/status/1"), "via x.com");
  t.is(
    social.formatForFarcaster(s).text,
    "How tampered Ledger devices steal seeds\n\nA counterfeit Ledger Nano X hides an implant that reads seed words.\n\nvia @joegrand",
  );
});

test("drops the hook before shortening the title", (t) => {
  const s = {
    index: "abc",
    title: "t".repeat(200),
    href: "https://a.com/x",
    summary: `${"s".repeat(150)}.`,
  };
  const tweet = social.formatForX(s, "https://k.com/x");
  t.false(tweet.includes("sss"));
  t.true(tweet.startsWith(`T${"t".repeat(199)}`));
  t.is(social.hookOf("x".repeat(300) + "."), "");
});

test("truncates long titles to the channel limits", (t) => {
  const long = { index: "abc", title: "ü".repeat(400), href: "https://a.com" };
  const tweet = social.formatForX(long, "https://k.com/x");
  const head = tweet.slice(0, tweet.lastIndexOf("\n\n"));
  t.true([...head].length <= 280 - 23 - 2);
  t.true(head.includes("…"));
  const { text } = social.formatForFarcaster(long);
  t.true(Buffer.byteLength(text) <= 320);
  t.true(text.includes("…"));
});

test("sendTweet posts to /2/tweets with OAuth 1.0a", async (t) => {
  const { fetch, calls } = mockFetch({
    "api.twitter.com": { status: 201, body: '{"data":{"id":"42"}}' },
  });
  const result = await social.sendTweet("hi", { fetch, vars: ALL });
  t.deepEqual(result, { success: true, status: 201, id: "42" });
  t.is(calls[0].url, "https://api.twitter.com/2/tweets");
  t.deepEqual(calls[0].body, { text: "hi" });
  t.regex(calls[0].options.headers.Authorization, /^OAuth .*oauth_token="at"/);
});

test("failures are loud, with status and body, and never throw", async (t) => {
  const { fetch } = mockFetch({
    "api.twitter.com": {
      status: 402,
      body: '{"title":"CreditsDepleted","detail":"Your enrolled account does not have any credits"}',
    },
    "api.neynar.com": { status: 403, body: '{"message":"Signer not approved"}' },
    "api.telegram.org": {
      status: 401,
      body: '{"ok":false,"error_code":401,"description":"Unauthorized"}',
    },
  });
  const x = await social.sendTweet("hi", { fetch, vars: ALL });
  const fc = await social.sendCast("hi", ["https://k.com"], { fetch, vars: ALL });
  const tg = await social.sendToTelegram("hi", { fetch, vars: ALL });
  t.false(x.success);
  t.is(x.status, 402);
  t.false(fc.success);
  t.false(tg.success);
  t.is(errors.length, 3);
  t.regex(errors[0], /^social: X post failed: HTTP 402 .*CreditsDepleted/);
  t.regex(errors[1], /^social: Farcaster post failed: HTTP 403 .*Signer not approved/);
  t.regex(errors[2], /^social: Telegram post failed: HTTP 401 .*Unauthorized/);
  // NOTE: The Telegram bot token is part of the URL and must not be logged.
  t.false(errors.join("\n").includes("tg-secret"));

  const down = mockFetch({ "api.twitter.com": { throws: "ECONNRESET" } });
  const net = await social.sendTweet("hi", { fetch: down.fetch, vars: ALL });
  t.false(net.success);
  t.regex(errors[3], /^social: X post failed: ECONNRESET/);
});

test("sendCast uses Neynar with the signer and url embeds", async (t) => {
  const { fetch, calls } = mockFetch({
    "api.neynar.com": { status: 200, body: '{"success":true,"cast":{"hash":"0xcafe"}}' },
  });
  const result = await social.sendCast("hi - a.com", ["https://k.com/s"], {
    fetch,
    vars: ALL,
  });
  t.true(result.success);
  t.is(result.id, "0xcafe");
  t.is(calls[0].url, social.NEYNAR_CAST_ENDPOINT);
  t.is(calls[0].options.headers["x-api-key"], "neynar-key");
  t.is(calls[0].body.signer_uuid, "signer-uuid");
  t.deepEqual(calls[0].body.embeds, [{ url: "https://k.com/s" }]);
  t.is(typeof calls[0].body.idem, "string");
});

test("sendToTelegram treats ok:false as a failure and uses the channel id", async (t) => {
  const { fetch, calls } = mockFetch({
    "api.telegram.org": { status: 200, body: '{"ok":false,"description":"chat not found"}' },
  });
  const result = await social.sendToTelegram("hi", { fetch, vars: ALL });
  t.false(result.success);
  t.is(calls[0].body.chat_id, "-100123");
  t.regex(errors[0], /chat not found/);
});

test("unconfigured channels are skipped without a request", async (t) => {
  const { fetch, calls } = mockFetch();
  const result = await social.sendTweet("hi", { fetch, vars: {} });
  t.false(result.success);
  t.true(result.skipped);
  t.is(calls.length, 0);
});

test("postStory never posts a story twice to the same channel", async (t) => {
  const { fetch, calls } = mockFetch({
    "api.twitter.com": { status: 201, body: '{"data":{"id":"1"}}' },
    "api.telegram.org": { status: 500, body: "boom" },
  });
  const s = story("0xaa");
  const first = await social.postStory(s, { fetch, vars: ALL, statePath });
  t.true(first.x.success);
  t.true(first.farcaster.success);
  t.false(first.telegram.success);
  t.is(calls.length, 3);

  // NOTE: Same story without the 0x prefix is the same story.
  const second = await social.postStory(story("aa"), { fetch, vars: ALL, statePath });
  t.true(second.x.skipped);
  t.true(second.farcaster.skipped);
  // Telegram failed before, so it's retried.
  t.is(calls.length, 4);
  t.true(calls[3].url.startsWith("https://api.telegram.org/"));

  const state = JSON.parse(readFileSync(statePath, "utf8"));
  t.deepEqual(Object.keys(state.posted.aa).sort(), ["farcaster", "x"]);
});

test("pickStory takes the top unposted story with enough upvotes", async (t) => {
  const state = { posted: { a: { x: 1 } }, lastSlot: null };
  const stories = [story("a"), story("b", 1), story("c"), story("d")];
  t.is((await social.pickStory(stories, "x", state, { min: 2 })).index, "c");
  t.is((await social.pickStory(stories, "farcaster", state, { min: 2 })).index, "a");
  const isAlive = async (href) => !href.endsWith("/c");
  t.is((await social.pickStory(stories, "x", state, { min: 2, isAlive })).index, "d");
  t.is(await social.pickStory([story("a")], "x", state, { min: 2 }), null);
});

test("runOnce posts the top story once per enabled channel", async (t) => {
  const { fetch, calls } = mockFetch({
    "api.twitter.com": { status: 201, body: '{"data":{"id":"1"}}' },
  });
  const vars = { ...ALL, TG_KEY: "" };
  const getStories = async () => [story("a", 1), story("b"), story("c")];

  const first = await social.runOnce({ getStories, fetch, vars, statePath });
  t.deepEqual(Object.keys(first), ["x", "farcaster"]);
  t.is(first.x.story.index, "b");
  t.is(first.farcaster.story.index, "b");
  t.is(calls.length, 2);

  // NOTE: The next run moves on to the next story.
  const second = await social.runOnce({ getStories, fetch, vars, statePath });
  t.is(second.x.story.index, "c");
  t.is(calls.length, 4);

  const third = await social.runOnce({ getStories, fetch, vars, statePath });
  t.deepEqual(third, {});
  t.is(calls.length, 4);
});

test("runOnce survives a failing story source", async (t) => {
  const getStories = async () => {
    throw new Error("db locked");
  };
  const result = await social.runOnce({ getStories, vars: ALL, statePath });
  t.deepEqual(result, {});
  t.regex(errors[0], /social: could not load stories: db locked/);
});

test("dueSlot runs once per configured UTC hour", (t) => {
  const at = new Date("2026-10-10T16:05:00Z");
  t.is(social.dueSlot(at, [16], null), "2026-10-10T16");
  t.is(social.dueSlot(at, [16], "2026-10-10T16"), null);
  t.is(social.dueSlot(at, [8], null), null);
  t.is(social.dueSlot(new Date("2026-10-11T16:59:00Z"), [16], "2026-10-10T16"), "2026-10-11T16");
});

test("config parsing", (t) => {
  t.deepEqual(social.postHours({}), [16]);
  t.deepEqual(social.postHours({ SOCIAL_POST_HOURS_UTC: "8, 20,x,25" }), [8, 20]);
  t.is(social.minUpvotes({}), 2);
  t.is(social.minUpvotes({ SOCIAL_MIN_UPVOTES: "0" }), 0);
  t.true(social.autopostEnabled({ NODE_ENV: "production" }));
  t.false(social.autopostEnabled({ NODE_ENV: "production", SOCIAL_AUTOPOST: "false" }));
  t.false(social.autopostEnabled({ NODE_ENV: "test" }));
  t.true(social.autopostEnabled({ NODE_ENV: "test", SOCIAL_AUTOPOST: "true" }));
});

test("startScheduler stays off outside production and logs channel status", (t) => {
  const timer = social.startScheduler({ vars: { NODE_ENV: "test" }, statePath });
  t.is(timer, null);
  t.true(logs.includes("social: X disabled (missing CONSUMER_KEY, CONSUMER_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET)"));
  t.true(logs.some((l) => l.startsWith("social: automatic posting off")));
});

test("Telegram needs an explicit channel id, there is no default", (t) => {
  const vars = { ...ALL, TG_CHANNEL_ID: "" };
  t.deepEqual(social.missingEnv("telegram", vars), ["TG_CHANNEL_ID"]);
  t.false(social.enabledChannels(vars).includes("telegram"));
});

test("Telegram posts only on its weekdays, Sundays by default", async (t) => {
  t.deepEqual(social.telegramWeekdays({}), [0]);
  const sunday = new Date("2026-10-11T16:00:00Z");
  const saturday = new Date("2026-10-10T16:00:00Z");
  t.true(social.postsOn("telegram", sunday, {}));
  t.false(social.postsOn("telegram", saturday, {}));
  t.true(social.postsOn("x", saturday, {}));

  const { fetch, calls } = mockFetch();
  const vars = { ...ALL, TELEGRAM_POST_WEEKDAYS: "0" };
  const result = await social.postStory(story("0xbb"), {
    fetch,
    vars,
    statePath,
    channels: ["telegram"],
    now: () => saturday.getTime(),
  });
  t.true(result.telegram.skipped);
  t.is(calls.length, 0);
});

test("Farcaster is enabled by either Neynar or hub variables", (t) => {
  t.deepEqual(social.missingEnv("farcaster", HUB), []);
  t.deepEqual(social.missingEnv("farcaster", ALL), []);
  t.regex(social.missingEnv("farcaster", {})[0], /NEYNAR_API_KEY, FC_SIGNER_UUID or FC_FID/);
});

test("sendCast falls back to the hub when Neynar fails", async (t) => {
  const { fetch, calls } = mockFetch({
    "api.neynar.com": { status: 402, body: '{"message":"payment required"}' },
    "hub.example.org": { status: 200, body: '{"hash":"0xbeef"}' },
  });
  const result = await social.sendCast("hi - a.com", ["https://k.com/s"], {
    fetch,
    vars: { ...ALL, ...HUB },
  });
  t.true(result.success);
  t.is(result.id, "0xbeef");
  t.is(calls.length, 2);
  t.is(calls[1].url, "https://hub.example.org:2281/v1/submitMessage");
  t.is(calls[1].options.headers["content-type"], "application/octet-stream");
  t.true(Buffer.isBuffer(calls[1].body) && calls[1].body.length > 64);
  // The Neynar failure is still logged.
  t.regex(errors[0], /Farcaster post failed: HTTP 402/);
});

test("sendCast uses the hub alone without Neynar variables", async (t) => {
  const { fetch, calls } = mockFetch({
    "hub.example.org": { status: 500, body: "hub down" },
  });
  const result = await social.sendCast("hi", [], { fetch, vars: HUB });
  t.false(result.success);
  t.is(calls.length, 1);
  t.regex(errors[0], /HTTP 500 hub: hub down/);
});
