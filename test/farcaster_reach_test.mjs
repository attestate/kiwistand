import test from "ava";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { Message } from "@farcaster/hub-nodejs";

import * as reach from "../src/farcaster-reach.mjs";
import { sendCastViaHub, FC_MAX_BYTES } from "../src/social-posting.mjs";

const ADDR = "0x" + "ab".repeat(20);
const OTHER = "0x" + "cd".repeat(20);

// A hub reader backed by plain objects: names → { fid, owner },
// fid → verified addresses, fid → X username, custody address → fid.
function fakeReader({ names = {}, verified = {}, twitter = {}, custody = {} } = {}) {
  const calls = [];
  return {
    calls,
    async nameProof(name) {
      calls.push(["nameProof", name]);
      return names[name] ? { owner: "", ...names[name] } : null;
    },
    async verifiedAddresses(fid) {
      calls.push(["verifiedAddresses", fid]);
      return verified[fid] || [];
    },
    async twitterOf(fid) {
      calls.push(["twitterOf", fid]);
      return twitter[fid] || null;
    },
    async custodyFid(address) {
      calls.push(["custodyFid", address]);
      return custody[address] || null;
    },
  };
}

const bytes = (s) => Buffer.byteLength(s, "utf8");

// --- Author identification ---------------------------------------------

test("farcasterNameFromUrl reads profile and cast links only", (t) => {
  t.is(reach.farcasterNameFromUrl("https://farcaster.xyz/alice/0xabc12345"), "alice");
  t.is(reach.farcasterNameFromUrl("https://warpcast.com/Alice"), "alice");
  t.is(reach.farcasterNameFromUrl("https://farcaster.xyz/vitalik.eth/0x1234abcd"), "vitalik.eth");
  t.is(reach.farcasterNameFromUrl("https://farcaster.xyz/~/channel/ethereum"), null);
  t.is(reach.farcasterNameFromUrl("https://farcaster.xyz/miniapps/abc/xyz"), null);
  t.is(reach.farcasterNameFromUrl("https://farcaster.xyz/alice/not-a-hash"), null);
  t.is(reach.farcasterNameFromUrl("https://example.com/alice"), null);
});

test("identifyAuthor: Farcaster cast link resolves the fname on the hub", async (t) => {
  const reader = fakeReader({ names: { alice: { fid: 42 } } });
  const author = await reach.identifyAuthor(
    { href: "https://farcaster.xyz/alice/0xabc12345" },
    reader,
  );
  t.deepEqual(author, { fid: 42, source: "farcaster-link" });
});

test("identifyAuthor: Farcaster link whose cast metadata names someone else is skipped", async (t) => {
  const reader = fakeReader({ names: { alice: { fid: 42 }, bob: { fid: 7 } } });
  const author = await reach.identifyAuthor(
    {
      href: "https://farcaster.xyz/alice/0xabc12345",
      metadata: { farcasterCast: { author: { username: "bob" } } },
    },
    reader,
  );
  t.is(author, null);
});

test("identifyAuthor: unknown fname gives no author", async (t) => {
  const author = await reach.identifyAuthor(
    { href: "https://farcaster.xyz/nobody/0xabc12345" },
    fakeReader(),
  );
  t.is(author, null);
});

test("identifyAuthor: X handle only counts when the fname holder lists that X account", async (t) => {
  const reader = fakeReader({
    names: { alice: { fid: 42 }, bob: { fid: 7 } },
    twitter: { 42: "Alice", 7: "someoneelse" },
  });
  t.deepEqual(
    await reach.identifyAuthor(
      { href: "https://x.com/Alice/status/123" },
      reader,
    ),
    { fid: 42, source: "x-link" },
  );
  t.deepEqual(
    await reach.identifyAuthor(
      { href: "https://blog.example/post", metadata: { twitterCreator: "@alice" } },
      reader,
    ),
    { fid: 42, source: "twitter-creator" },
  );
  // Same name on Farcaster, but a different X account in the profile.
  t.is(
    await reach.identifyAuthor(
      { href: "https://blog.example/post", metadata: { twitterCreator: "@bob" } },
      reader,
    ),
    null,
  );
  // No X account in the profile at all.
  t.is(
    await reach.identifyAuthor(
      { href: "https://x.com/carol/status/1" },
      fakeReader({ names: { carol: { fid: 9 } } }),
    ),
    null,
  );
});

test("identifyAuthor: mirror.xyz address needs a protocol verification", async (t) => {
  const href = `https://mirror.xyz/${ADDR}/digest`;
  const verified = fakeReader({ verified: { 42: [ADDR] } });
  t.deepEqual(
    await reach.identifyAuthor({ href }, verified, {
      resolveProfile: async () => ({ farcaster: { fid: 42 } }),
    }),
    { fid: 42, source: "mirror-address" },
  );
  // The cached profile claims fid 42, but 42 never verified the address.
  const unverified = fakeReader({ verified: { 42: [OTHER] } });
  t.is(
    await reach.identifyAuthor({ href }, unverified, {
      resolveProfile: async () => ({ farcaster: { fid: 42 } }),
    }),
    null,
  );
});

test("identifyAuthor: mirror.xyz ENS name uses the ENS username proof", async (t) => {
  const reader = fakeReader({ names: { "alice.eth": { fid: 42, owner: ADDR } } });
  t.deepEqual(
    await reach.identifyAuthor({ href: "https://mirror.xyz/alice.eth/digest" }, reader),
    { fid: 42, source: "mirror-ens" },
  );
});

test("identifyAuthor: the submitter counts only for text posts and registered writers", async (t) => {
  const reader = fakeReader({ verified: { 42: [ADDR] } });
  const submitter = { farcaster: { fid: 42 } };
  t.deepEqual(
    await reach.identifyAuthor(
      { href: "https://blog.example/post", isOriginal: true, identity: ADDR, submitter },
      reader,
    ),
    { fid: 42, source: "writer-domain" },
  );
  t.deepEqual(
    await reach.identifyAuthor(
      { href: "data:text/plain;base64,aGk=", identity: ADDR, submitter },
      reader,
    ),
    { fid: 42, source: "text-post" },
  );
  // Submitted someone else's article: never tag the submitter.
  t.is(
    await reach.identifyAuthor(
      { href: "https://blog.example/post", isOriginal: false, identity: ADDR, submitter },
      reader,
    ),
    null,
  );
});

test("fidForAddress: ENS proof must be owned by the address, custody as last resort", async (t) => {
  const reader = fakeReader({
    names: { "alice.eth": { fid: 42, owner: OTHER } },
    custody: { [ADDR]: 99 },
  });
  t.is(await reach.fidForAddress(ADDR, reader, { ens: "alice.eth" }), 99);
  const owned = fakeReader({ names: { "alice.eth": { fid: 42, owner: ADDR } } });
  t.is(await reach.fidForAddress(ADDR, owned, { ens: "alice.eth" }), 42);
  t.is(await reach.fidForAddress("not-an-address", owned, {}), null);
});

test("hubReader parses hub answers", async (t) => {
  const answers = {
    "/v1/userNameProofByName": { fid: 3, owner: "0xAA", type: "USERNAME_TYPE_FNAME" },
    "/v1/verificationsByFid": {
      messages: [
        { data: { verificationAddAddressBody: { address: "0xABC", protocol: "PROTOCOL_ETHEREUM" } } },
        { data: { verificationAddAddressBody: { address: "Sol1", protocol: "PROTOCOL_SOLANA" } } },
      ],
    },
    "/v1/userDataByFid": {
      messages: [
        { data: { userDataBody: { type: "USER_DATA_TYPE_DISPLAY", value: "Dan" } } },
        { data: { userDataBody: { type: "USER_DATA_TYPE_TWITTER", value: "dwr" } } },
      ],
    },
    "/v1/onChainIdRegistryEventByAddress": { fid: 5, idRegisterEventBody: { to: ADDR } },
    "/v1/onChainEventsByFid": {
      events: [{ blockNumber: 1, idRegisterEventBody: { to: ADDR } }],
    },
  };
  const urls = [];
  const fetch = async (url) => {
    urls.push(url);
    const route = new URL(url).pathname;
    return { ok: true, json: async () => answers[route] };
  };
  const reader = reach.hubReader({ fetch, vars: { FC_HUB_URL: "https://hub.example/" } });
  t.deepEqual(await reader.nameProof("dwr"), { fid: 3, owner: "0xaa", type: "USERNAME_TYPE_FNAME" });
  t.deepEqual(await reader.verifiedAddresses(3), ["0xabc"]);
  t.is(await reader.twitterOf(3), "dwr");
  t.is(await reader.custodyFid(ADDR), 5);
  t.true(urls[0].startsWith("https://hub.example/v1/userNameProofByName?name=dwr"));

  const down = reach.hubReader({
    fetch: async () => ({ ok: false, status: 404, json: async () => ({}) }),
    vars: { FC_HUB_URL: "https://hub.example" },
  });
  t.is(await down.nameProof("x"), null);
  t.deepEqual(await down.verifiedAddresses(1), []);
});

// --- Channels -----------------------------------------------------------

test("channelFor maps keywords to registered channel parent URLs", (t) => {
  t.is(reach.channelFor("Farcaster ships Snapchain v2").id, "farcaster");
  t.is(
    reach.channelFor("Farcaster ships Snapchain v2").parentUrl,
    "chain://eip155:7777777/erc721:0x4f86113fc3e9783cf3ec9a552cbb566716a57628",
  );
  t.is(reach.channelFor("Why we deployed on Base").parentUrl, "https://onchainsummer.xyz");
  t.is(reach.channelFor("Claude writes Solidity").id, "ai");
  t.is(reach.channelFor("Uniswap v5 hooks explained").id, "defi");
  t.is(reach.channelFor("The Fusaka upgrade and Ethereum blobs").parentUrl, "https://ethereum.org");
  t.is(reach.channelFor("A new TypeScript compiler").id, "dev");
  t.is(reach.channelFor("My garden in autumn"), null);
  // No false hits inside words.
  t.is(reach.channelFor("A database of baseball stats"), null);
  t.is(reach.channelFor("Said the main character"), null);
  // The summary sentence counts too.
  t.is(reach.channelFor("A long read", "It explains Ethereum rollups.").id, "ethereum");
});

// --- Cast text ----------------------------------------------------------

test("buildPingCast puts the mention at the byte offset after 'by '", (t) => {
  const cast = reach.buildPingCast({
    title: "Über ünicode 🥝 title",
    rank: 2,
    url: "https://news.kiwistand.com/stories/x?index=0x1",
    authorFid: 42,
  });
  t.is(cast.text, "Über ünicode 🥝 title is #2 on Kiwi News today 🥝\n\nby ");
  t.deepEqual(cast.mentions, [42]);
  t.deepEqual(cast.mentionsPositions, [bytes(cast.text)]);
  t.deepEqual(cast.embeds, ["https://news.kiwistand.com/stories/x?index=0x1"]);
  t.is(cast.parentUrl, undefined);
});

test("buildPingCast without an author has no mention", (t) => {
  const cast = reach.buildPingCast({ title: "hello", rank: 1, url: "u" });
  t.is(cast.text, "Hello is #1 on Kiwi News today 🥝");
  t.deepEqual(cast.mentions, []);
  t.deepEqual(cast.mentionsPositions, []);
});

test("buildPingCast shortens long titles to 320 bytes", (t) => {
  const cast = reach.buildPingCast({
    title: "🥝".repeat(200),
    rank: 3,
    url: "u",
    authorFid: 1,
  });
  t.true(bytes(cast.text) <= FC_MAX_BYTES);
  t.true(cast.text.endsWith("… is #3 on Kiwi News today 🥝\n\nby "));
  t.is(cast.mentionsPositions[0], bytes(cast.text));
});

test("buildRisingCast adds the first summary sentence and the channel", (t) => {
  const channel = reach.channelFor("Ethereum gas limit");
  const cast = reach.buildRisingCast({
    title: "ethereum gas limit",
    summary: "The gas limit doubles. More details follow here.",
    url: "u",
    channel,
  });
  t.is(cast.text, "Ethereum gas limit\n\nThe gas limit doubles.");
  t.is(cast.parentUrl, "https://ethereum.org");
  const long = reach.buildRisingCast({
    title: "x".repeat(300),
    summary: "A sentence that won't fit anymore.",
    url: "u",
  });
  t.true(bytes(long.text) <= FC_MAX_BYTES);
  t.false(long.text.includes("sentence"));
  t.is(long.parentUrl, undefined);
});

// --- Sending ------------------------------------------------------------

test("sendCastViaHub signs mentions and parentUrl into the cast", async (t) => {
  let body;
  const fetch = async (url, options) => {
    body = options.body;
    return { ok: true, status: 200, text: async () => '{"hash":"0xbeef"}' };
  };
  const cast = reach.buildPingCast({ title: "Hi", rank: 1, url: "https://k.example/s", authorFid: 42 });
  const result = await sendCastViaHub(cast.text, cast.embeds, {
    fetch,
    vars: {
      FC_FID: "1234",
      FC_SIGNER_PRIVATE_KEY: "0x" + "11".repeat(32),
      FC_HUB_URL: "https://hub.example",
    },
    mentions: cast.mentions,
    mentionsPositions: cast.mentionsPositions,
    parentUrl: "https://ethereum.org",
  });
  t.true(result.success);
  const message = Message.decode(new Uint8Array(body));
  const add = message.data.castAddBody;
  t.deepEqual(add.mentions, [42]);
  t.deepEqual(add.mentionsPositions, [bytes(cast.text)]);
  t.is(add.parentUrl, "https://ethereum.org");
  t.is(add.text, cast.text);
});

// --- Runs, dedupe and caps ------------------------------------------------

function tmp(t) {
  const dir = mkdtempSync(path.join(tmpdir(), "fc-reach-"));
  t.teardown(() => rmSync(dir, { recursive: true, force: true }));
  return {
    statePath: path.join(dir, "reach.json"),
    socialStatePath: path.join(dir, "social.json"),
  };
}

const NOW = Date.parse("2026-10-24T12:00:00Z");
const s = (n, extra = {}) => ({
  index: `0x${n}`,
  title: `Story ${n}`,
  href: `https://example.com/${n}`,
  upvotes: 5,
  timestamp: NOW / 1000 - 3600,
  ...extra,
});

function recorder() {
  const casts = [];
  const send = async (cast) => {
    casts.push(cast);
    return { success: true, id: `0x${casts.length}` };
  };
  return { casts, send };
}

test("runAuthorPings records a baseline first, then pings new top 3 entries once", async (t) => {
  const paths = tmp(t);
  const { casts, send } = recorder();
  let feed = [s("a"), s("b"), s("c"), s("d")];
  const options = {
    ...paths,
    send,
    reader: fakeReader(),
    vars: { FC_FID: "13442" },
    now: () => NOW,
    getHotStories: async () => feed,
  };
  t.deepEqual(await reach.runAuthorPings(options), []);
  t.is(casts.length, 0);

  feed = [s("a"), s("d"), s("b")];
  const sent = await reach.runAuthorPings(options);
  t.is(sent.length, 1);
  t.is(casts[0].text, "Story d is #2 on Kiwi News today 🥝");

  // Leaves the top 3 and comes back: no second ping.
  feed = [s("a"), s("b"), s("c")];
  await reach.runAuthorPings(options);
  feed = [s("d"), s("a"), s("b")];
  await reach.runAuthorPings(options);
  t.is(casts.length, 1);
  const state = JSON.parse(readFileSync(paths.statePath, "utf8"));
  t.is(state.pings.d.rank, 2);
  t.is(state.pings.d.hash, "0x1");
});

test("runAuthorPings stops at the daily cap and skips stories cast elsewhere", async (t) => {
  const paths = tmp(t);
  writeFileSync(
    paths.socialStatePath,
    JSON.stringify({ posted: { s1: { farcaster: NOW } } }),
  );
  const { casts, send } = recorder();
  let feed = [s("x"), s("y"), s("z")];
  const options = {
    ...paths,
    send,
    reader: fakeReader(),
    vars: { FC_FID: "13442", FC_AUTHOR_PINGS_PER_DAY: "3" },
    now: () => NOW,
    getHotStories: async () => feed,
  };
  await reach.runAuthorPings(options); // baseline
  feed = [s("s1"), s("p1"), s("p2")];
  await reach.runAuthorPings(options);
  t.is(casts.length, 2, "the daily top story s1 isn't pinged");
  feed = [s("p3"), s("p4"), s("p5")];
  await reach.runAuthorPings(options);
  t.is(casts.length, 3, "only one more fits under the cap of 3");

  // The next UTC day the cap resets, but skipped stories stay skipped.
  const tomorrow = { ...options, now: () => NOW + 24 * 60 * 60 * 1000 };
  await reach.runAuthorPings(tomorrow);
  t.is(casts.length, 3);
  feed = [s("p6"), s("p4"), s("p5")];
  await reach.runAuthorPings(tomorrow);
  t.is(casts.length, 4);
});

test("runAuthorPings mentions a confident author and never the Kiwi account itself", async (t) => {
  const paths = tmp(t);
  const { casts, send } = recorder();
  let feed = [s("a"), s("b"), s("c")];
  const reader = fakeReader({ names: { alice: { fid: 42 }, kiwi: { fid: 13442 } } });
  const options = {
    ...paths,
    send,
    reader,
    vars: { FC_FID: "13442" },
    now: () => NOW,
    getHotStories: async () => feed,
  };
  await reach.runAuthorPings(options);
  feed = [
    s("f", { href: "https://farcaster.xyz/alice/0x1234abcd" }),
    s("k", { href: "https://farcaster.xyz/kiwi/0x1234abcd" }),
    s("a"),
  ];
  await reach.runAuthorPings(options);
  t.deepEqual(casts[0].mentions, [42]);
  t.true(casts[0].text.endsWith("\n\nby "));
  t.deepEqual(casts[1].mentions, []);
});

test("runAuthorPings fails soft", async (t) => {
  const paths = tmp(t);
  const options = {
    ...paths,
    vars: { FC_FID: "1" },
    now: () => NOW,
    reader: fakeReader(),
    send: async () => {
      throw new Error("boom");
    },
    getHotStories: async () => {
      throw new Error("feed down");
    },
  };
  t.deepEqual(await reach.runAuthorPings(options), []);
  let feed = [s("a")];
  options.getHotStories = async () => feed;
  await reach.runAuthorPings(options);
  feed = [s("b")];
  t.deepEqual(await reach.runAuthorPings(options), []);
});

test("runRisingCast picks the best fresh story never cast and casts it once", async (t) => {
  const paths = tmp(t);
  writeFileSync(
    paths.socialStatePath,
    JSON.stringify({ posted: { top: { farcaster: NOW } } }),
  );
  const { casts, send } = recorder();
  const stories = [
    s("old", { timestamp: NOW / 1000 - 30 * 3600 }),
    s("top"),
    s("weak", { upvotes: 1 }),
    s("good", { title: "Uniswap launches v5" }),
    s("next"),
  ];
  const options = {
    ...paths,
    send,
    vars: {},
    now: () => NOW,
    getStories: async () => stories,
    withSummary: async (story) => ({
      ...story,
      summary: "Hooks get cheaper. Second sentence.",
    }),
  };
  const first = await reach.runRisingCast(options);
  t.is(first.story.index, "0xgood");
  t.is(casts[0].text, "Uniswap launches v5\n\nHooks get cheaper.");
  t.is(casts[0].parentUrl, "https://farcaster.group/defi");
  const second = await reach.runRisingCast(options);
  t.is(second.story.index, "0xnext");
  t.is(casts[1].parentUrl, undefined);
  t.is(await reach.runRisingCast(options), null);
  t.is(casts.length, 2);
});

test("pickRising skips stories already pinged", async (t) => {
  const state = { pings: { a: { at: NOW } }, rising: {}, seenTop: {} };
  const story = await reach.pickRising([s("a"), s("b")], state, null, { now: NOW });
  t.is(story.index, "0xb");
});

test("flags default off and the scheduler does nothing without them", (t) => {
  t.false(reach.authorPingsEnabled({}));
  t.false(reach.risingCastsEnabled({ FC_RISING_CASTS: "1" }));
  t.true(reach.authorPingsEnabled({ FC_AUTHOR_PINGS: "true" }));
  t.deepEqual(reach.startFarcasterReach({ vars: {} }), []);
  t.deepEqual(
    reach.startFarcasterReach({ vars: { FC_AUTHOR_PINGS: "true" } }),
    [],
    "no hub configured",
  );
  t.deepEqual(reach.risingHours({}), [10, 20]);
  t.is(reach.pingsPerDay({}), 3);
});

test("runAuthorPings records peak ranks and embeds the writer's leaderboard row", async (t) => {
  const paths = tmp(t);
  const { casts, send } = recorder();
  let feed = [s("a"), s("b"), s("c")];
  const options = {
    ...paths,
    send,
    reader: fakeReader({ names: { alice: { fid: 42 } } }),
    vars: { FC_FID: "13442" },
    now: () => NOW,
    getHotStories: async () => feed,
    writerEntryUrl: async () => "https://news.kiwistand.com/writers?month=2026-10#w-x",
  };
  await reach.runAuthorPings(options);
  feed = [s("b"), s("f", { href: "https://farcaster.xyz/alice/0x1234abcd" }), s("n")];
  await reach.runAuthorPings(options);
  const state = JSON.parse(readFileSync(paths.statePath, "utf8"));
  t.deepEqual(
    Object.fromEntries(Object.entries(state.peak).map(([k, v]) => [k, v.rank])),
    { a: 1, b: 1, c: 3, f: 2, n: 3 },
  );
  t.deepEqual(casts[0].embeds, [
    "https://news.kiwistand.com/stories/Story-f?index=0xf",
    "https://news.kiwistand.com/writers?month=2026-10#w-x",
  ]);
  // No tagged author, no leaderboard embed.
  t.is(casts[1].embeds.length, 1);
});
