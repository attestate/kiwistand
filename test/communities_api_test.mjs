// @format
// The read side of communities: GET /api/v1/communities(/:owner/:key), the
// feed rules (Kiwi News' feeds and a community's), the `community` object on
// stories, the `community` query and the /c/:owner/:key page.
import { env } from "process";
import { join } from "path";
import { randomBytes } from "crypto";

import test from "ava";
import { sub } from "date-fns";
import { utils } from "ethers";
import Database from "better-sqlite3";

import * as cache from "../src/cache.mjs";
import * as api from "../src/communities-api.mjs";
import * as page from "../src/views/community.mjs";
import { index } from "../src/views/feed.mjs";
import * as newest from "../src/views/new.mjs";
import * as best from "../src/views/best.mjs";
import { nameKey } from "../src/communities.mjs";

const db = new Database(join(env.CACHE_DIR, "database.db"));
const HOST = "https://communities-api.example";
const DAY = 24 * 60 * 60;
const now = () => Math.floor(Date.now() / 1000);
const hex = (bytes) => randomBytes(bytes).toString("hex");
const address = () => `0x${hex(20)}`;
const upper = (address) => `0x${address.slice(2).toUpperCase()}`;

test.before(() => {
  // NOTE: Only the tables these tests read, without the foreign keys of
  // cache.initialize: the test database is shared with other test files.
  cache.initializeLtCache();
  for (const table of [
    `submissions (id TEXT PRIMARY KEY NOT NULL, href TEXT NOT NULL UNIQUE, title TEXT NOT NULL, timestamp INTEGER NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL, community TEXT)`,
    `upvotes (id TEXT PRIMARY KEY NOT NULL, href TEXT NOT NULL, timestamp INTEGER NOT NULL, title TEXT NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL)`,
    `comments (id TEXT PRIMARY KEY NOT NULL, submission_id TEXT NOT NULL, timestamp INTEGER NOT NULL, title TEXT NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL)`,
    `fingerprints (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL, hash TEXT NOT NULL, timestamp INTEGER NOT NULL)`,
  ]) {
    db.exec(`CREATE TABLE IF NOT EXISTS ${table}`);
  }
  cache.initializeImpressions();
  cache.initializeShares();
  cache.initializeCommunities();
});

const versions = [];
test.after.always(() => {
  db.prepare(`DELETE FROM upvotes WHERE href LIKE ?`).run(`${HOST}/%`);
  db.prepare(`DELETE FROM submissions WHERE href LIKE ?`).run(`${HOST}/%`);
  for (const version of versions.reverse()) cache.restoreCommunity(version);
});

// A community signed by `signer` (an address), its ID as posts name it.
function community(signer, overrides = {}) {
  const message = {
    index: hex(36),
    name: "Agent Builders",
    about: "Links about building agents.",
    rules: ["Link to the original source.", "No price talk."],
    icon: "robot",
    color: "#6E56CF",
    timestamp: now() - 60 * DAY,
    signer,
    ...overrides,
  };
  versions.push(cache.insertCommunity(message));
  return `${signer.toLowerCase()}/${nameKey(message.name)}`;
}

// A story submitted by `identity`, to `community` if set, with `upvotes` as
// the feeds count them (the submission is one).
function story({ identity = address(), community, age = 0, upvotes = 1, title }) {
  const index = hex(36);
  const href = `${HOST}/${index.slice(0, 20)}`;
  const timestamp = now() - age;
  title = title ?? `Story ${index.slice(0, 8)}`;
  cache.insertMessage({
    type: "amplify",
    href,
    index,
    title,
    timestamp,
    signature: "0x00",
    signer: identity,
    identity,
    ...(community ? { community } : {}),
  });
  for (let i = 1; i < upvotes; i++) {
    const voter = address();
    cache.insertMessage({
      type: "amplify",
      href,
      index: hex(36),
      title,
      timestamp: timestamp + i,
      signature: "0x00",
      signer: voter,
      identity: voter,
    });
  }
  return { index, href, title, timestamp };
}

const named = new Map();
const deps = {
  delegations: async () => ({}),
  getLists: async () => ({ addresses: [] }),
  resolve: async (owner) =>
    named.has(owner.toLowerCase())
      ? { ens: named.get(owner.toLowerCase()), displayName: named.get(owner.toLowerCase()) }
      : { displayName: `${owner.slice(0, 6)}...${owner.slice(-4)}` },
};

function reply() {
  const r = { statusCode: 200, headers: {}, locals: {} };
  r.status = (code) => ((r.statusCode = code), r);
  r.header = (name, value) => ((r.headers[name] = value), r);
  r.type = (type) => ((r.contentType = type), r);
  r.json = (body) => ((r.body = body), r);
  r.send = (body) => ((r.body = body), r);
  return r;
}

const hrefs = (stories) => stories.map((story) => story.href);

// --- GET /api/v1/communities ------------------------------------------------

test.serial("the list has the Community objects, most active first", async (t) => {
  const owner = address();
  named.set(owner, "builder.eth");
  const quiet = community(owner, { name: "Quiet", timestamp: now() - 30 * DAY });
  const newer = community(owner, { name: "Newer", timestamp: now() - 10 * DAY });
  const busy = community(owner, { name: "Busy", timestamp: now() - 50 * DAY });
  const older = community(owner, { name: "Older", timestamp: now() - 40 * DAY });
  story({ community: older, age: 2 * DAY });
  const latest = story({ community: busy, age: DAY });
  story({ community: busy, age: 3 * DAY });

  const list = await api.listCommunities({ owner }, deps);
  t.deepEqual(
    list.map(({ id }) => id),
    [busy, older, newer, quiet],
  );
  const [first] = list;
  t.deepEqual(Object.keys(first), [
    "id",
    "owner",
    "ownerName",
    "name",
    "about",
    "rules",
    "icon",
    "color",
    "created",
    "timestamp",
    "stories",
    "lastStory",
    "members",
  ]);
  t.is(first.owner, utils.getAddress(owner));
  t.is(first.ownerName, "builder.eth");
  t.is(first.name, "Busy");
  t.deepEqual(first.rules, ["Link to the original source.", "No price talk."]);
  t.is(first.icon, "robot");
  t.is(first.color, "#6E56CF");
  t.is(first.stories, 2);
  t.is(first.lastStory, latest.timestamp);
  t.is(list[2].stories, 0);
  t.is(list[2].lastStory, null);
});

test.serial("the list takes the owner in any case, and has no name for an owner without one", async (t) => {
  const owner = address();
  const id = community(owner, { name: "Case" });
  for (const spelling of [owner, upper(owner)]) {
    const list = await api.listCommunities({ owner: spelling }, deps);
    t.deepEqual(list.map(({ id }) => id), [id]);
    t.is(list[0].ownerName, null);
  }
  t.deepEqual(await api.listCommunities({ owner: address() }, deps), []);
});

test.serial("the list searches name and about, ignoring case", async (t) => {
  const owner = address();
  const token = `Zebra${hex(4)}`;
  const byName = community(owner, { name: `${token} Club` });
  const byAbout = community(owner, {
    name: "Other",
    about: `All about ${token.toLowerCase()}s, für alle.`,
  });
  community(owner, { name: "Unrelated" });

  const found = await api.listCommunities({ q: token.toUpperCase() }, deps);
  t.deepEqual(found.map(({ id }) => id).sort(), [byName, byAbout].sort());
  const unicode = await api.listCommunities({ q: "FÜR ALLE", owner }, deps);
  t.deepEqual(unicode.map(({ id }) => id), [byAbout]);
});

test.serial("the list's limit defaults to 50 and stops at 200", async (t) => {
  t.is(api.parseLimit(undefined), 50);
  t.is(api.parseLimit("0"), 50);
  t.is(api.parseLimit("nope"), 50);
  t.is(api.parseLimit("3"), 3);
  t.is(api.parseLimit("500"), 200);

  const owner = address();
  for (const name of ["One", "Two", "Three"]) community(owner, { name });
  t.is((await api.listCommunities({ owner, limit: "2" }, deps)).length, 2);
});

test.serial("the list handler answers in the envelope, and 400 for a bad owner", async (t) => {
  const owner = address();
  const id = community(owner, { name: "Envelope" });
  const ok = reply();
  await api.listHandler(deps)({ query: { owner } }, ok);
  t.is(ok.statusCode, 200);
  t.is(ok.body.status, "success");
  t.is(ok.body.code, 200);
  t.deepEqual(ok.body.data.map(({ id }) => id), [id]);

  const bad = reply();
  await api.listHandler(deps)({ query: { owner: "vitalik.eth" } }, bad);
  t.is(bad.statusCode, 400);
  t.is(bad.body.status, "error");
});

test.serial("the list leaves out a banned owner's communities", async (t) => {
  const owner = address();
  community(owner, { name: "Banned" });
  const lists = async () => ({ addresses: [owner.toLowerCase()] });
  t.deepEqual(await api.listCommunities({ owner }, { ...deps, getLists: lists }), []);
});

// --- GET /api/v1/communities/:owner/:key ------------------------------------

test.serial("the detail is the newest version, created when the first one was", async (t) => {
  const owner = address();
  named.set(owner, "detail.eth");
  const created = now() - 20 * DAY;
  const updated = created + 15 * DAY;
  const id = community(owner, { name: "AI", timestamp: created });
  community(owner, { name: "ai", about: "updated", icon: "brain", timestamp: updated });
  const post = story({ community: id, age: DAY });

  const ok = reply();
  await api.detailHandler(deps)({ params: { owner: upper(owner), key: "ai" } }, ok);
  t.is(ok.statusCode, 200);
  t.like(ok.body.data, {
    id,
    ownerName: "detail.eth",
    name: "ai",
    about: "updated",
    icon: "brain",
    created,
    timestamp: updated,
    stories: 1,
    lastStory: post.timestamp,
  });
});

test.serial("the detail is 404 for a community that isn't known", async (t) => {
  const owner = address();
  community(owner, { name: "Known" });
  for (const params of [
    { owner, key: "unknown" },
    { owner: address(), key: "known" },
    { owner, key: "Known" },
    { owner: "nope", key: "known" },
  ]) {
    const r = reply();
    await api.detailHandler(deps)({ params }, r);
    t.is(r.statusCode, 404, JSON.stringify(params));
    t.is(r.body.status, "error");
  }
});

test.serial("a community signed with a delegated key is the account's", async (t) => {
  const account = address();
  const device = address();
  community(device, { name: "Delegated" });
  // NOTE: Delegations map checksummed addresses, as registry.delegations().
  const delegations = async () => ({
    [utils.getAddress(device)]: utils.getAddress(account),
  });
  const found = await api.findCommunity(account, "delegated", { ...deps, delegations });
  t.is(found.id, `${account.toLowerCase()}/delegated`);
  t.is(found.owner.toLowerCase(), account.toLowerCase());
});

// --- Feed rules ---------------------------------------------------------

test.serial("Kiwi News' New has every story, a community's ones included", async (t) => {
  const id = community(address(), { name: "New Rules" });
  const kiwi = story({});
  const fresh = story({ community: id });

  const listed = hrefs(cache.listNewest(500));
  t.true(listed.includes(kiwi.href));
  t.true(listed.includes(fresh.href));

  await newest.recompute();
  const page = hrefs(newest.getStories());
  t.true(page.includes(kiwi.href));
  t.true(page.includes(fresh.href));
});

test.serial("Kiwi News' Hot and Best rank a community's stories like any other", async (t) => {
  const id = community(address(), { name: "Top Rules" });
  const kiwi = story({ upvotes: 2, age: 3 * DAY });
  const few = story({ community: id, upvotes: 2, age: 3 * DAY });
  const many = story({ community: id, upvotes: 12, age: 3 * DAY });

  for (const listed of [
    hrefs(cache.listNewest(500)),
    hrefs(cache.getBest(500, 0, null, "", 0)),
  ]) {
    for (const { href } of [kiwi, few, many]) t.true(listed.includes(href));
  }

  // Hot as /api/v1/feed/rows computes it (no ENS, no engagement rules).
  const { stories: hot } = await index(
    null,
    999,
    undefined,
    sub(new Date(), { weeks: 6 }),
    false,
    false,
    "control",
    true,
    true,
  );
  for (const { href } of [kiwi, few, many]) t.true(hrefs(hot).includes(href));

  const week = await best.getStories(0, "week", "", { amount: 500 });
  for (const { href } of [kiwi, few, many]) t.true(hrefs(week).includes(href));
  // Ranked by upvotes, the community's popular story comes first.
  const ranked = hrefs(week);
  t.true(ranked.indexOf(many.href) < ranked.indexOf(kiwi.href));
});

test.serial("a community's feeds have only its stories", async (t) => {
  const id = community(address(), { name: "Only Mine" });
  const other = community(address(), { name: "Only Mine" });
  const mine = [
    story({ community: id, upvotes: 2, age: 2 * DAY - 60 }),
    story({ community: id, upvotes: 2, age: DAY }),
  ];
  story({ community: other, upvotes: 2 });
  story({ upvotes: 3 });

  const listed = cache.listNewest(500, undefined, cache.inCommunity(id));
  t.deepEqual(hrefs(listed), [mine[1].href, mine[0].href]);

  // Hot as the rows endpoint computes it (no ENS lookups).
  const { stories: hot } = await index(
    null, 0, undefined, sub(new Date(), { weeks: 3 }), false, false, "control", false, true,
    { community: id },
  );
  t.deepEqual(hrefs(hot).sort(), hrefs(mine).sort());

  const fresh = await newest.getCommunityStories(id);
  t.deepEqual(hrefs(fresh), [mine[1].href, mine[0].href]);
  t.truthy(fresh[0].submitter, "enriched like /new");

  const top = await best.getStories(0, "all", "", { community: id, amount: 50 });
  t.deepEqual(hrefs(top).sort(), hrefs(mine).sort());
});

test.serial("a community's Hot has Kiwi News' rules; its New has every story", async (t) => {
  const id = community(address(), { name: "Brand New" });
  const old = story({ community: id, age: 30 * DAY });
  const lonely = story({ community: id, age: 60 });
  const liked = story({ community: id, upvotes: 3 });

  // As /api/v1/communities/:owner/:key/feeds/hot asks for it, without ENS.
  const { stories } = await index(
    null, 0, undefined, sub(new Date(), { weeks: 3 }), false, false, "control", false, true,
    { community: id },
  );
  t.deepEqual(hrefs(stories), [liked.href]);

  const fresh = await newest.getCommunityStories(id);
  t.deepEqual(hrefs(fresh), [liked.href, lonely.href, old.href]);
});

test.serial("a community's Best works per period", async (t) => {
  const id = community(address(), { name: "Periods" });
  const today = story({ community: id, upvotes: 2, age: 60 * 60 });
  const lastMonth = story({ community: id, upvotes: 5, age: 20 * DAY });

  const day = await best.getStories(0, "day", "", { community: id, amount: 50 });
  t.deepEqual(hrefs(day), [today.href]);
  const month = await best.getStories(0, "month", "", { community: id, amount: 50 });
  t.deepEqual(hrefs(month), [lastMonth.href, today.href]);
});

test.serial("a community's feeds don't change Kiwi News' cached feeds", async (t) => {
  const id = community(address(), { name: "No Poison" });
  const mine = story({ community: id });
  const kiwi = story({ upvotes: 2 });

  await newest.recompute();
  const before = hrefs(newest.getStories());
  await newest.getCommunityStories(id);
  t.deepEqual(hrefs(newest.getStories()), before);
  // Kiwi News' New has both; the community's New didn't replace it.
  t.true(before.includes(kiwi.href));
  t.true(before.includes(mine.href));

  // Best memoizes Kiwi News' pages; a community's page with the same
  // period, page and amount must not take its place.
  const kiwiBest = await best.getStories(0, "day", "", { amount: 500 });
  const communityBest = await best.getStories(0, "day", "", { community: id, amount: 500 });
  t.deepEqual(hrefs(communityBest), [mine.href]);
  const again = await best.getStories(0, "day", "", { amount: 500 });
  t.deepEqual(hrefs(again), hrefs(kiwiBest));
  t.true(hrefs(again).includes(kiwi.href));
});

// --- The `community` object on stories ------------------------------------

test.serial("stories carry their community as an object, or null", async (t) => {
  const owner = address();
  const id = community(owner, { name: "Objects", icon: "planet", color: "#1F8A7A" });
  const post = story({ community: id });
  const kiwi = story({});
  const ref = { id, name: "Objects", icon: "planet", color: "#1F8A7A" };

  const listed = cache
    .listNewest(500, undefined)
    .filter(({ href }) => href === post.href || href === kiwi.href);
  t.is(listed.length, 2);
  t.false(listed.some((story) => "community" in story), "no bare ID");
  const stories = await api.withCommunities(listed, deps);
  t.deepEqual(stories.find(({ href }) => href === post.href).community, ref);
  t.is(stories.find(({ href }) => href === kiwi.href).community, null);
  t.false(stories.some((story) => "communityId" in story));

  // /api/v1/stories
  const [single] = await api.withCommunities(
    [cache.getSubmission(`0x${post.index}`)],
    deps,
  );
  t.deepEqual(single.community, ref);

  // A community's New
  const fresh = await newest.getCommunityStories(id);
  t.deepEqual((await api.withCommunities(fresh, deps))[0].community, ref);

  // A community this node doesn't know
  const [unknown] = await api.withCommunities(
    [{ href: "x", communityId: `${address()}/nope` }],
    deps,
  );
  t.is(unknown.community, null);
});

// --- A community's routes ----------------------------------------------------

test("an invalid community in the path is a 400", (t) => {
  const owner = address();
  for (const params of [
    { owner: "ai", key: "ai" },
    { owner: "", key: "ai" },
    { owner, key: "" },
    { owner, key: "AI" },
    { owner, key: "agent builders" },
    { owner: owner.slice(0, 41), key: "ai" },
  ]) {
    const r = reply();
    let next = false;
    api.communityParams({ params }, r, () => (next = true));
    t.false(next, JSON.stringify(params));
    t.is(r.statusCode, 400);
    t.like(r.body, { status: "error", code: 400 });
  }
});

test("a community's path reaches the feed, in lowercase; Kiwi News' has none", (t) => {
  const owner = upper(address());
  const r = reply();
  let next = false;
  api.communityParams({ params: { owner, key: "agent-builders" } }, r, () => (next = true));
  t.true(next);
  t.is(r.locals.community, `${owner.toLowerCase()}/agent-builders`);

  const kiwi = reply();
  kiwi.locals.community = "stale";
  api.kiwiNews({ params: {} }, kiwi, () => {});
  t.is(kiwi.locals.community, undefined);
});

// --- /c/:owner/:key -----------------------------------------------------------

test.serial("a community's page shows it, its rules, its creator and its stories", async (t) => {
  const owner = address();
  named.set(owner, "pagecreator.eth");
  const id = community(owner, {
    name: "Page Test",
    about: "Agents <b>and</b> more",
    rules: ["Be kind.", "Link sources."],
  });
  // NOTE: Two upvotes, as a community's Hot has Kiwi News' rules.
  const post = story({ community: id, title: "A community story", upvotes: 2 });
  const handler = page.handler({
    ...deps,
    getStories: async (feed, community) =>
      await index(null, 0, undefined, undefined, false, false, "control", false, true, {
        community,
      }),
  });

  const r = reply();
  await handler({ params: { owner, key: "page-test" } }, r);
  t.is(r.statusCode, 200);
  t.is(r.contentType, "text/html");
  t.true(r.body.startsWith("<!DOCTYPE html>"));
  t.true(r.body.includes("Page Test"));
  t.true(r.body.includes("Agents &lt;b>and&lt;/b> more") || r.body.includes("Agents &lt;b&gt;and&lt;/b&gt; more"));
  t.false(r.body.includes("<b>and</b>"));
  t.true(r.body.includes("Be kind."));
  t.true(r.body.includes("Link sources."));
  t.true(r.body.includes("pagecreator.eth"));
  t.true(r.body.includes(`href="/c/${id}/new"`), "its New");
  t.true(r.body.includes(post.title));
  t.true(r.body.includes(`https://news.kiwistand.com/c/${id}`), "canonical");
});

test.serial("a community's page is 404 when the community isn't known", async (t) => {
  const handler = page.handler({
    ...deps,
    getStories: async () => ({ stories: [], start: 0 }),
  });
  for (const params of [
    { owner: address(), key: "nope" },
    { owner: "not-an-address", key: "nope" },
  ]) {
    const r = reply();
    await handler({ params }, r);
    t.is(r.statusCode, 404);
  }
});
