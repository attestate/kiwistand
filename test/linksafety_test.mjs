// @format
import test from "ava";
import { env } from "process";

import { initializeLtCache, lifetimeCache } from "../src/cache.mjs";
import * as linksafety from "../src/linksafety.mjs";
import { moderate } from "../src/views/moderation.mjs";

initializeLtCache();

function json(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function chainPatrolMock(statusByUrl) {
  const calls = [];
  const fetchFn = async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url, headers: options.headers, body });
    if (url !== linksafety.CHAINPATROL_URL) throw new Error("unexpected url");
    const status = statusByUrl[body.content] || "UNKNOWN";
    if (status === "ERROR") return json({}, 500);
    return json({
      status,
      source: "chainpatrol",
      sources: [
        { source: "chainpatrol", status },
        { source: "eth-phishing-detect", status },
      ],
    });
  };
  return { calls, fetchFn };
}

test.beforeEach(() => {
  env.LINK_SAFETY_DISABLED = "false";
  delete env.CHAINPATROL_API_KEY;
  delete env.GOOGLE_SAFE_BROWSING_KEY;
  for (const key of lifetimeCache.keys("linksafety:")) lifetimeCache.del(key);
  linksafety._resetForTests();
});

test.afterEach.always(() => {
  env.LINK_SAFETY_DISABLED = "true";
});

test("isKnownSafe matches allowlisted domains and their subdomains only", (t) => {
  t.true(linksafety.isKnownSafe("https://x.com/vitalik/status/1"));
  t.true(linksafety.isKnownSafe("https://www.youtube.com/watch?v=1"));
  t.true(linksafety.isKnownSafe("https://vitalik.substack.com/p/post"));
  t.true(linksafety.isKnownSafe("https://en.wikipedia.org/wiki/Ethereum"));
  t.true(linksafety.isKnownSafe("https://X.COM./a"));

  t.false(linksafety.isKnownSafe("https://evil-x.com/login"));
  t.false(linksafety.isKnownSafe("https://x.com.evil.io/login"));
  t.false(linksafety.isKnownSafe("https://notgithub.com/"));
  t.false(linksafety.isKnownSafe("https://phish.github.io/"));
  t.false(linksafety.isKnownSafe("javascript:alert(1)"));
  t.false(linksafety.isKnownSafe("data:text/plain,hello"));
  t.false(linksafety.isKnownSafe("not a url"));
});

test("checkLink skips allowlisted and non-http links without fetching", async (t) => {
  const { calls, fetchFn } = chainPatrolMock({});
  t.is(await linksafety.checkLink("https://x.com/a", { fetchFn }), "safe");
  t.is(
    await linksafety.checkLink("data:text/plain,hi", { fetchFn }),
    "unknown",
  );
  t.is(await linksafety.checkLink("kiwi:0xabc", { fetchFn }), "unknown");
  t.is(calls.length, 0);
});

test("checkLink maps ChainPatrol statuses and caches verdicts", async (t) => {
  const bad = "https://opensea.support/login";
  const good = "https://example.org/post";
  const meh = "https://some-blog.dev/post";
  const { calls, fetchFn } = chainPatrolMock({
    [bad]: "BLOCKED",
    [good]: "ALLOWED",
  });

  t.is(await linksafety.checkLink(bad, { fetchFn }), "blocked");
  t.is(await linksafety.checkLink(good, { fetchFn }), "safe");
  t.is(await linksafety.checkLink(meh, { fetchFn }), "unknown");
  t.is(calls.length, 3);
  t.deepEqual(calls[0].body, { type: "URL", content: bad });
  t.is(calls[0].headers["X-API-KEY"], undefined);

  // Cached: no further requests
  t.is(await linksafety.checkLink(bad, { fetchFn }), "blocked");
  t.is(await linksafety.checkLink(good, { fetchFn }), "safe");
  t.is(await linksafety.checkLink(meh, { fetchFn }), "unknown");
  t.is(calls.length, 3);

  t.true(linksafety.isBlocked(bad));
  t.false(linksafety.isBlocked(good));
  t.false(linksafety.isBlocked(meh));

  const verdict = linksafety.getVerdict(bad);
  t.is(verdict.status, "blocked");
  t.true(verdict.fresh);
  t.regex(verdict.reason, /chainpatrol: BLOCKED by chainpatrol, eth-phishing-detect/);
  t.deepEqual(
    linksafety.listBlocked().map(({ url }) => url),
    [bad],
  );
});

test("checkLink sends the API key and dedupes in-flight requests", async (t) => {
  env.CHAINPATROL_API_KEY = "secret";
  const { calls, fetchFn } = chainPatrolMock({});
  const url = "https://dedupe.example/x";
  const results = await Promise.all([
    linksafety.checkLink(url, { fetchFn }),
    linksafety.checkLink(url, { fetchFn }),
    linksafety.checkLink(url, { fetchFn }),
  ]);
  t.deepEqual(results, ["unknown", "unknown", "unknown"]);
  t.is(calls.length, 1);
  t.is(calls[0].headers["X-API-KEY"], "secret");
});

test("stale verdicts are re-checked and expire by status", async (t) => {
  const url = "https://was-fine.example/";
  const key = "linksafety:" + "https://was-fine.example";
  lifetimeCache.set(key, {
    url,
    status: "safe",
    reason: "",
    checkedAt: Date.now() - linksafety.TTL.safe - 1,
  });
  t.false(linksafety.getVerdict(url).fresh);

  const { calls, fetchFn } = chainPatrolMock({ [url]: "BLOCKED" });
  t.is(await linksafety.checkLink(url, { fetchFn }), "blocked");
  t.is(calls.length, 1);

  // A blocked verdict stays fresh far longer than a safe one.
  lifetimeCache.set(key, {
    ...lifetimeCache.get(key),
    checkedAt: Date.now() - linksafety.TTL.safe - 1,
  });
  t.true(linksafety.getVerdict(url).fresh);
});

test("provider errors don't block and keep a previous blocked verdict", async (t) => {
  const url = "https://flaky.example/";
  const { fetchFn } = chainPatrolMock({ [url]: "ERROR" });
  t.is(await linksafety.checkLink(url, { fetchFn }), "unknown");
  t.true(linksafety.getVerdict(url).error);

  const key = "linksafety:https://flaky.example";
  lifetimeCache.set(key, {
    url,
    status: "blocked",
    reason: "chainpatrol: BLOCKED by chainpatrol",
    checkedAt: Date.now() - linksafety.TTL.blocked - 1,
  });
  t.is(await linksafety.checkLink(url, { fetchFn }), "blocked");
  t.true(linksafety.isBlocked(url));
});

test("Google Safe Browsing blocks when it reports a match", async (t) => {
  env.GOOGLE_SAFE_BROWSING_KEY = "gsb";
  const url = "https://malware.example/";
  const fetchFn = async (target, options) => {
    if (target === linksafety.CHAINPATROL_URL) {
      return json({ status: "UNKNOWN", source: "chainpatrol", sources: [] });
    }
    t.true(target.startsWith(linksafety.SAFE_BROWSING_URL));
    t.true(target.endsWith("?key=gsb"));
    const body = JSON.parse(options.body);
    t.deepEqual(body.threatInfo.threatEntries, [{ url }]);
    return json({ matches: [{ threatType: "MALWARE" }] });
  };
  t.is(await linksafety.checkLink(url, { fetchFn }), "blocked");
  t.regex(linksafety.getVerdict(url).reason, /google-safe-browsing: MALWARE/);
});

test("disabled link safety never blocks", async (t) => {
  const url = "https://opensea.support/login";
  const { fetchFn } = chainPatrolMock({ [url]: "BLOCKED" });
  t.is(await linksafety.checkLink(url, { fetchFn }), "blocked");
  env.LINK_SAFETY_DISABLED = "true";
  t.false(linksafety.isBlocked(url));
});

test("moderate hides stories whose link is blocked", async (t) => {
  const bad = "https://opensea.support/login";
  const { fetchFn } = chainPatrolMock({ [bad]: "BLOCKED" });
  await linksafety.checkLink(bad, { fetchFn });

  const config = { titles: {}, hrefs: {}, addresses: [], links: [] };
  const identity = "0x0000000000000000000000000000000000000001";
  const leaves = [
    { href: bad, title: "free mint", identity },
    { href: "https://x.com/a", title: "tweet", identity },
    { href: "data:text/plain,hello", title: "text", identity },
  ];
  const result = moderate(leaves, config, "/");
  t.deepEqual(
    result.map(({ title }) => title),
    ["tweet", "text"],
  );
});
