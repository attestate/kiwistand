// @format
// The communities' web pages (views/community.mjs, views/communities.mjs)
// and the helpers they share with the web client (src/web/src/
// communities.mjs): names, texts, colours and icon suggestions.
import { env } from "process";
import { join } from "path";
import { readFileSync } from "fs";
import { randomBytes } from "crypto";

import test from "ava";
import Database from "better-sqlite3";

import * as cache from "../src/cache.mjs";
import * as page from "../src/views/community.mjs";
import * as browse from "../src/views/communities.mjs";
import Row from "../src/views/components/row.mjs";
import { iconPath } from "../src/views/components/communities.mjs";
import { PHOSPHOR_ICONS } from "../src/phosphor-icons.mjs";
import * as c from "../src/web/src/communities.mjs";

const db = new Database(join(env.CACHE_DIR, "database.db"));
const hex = (bytes) => randomBytes(bytes).toString("hex");
const address = () => `0x${hex(20)}`;
const now = () => Math.floor(Date.now() / 1000);
const DAY = 24 * 60 * 60;
const icons = c.catalog(
  JSON.parse(readFileSync("src/web/src/phosphor.json", "utf8")),
);

test.before(() => {
  // NOTE: Only the tables these tests read, without cache.initialize: the
  // test database is shared with other test files.
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
  for (const version of versions.reverse()) cache.restoreCommunity(version);
});

function insert(signer, overrides = {}) {
  const message = {
    index: hex(36),
    name: "Web Test",
    about: "Links about <b>agents</b>.",
    rules: ["Be kind.", "Link the source."],
    icon: "robot",
    color: "#6E56CF",
    timestamp: now() - 30 * DAY,
    signer,
    ...overrides,
  };
  versions.push(cache.insertCommunity(message));
  return `${signer.toLowerCase()}/${c.nameKey(message.name)}`;
}

const deps = {
  delegations: async () => ({}),
  getLists: async () => ({ addresses: [] }),
  resolve: async (address) =>
    address.toLowerCase().startsWith("0x5a")
      ? { ens: "sam.eth", displayName: "sam.eth" }
      : { displayName: address },
};

function reply() {
  const r = { statusCode: 200, headers: {}, locals: {} };
  r.status = (code) => ((r.statusCode = code), r);
  r.header = (name, value) => ((r.headers[name] = value), r);
  r.type = (type) => ((r.contentType = type), r);
  r.send = (body) => ((r.body = body), r);
  return r;
}

const community = (overrides = {}) => ({
  id: "0x6e56cf0000000000000000000000000000c0ffee/agent-builders",
  owner: "0x6e56Cf0000000000000000000000000000C0fFeE",
  ownerName: null,
  name: "Agent Builders",
  about: "Links about building with AI agents.",
  rules: ["Link the source, not a summary.", "No price talk."],
  icon: "robot",
  color: "#6E56CF",
  created: now() - DAY,
  timestamp: now() - DAY,
  stories: 3,
  lastStory: now() - 3600,
  ...overrides,
});

// --- helpers ----------------------------------------------------------------

test("a name's key and a community's ID", (t) => {
  t.is(c.nameKey("Agent Builders"), "agent-builders");
  t.is(c.nameKey("AI"), "ai");
  t.is(c.nameKey("Web3-Native Apps"), "web3-native-apps");
  t.is(
    c.communityId("0x6E56Cf0000000000000000000000000000C0fFeE", "Agent Builders"),
    "0x6e56cf0000000000000000000000000000c0ffee/agent-builders",
  );
});

test("texts are signed without invisible characters, trimmed", (t) => {
  t.is(c.clean("  Agent Builders \n"), "Agent Builders");
  const invisible = [
    0x00, 0x09, 0x0a, 0x1f, 0x7f, 0x85, 0x9f, 0x2028, 0x2029, 0x200b,
    0x200f, 0x202a, 0x202e, 0x2066, 0x2069,
  ].map((cp) => String.fromCodePoint(cp));
  t.is(c.clean(`Be${invisible.join("")} kind.`), "Be kind.");
  // Visible characters right next to the ranges stay.
  t.is(c.clean("a b‐c⁰d"), "a b‐c⁰d");
  t.is(c.clean("Emoji 🥝 ok"), "Emoji 🥝 ok");
  t.is(c.clean("​‮  ⁦"), "");
});

test("lengths count code points, and typing stops at the limit", (t) => {
  t.is(c.length("🥝🥝"), 2);
  t.is(c.clip("🥝🥝🥝", 2), "🥝🥝");
  t.is(c.clip("short", 24), "short");
});

test("names are words of letters and digits, at most 24", (t) => {
  t.true(c.isValidName("AI"));
  t.true(c.isValidName("Agent Builders"));
  t.true(c.isValidName("Web3-Native"));
  t.true(c.isValidName(" Agent Builders "));
  t.false(c.isValidName("Agent  Builders"));
  t.false(c.isValidName("Agent_Builders"));
  t.false(c.isValidName("Café"));
  t.false(c.isValidName("-AI"));
  t.false(c.isValidName("x".repeat(25)));
  t.true(c.isValidName("x".repeat(24)));
});

test("prepare cleans the fields and checks them before signing", (t) => {
  const fields = {
    name: " Agent Builders ",
    about: "  About​ agents.\n",
    rules: [" Be kind. ", "​ ⁦", "", "Link the source."],
    icon: "robot",
    color: "#6E56CF",
  };
  t.deepEqual(c.prepare(fields), {
    fields: {
      name: "Agent Builders",
      about: "About agents.",
      rules: ["Be kind.", "Link the source."],
      icon: "robot",
      color: "#6E56CF",
    },
  });
  t.is(c.prepare({ ...fields, about: " ​ " }).fields.about, "");
  t.truthy(c.prepare({ ...fields, name: "" }).error);
  t.truthy(c.prepare({ ...fields, name: "Agent  Builders" }).error);
  t.truthy(c.prepare({ ...fields, about: "x".repeat(101) }).error);
  t.truthy(c.prepare({ ...fields, rules: ["a", "b", "c", "d", "e", "f"] }).error);
  t.truthy(c.prepare({ ...fields, rules: ["x".repeat(141)] }).error);
  t.truthy(c.prepare({ ...fields, icon: "" }).error);
  // Only the palette's colours.
  t.truthy(c.prepare({ ...fields, color: "#D9480F" }).error);
  t.truthy(c.prepare({ ...fields, color: "#6e56cf" }).error);
});

test("a post to a community is at least a second younger than it", (t) => {
  t.is(c.postTimestamp(1000, 2000), 2000);
  t.is(c.postTimestamp(2000, 2000), 2001);
  t.is(c.postTimestamp(2005, 2000), 2006);
  t.is(c.postTimestamp(null, 2000), 2000);
});

test("invite links name the community and who shared them", (t) => {
  const id = "0x6e56cf0000000000000000000000000000c0ffee/agent-builders";
  const inviter = "0x1F8a7a00000000000000000000000000000000Aa";
  t.is(
    c.inviteURL(id, inviter),
    `https://news.kiwistand.com/c/${id}?via=${inviter}`,
  );
  t.is(c.inviteURL(id, "nope"), `https://news.kiwistand.com/c/${id}`);
});

test("who created a community: you, a name or the short address", (t) => {
  const owner = "0x6e56Cf0000000000000000000000000000C0fFeE";
  t.is(c.creator({ owner, ownerName: "sam.eth" }, owner.toLowerCase()), "you");
  t.is(c.creator({ owner, ownerName: "sam.eth" }, null), "sam.eth");
  t.is(c.creator({ owner, ownerName: null }), "0x6e56...fFeE");
});

test("palette colours map to their dark, soft and tint values", (t) => {
  t.deepEqual(c.colors("#6E56CF"), {
    base: "#6E56CF",
    baseDark: "#A594F9",
    soft: "#6E56CF1A",
    softDark: "#A594F929",
    tint: "#E4DEF2",
    tintDark: "#2F2B3C",
    text: "#5B45B8",
    textDark: "#C2B6FF",
  });
  t.like(c.colors("#1f8a7a"), {
    base: "#1F8A7A",
    baseDark: "#4CC3AE",
    tint: "#D3E9DD",
    tintDark: "#1F362D",
    text: "#1F8A7A",
  });
  t.is(c.PALETTE.length, 8);
  t.deepEqual(
    c.PALETTE.map(({ hex }) => hex),
    ["#6E56CF", "#1F8A7A", "#C8553D", "#4A72B8", "#A86B12", "#B83E72", "#56616D", "#7A5230"],
  );
});

test("other colours are drawn as they are, with a mixed tint", (t) => {
  t.deepEqual(c.colors("#D9480F"), {
    base: "#D9480F",
    baseDark: "#D9480F",
    soft: "#D9480F1A",
    softDark: "#D9480F29",
    tint: "#F8DED4",
    tintDark: "#3F2615",
    text: "#D9480F",
    textDark: "#D9480F",
  });
  // Not a colour at all: slate.
  t.is(c.colors("red").base, "#56616D");
  t.is(
    c.colorStyle("#6E56CF"),
    "--c:#6E56CF;--c-d:#A594F9;--c-soft:#6E56CF1A;--c-soft-d:#A594F929;--c-tint:#E4DEF2;--c-tint-d:#2F2B3C;--c-text:#5B45B8;--c-text-d:#C2B6FF",
  );
});

test("the icon data has every protocol icon, and nothing else", (t) => {
  t.is(icons.icons.length, PHOSPHOR_ICONS.length);
  t.deepEqual(
    icons.icons.map(({ name }) => name).sort(),
    [...PHOSPHOR_ICONS].sort(),
  );
  for (const icon of icons.icons) t.regex(icon.path, /^M[-0-9.,A-Za-z ]+$/);
  t.is(icons.categories.length, 18);
});

test("icon suggestions match the name's words, without logos", (t) => {
  const ai = c.suggestIcons("AI", icons);
  t.is(ai.length, 8);
  t.deepEqual(ai.slice(0, 2), ["robot", "head-circuit"]);
  t.false(ai.includes("open-ai-logo"));
  t.deepEqual(c.suggestIcons("Science", icons).slice(0, 2), ["atom", "flask"]);
  t.deepEqual(c.suggestIcons("Bitcoin", icons).slice(0, 1), ["currency-btc"]);
  // Stems: "books" finds "book".
  t.true(c.suggestIcons("Books", icons).includes("book"));
  // Nothing matches: the fallbacks.
  t.deepEqual(c.suggestIcons("", icons), c.FALLBACK_ICONS);
  t.deepEqual(c.suggestIcons("Qwxz", icons), c.FALLBACK_ICONS);
  // Every suggestion is a protocol icon.
  for (const name of ["AI", "Agent Builders", "Zero Knowledge", "Design"]) {
    for (const icon of c.suggestIcons(name, icons)) {
      t.true(PHOSPHOR_ICONS.includes(icon), icon);
    }
  }
  // The search still finds logos.
  t.is(c.matchIcons("open ai logo", icons)[0], "open-ai-logo");
});

test("the server draws any community icon and the buttons' bold ones", (t) => {
  t.is(iconPath("robot"), icons.byName.get("robot").path);
  t.regex(iconPath("plus-bold"), /^M/);
  t.is(iconPath("not-an-icon"), icons.byName.get("circle-dashed").path);
});

// --- story rows ---------------------------------------------------------------

test("a story row shows its community's tag before the domain", (t) => {
  const story = {
    index: hex(36),
    href: "https://example.com/agents",
    title: "A story",
    timestamp: now() - 3600,
    identity: address(),
    upvotes: 3,
    upvoters: [],
    submitter: { displayName: "sam.eth" },
  };
  const tagged = Row(0, "/", "")(
    {
      ...story,
      community: { id: community().id, name: "Agent Builders", icon: "robot", color: "#1F8A7A" },
    },
    0,
  ).toString();
  t.true(tagged.includes('class="cm-c cm-tag"'));
  t.true(tagged.includes(`href="/c/${community().id}"`));
  t.true(tagged.includes("--c:#1F8A7A;--c-d:#4CC3AE"));
  t.true(tagged.indexOf("cm-tag") < tagged.indexOf("kn-domain"));
  t.true(tagged.includes(iconPath("robot")));

  const plain = Row(0, "/", "")({ ...story, community: null }, 0).toString();
  t.false(plain.includes("cm-tag"));
});

// --- a community's pages ------------------------------------------------------

test("a community's page: header card, rules, feeds and its colours", (t) => {
  const html = page.render(undefined, community(), "hot", []);
  t.true(html.startsWith("<!DOCTYPE html>"));
  t.true(html.includes('<h1 class="cm-name">Agent Builders</h1>'));
  t.true(html.includes("Links about building with AI agents."));
  t.true(html.includes("Link the source, not a summary."));
  t.true(html.includes("Anyone on Kiwi can post"));
  t.true(html.includes("Kiwi’s guidelines apply on top."));
  t.true(html.includes("created by"));
  t.true(html.includes("0x6e56...fFeE"));
  t.true(html.includes("3 stories"));
  // Breadcrumbs, and the feeds under the community.
  t.true(html.includes('<a href="/">Kiwi News</a>'));
  t.true(html.includes('<a href="/communities">Communities</a>'));
  t.true(html.includes(`href="/c/${community().id}/new"`));
  t.true(html.includes(`href="/c/${community().id}/best"`));
  t.true(html.includes("AGENT BUILDERS · 3 STORIES"));
  // Light and dark: both colours, the stylesheet picks (news.css .cm-c).
  t.true(html.includes("--c:#6E56CF;--c-d:#A594F9"));
  t.true(html.includes("--c-tint:#E4DEF2;--c-tint-d:#2F2B3C"));
  // The data Communities.jsx draws and remembers it with.
  const json = html.match(/data-community="([^"]+)"/)[1].replace(/&quot;/g, '"');
  t.like(JSON.parse(json), {
    id: community().id,
    name: "Agent Builders",
    icon: "robot",
    path: iconPath("robot"),
    color: "#6E56CF",
  });
  // No "10 likes" anymore: Kiwi News has every story.
  t.false(html.includes("10 likes"));
  t.false(html.includes("Reaching the front page"));
  // Hot without stories, but the community has some.
  t.true(html.includes("Nothing hot right now"));
});

test("the dark theme maps a community's colours", (t) => {
  const css = readFileSync("src/public/news.css", "utf8");
  const dark = css.slice(css.indexOf("/* -- Communities"));
  t.regex(
    dark,
    /@media \(prefers-color-scheme: dark\) \{\s*\.cm-c \{\s*--cm: var\(--c-d\);\s*--cm-soft: var\(--c-soft-d\);\s*--cm-tint: var\(--c-tint-d\);\s*--cm-text: var\(--c-text-d\);/,
  );
});

test("a community without stories asks for the first one", (t) => {
  const html = page.render(undefined, community({ stories: 0 }), "hot", []);
  t.true(html.includes("No stories yet"));
  t.true(html.includes(`href="/submit?community=${community().id}"`));
  t.true(html.includes("Post the first story"));
});

test("an invite link's page says who invited you", (t) => {
  const html = page.renderInvite(undefined, community(), {
    name: "sam.eth",
    avatar: null,
  });
  t.true(html.includes("sam.eth invited you"));
  t.true(html.includes("Join Agent Builders"));
  t.true(html.includes(`href="/c/${community().id}">Not now</a>`));
  t.true(html.includes('data-cm="invite"'));
});

test.serial("the community pages are 200, unknown ones 404", async (t) => {
  const owner = address();
  const id = insert(owner, { name: "Web Pages" });
  const calls = [];
  const handler = page.handler({
    ...deps,
    getStories: async (feed, community, options) => {
      calls.push([feed, community, options]);
      return { stories: [], start: 0 };
    },
  });
  const [, key] = id.split("/");
  for (const [feed, query] of [
    [undefined, {}],
    ["new", {}],
    ["best", { period: "month", page: "2" }],
  ]) {
    const r = reply();
    await handler({ params: { owner, key, feed }, query, path: "/c" }, r);
    t.is(r.statusCode, 200, feed);
    t.is(r.contentType, "text/html");
    t.true(r.body.includes("Web Pages"));
    t.true(r.body.includes("Links about &lt;b>agents&lt;/b>.") || r.body.includes("Links about &lt;b&gt;agents&lt;/b&gt;."));
    t.false(r.body.includes("<b>agents</b>"));
  }
  t.deepEqual(calls, [
    ["hot", id, { page: 0, period: "week" }],
    ["new", id, { page: 0, period: "week" }],
    ["best", id, { page: 2, period: "month" }],
  ]);

  for (const params of [
    { owner: address(), key: "nope" },
    { owner: "not-an-address", key: "nope" },
    { owner, key, feed: "hot" },
    { owner, key, feed: "comments" },
  ]) {
    const r = reply();
    await handler({ params, query: {}, path: "/c" }, r);
    t.is(r.statusCode, 404, JSON.stringify(params));
    t.true(r.body.includes("Community not found"));
  }
});

test.serial("?via= opens the invite page, other values don't", async (t) => {
  const owner = address();
  const id = insert(owner, { name: "Web Invites" });
  const [, key] = id.split("/");
  const handler = page.handler({
    ...deps,
    getStories: async () => ({ stories: [], start: 0 }),
  });
  const inviter = `0x5a${hex(19)}`;
  const r = reply();
  await handler({ params: { owner, key }, query: { via: inviter } }, r);
  t.is(r.statusCode, 200);
  t.true(r.body.includes("sam.eth invited you"));

  const plain = reply();
  await handler({ params: { owner, key }, query: { via: "<script>" } }, plain);
  t.false(plain.body.includes("invited you"));
  t.false(plain.body.includes("<script>"));
});

// --- /communities and /communities/new ----------------------------------------

test("browse lists communities as cards, most active first", (t) => {
  const html = browse.renderBrowse(undefined, {
    tab: "discover",
    query: "",
    communities: [
      community(),
      community({
        id: "0x1f8a7a00000000000000000000000000000000aa/rollups",
        owner: "0x1F8a7a00000000000000000000000000000000Aa",
        ownerName: "sam.eth",
        name: "Rollups",
        color: "#D9480F",
        stories: 1,
      }),
    ],
  });
  t.true(html.includes('<h1 class="cm-title">Communities</h1>'));
  t.true(html.includes("2 communities"));
  t.true(html.indexOf("Agent Builders") < html.indexOf("Rollups"));
  t.true(html.includes("created by sam.eth"));
  t.true(html.includes("1 story"));
  t.true(html.includes('href="/communities/new"'));
  t.true(html.includes('data-cm="join"'));
  t.true(html.includes("How communities work"));
  t.true(html.includes("--c:#D9480F;--c-d:#D9480F"));
  t.false(html.includes("10 likes"));
});

test("browse without results and the Joined tab", (t) => {
  const none = browse.renderBrowse(undefined, {
    tab: "discover",
    query: "quantum <b>",
    communities: [],
  });
  t.true(none.includes("0 communities for “quantum &lt;b>”") || none.includes("0 communities for “quantum &lt;b&gt;”"));
  t.true(none.includes("No communities found"));
  t.false(none.includes("quantum <b>"));

  const joined = browse.renderBrowse(undefined, {
    tab: "joined",
    query: "",
    communities: [],
  });
  t.true(joined.includes('data-cm="joined"'));
  t.true(joined.includes('aria-current="page">Joined</a>'));
});

test.serial("GET /communities searches with q, GET /communities/new", async (t) => {
  const owner = address();
  insert(owner, { name: "Searchable Web", about: "Quantum things." });
  const r = reply();
  await browse.browseHandler(deps)({ query: { q: "quantum" } }, r);
  t.is(r.statusCode, 200);
  t.true(r.body.includes("Searchable Web"));
  t.true(r.body.includes("for “quantum”"));

  const form = reply();
  await browse.newHandler()({ query: {} }, form);
  t.is(form.statusCode, 200);
  t.true(form.body.includes("Start a community"));
  t.true(form.body.includes('id="cm-new"'));
  t.true(form.body.includes('id="cm-new-preview"'));

  const edit = reply();
  await browse.newHandler()({ query: { edit: "searchable-web" } }, edit);
  t.true(edit.body.includes('data-edit="searchable-web"'));
  t.true(edit.body.includes("Edit your community"));

  const bad = reply();
  await browse.newHandler()({ query: { edit: '"><b>' } }, bad);
  t.true(bad.body.includes('data-edit=""'));
});
