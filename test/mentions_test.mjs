// @format
// Mentions in comments: the "@0x…" format (src/web/src/mentions.mjs), what
// the comment box posts, how comments show them, GET /api/v1/mentions
// (src/mentions.mjs), the push notification (subscriptions.mjs) and the
// in-app one (views/activity.mjs).
import { env } from "process";
import { rm } from "fs/promises";
import { join } from "path";

import test from "ava";
import { Wallet, utils } from "ethers";
import Database from "better-sqlite3";

import * as id from "../src/id.mjs";
import * as store from "../src/store.mjs";
import * as cache from "../src/cache.mjs";
import * as activity from "../src/views/activity.mjs";
import { linkifyComment } from "../src/views/story.mjs";
import row from "../src/views/components/row.mjs";
import {
  tokens,
  mentioned,
  notified,
  names,
  split,
  render,
  typing,
  insert,
  encode,
  MAX_NOTIFIED,
} from "../src/web/src/mentions.mjs";
import * as mentions from "../src/mentions.mjs";
import { triggerMentionNotification } from "../src/subscriptions.mjs";
import { handleMessage } from "../src/api.mjs";
import { EIP712_MESSAGE } from "../src/constants.mjs";
import { getSlug } from "../src/utils.mjs";
import { LOAD_BALANCER_RULES } from "../src/ratelimit.mjs";

const db = new Database(join(env.CACHE_DIR, "database.db"));
const now = () => Math.floor(Date.now() / 1000);
const randomIndex = () => utils.hexlify(utils.randomBytes(36));
const A = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
const B = "0x1111111111111111111111111111111111111111";

test.before(() => {
  // NOTE: The tables these tests read, without the foreign keys of
  // cache.initialize, like memberships_test.mjs.
  cache.initializeLtCache();
  for (const table of [
    `submissions (id TEXT PRIMARY KEY NOT NULL, href TEXT NOT NULL UNIQUE, title TEXT NOT NULL, timestamp INTEGER NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL, community TEXT)`,
    `upvotes (id TEXT PRIMARY KEY NOT NULL, href TEXT NOT NULL, timestamp INTEGER NOT NULL, title TEXT NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL)`,
    `comments (id TEXT PRIMARY KEY NOT NULL, submission_id TEXT NOT NULL, timestamp INTEGER NOT NULL, title TEXT NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL)`,
  ]) {
    db.exec(`CREATE TABLE IF NOT EXISTS ${table}`);
  }
  cache.initializeReactions();
  cache.initializeNotifications();
  cache.initializeCommunities();
  cache.initializeMemberships();
});

// --- The format --------------------------------------------------------------

test("a mention is @ and an address at the start or after whitespace", (t) => {
  t.deepEqual(tokens(`@${A} hi`), [{ start: 0, end: 43, address: A }]);
  t.deepEqual(tokens(`hi @${A}`), [{ start: 3, end: 46, address: A }]);
  t.deepEqual(
    tokens(`hi\n@${A.toLowerCase()}`).map(({ address }) => address),
    [A.toLowerCase()],
  );
  // Punctuation after it doesn't belong to it.
  for (const end of [".", ",", "!", "?", ":", ";", ")", "'s"]) {
    t.deepEqual(
      tokens(`thanks @${A}${end}`).map(({ address }) => address),
      [A],
      end,
    );
  }
  // Two in a row, each after whitespace.
  t.deepEqual(
    tokens(`@${A} @${B}`).map(({ address }) => address),
    [A, B],
  );
});

test("an email address, a URL or a longer hex string isn't a mention", (t) => {
  for (const text of [
    `mail me at kiwi@${A}`,
    `https://example.com/@${A}`,
    `(@${A})`,
    `@${A}a`,
    `@${A}0`,
    `@${A}_`,
    `@${A.slice(0, -1)}`,
    `a@b.com`,
    `@alice`,
  ]) {
    t.deepEqual(tokens(text), [], text);
  }
});

test("each person counts once, any case, and only five notify", (t) => {
  t.deepEqual(mentioned(`@${A} and @${A.toLowerCase()} and @${B}`), [
    A.toLowerCase(),
    B,
  ]);
  const six = Array.from({ length: 6 }, () => Wallet.createRandom().address);
  t.is(MAX_NOTIFIED, 5);
  t.deepEqual(
    notified(six.map((address) => `@${address}`).join(" ")),
    six.slice(0, 5).map((address) => address.toLowerCase()),
  );
});

test("comments show mentions as @<name>, else the short address", async (t) => {
  const profiles = {
    [A.toLowerCase()]: { displayName: "@alice" },
    [B]: { displayName: "bob.eth" },
  };
  const found = await names([`@${A} @${B}`, `@${A}`], async (address) => {
    if (!profiles[address]) throw new Error("unknown");
    return profiles[address];
  });
  t.deepEqual(found, { [A.toLowerCase()]: "alice", [B]: "bob.eth" });
  t.is(render(`thanks @${A}, @${B}!`, found), "thanks @alice, @bob.eth!");
  t.is(render(`@${A}`, {}), "@0x0f6A...7176");
  t.deepEqual(split(`hi @${A}.`, found), [
    "hi ",
    { address: A, name: "alice" },
    ".",
  ]);
  const failed = await names([`@${A}`], async () => {
    throw new Error("down");
  });
  t.deepEqual(failed, { [A.toLowerCase()]: "0x0f6a...7176" });
});

// --- The comment box -----------------------------------------------------------

test("the comment box finds the @ being typed", (t) => {
  t.deepEqual(typing("@", 1), { start: 0, query: "" });
  t.deepEqual(typing("hi @al", 6), { start: 3, query: "al" });
  t.deepEqual(typing("hi @al there", 6), { start: 3, query: "al" });
  t.is(typing("mail@al", 7), null);
  t.is(typing("hi @al ", 7), null);
  t.is(typing(`@${"a".repeat(33)}`, 34), null);
  t.deepEqual(insert("hi @al there", 6, { start: 3, query: "al" }, "alice.eth"), {
    text: "hi @alice.eth  there",
    caret: 14,
  });
});

test("the comment box posts the names it inserted as addresses", (t) => {
  const inserted = { alice: A, "alice.eth": B, "0x1234...abcd": B };
  t.is(encode("@alice hi", inserted), `@${A} hi`);
  t.is(encode("hi @alice.eth!", inserted), `hi @${B}!`);
  t.is(encode("hi @alice.", inserted), `hi @${A}.`);
  t.is(encode("cc @0x1234...abcd", inserted), `cc @${B}`);
  // Names it didn't insert, and anything else, stay as typed.
  t.is(encode("@alice_b @alicex @Alice", inserted), "@alice_b @alicex @Alice");
  t.is(encode("mail@alice", inserted), "mail@alice");
  t.is(encode(`@${A.toLowerCase()} @bob`, inserted), `@${A.toLowerCase()} @bob`);
  t.is(encode("@alice", {}), "@alice");
  // Characters regular expressions know are just text.
  t.is(encode("@a.c @abc", { "a.c": A }), `@${A} @abc`);
});

// --- Comments on the story page --------------------------------------------------

test("the story page links a mention to the person, escaped", (t) => {
  const html = linkifyComment(
    `thanks @${A} <img src=x onerror=alert(1)> see https://example.com\n> @${B}`,
    { [A.toLowerCase()]: `al"ice<script>alert(1)</script>` },
  );
  t.true(
    html.includes(
      `<div>thanks <a class="kn-mention" href="/upvotes?address=${A}">@al"ice&lt;script&gt;alert(1)&lt;/script&gt;</a> <img src="x"> see <a href="https://example.com"`,
    ),
    html,
  );
  t.false(html.includes("<script>"));
  t.false(html.includes("onerror"));
  t.true(html.includes(`href="/upvotes?address=${B}">@0x1111...1111</a>`));
  t.true(html.includes('href="https://example.com"'));
  // An address in an email or URL stays text.
  const plain = linkifyComment(`kiwi@${A}`, {});
  t.false(plain.includes("kn-mention"));
});

test("the feeds' comment preview shows the names, escaped", (t) => {
  const html = String(
    row(0, "/")(
      {
        index: "0001",
        href: "https://example.com/a",
        title: "A story",
        timestamp: now() - 60,
        identity: B,
        displayName: "someone",
        upvotes: 1,
        upvoters: [],
        lastComment: {
          index: "0002",
          title: `agreed @${A}, and @${B.toLowerCase()}`,
          timestamp: now() - 30,
          identity: { ens: "carl.eth", displayName: "carl.eth" },
          names: { [A.toLowerCase()]: "<b>alice</b>" },
        },
      },
      0,
    ),
  );
  t.true(html.includes("agreed @&lt;b&gt;alice&lt;/b&gt;, and @0x1111...1111"), html);
  t.false(html.includes(`@${A}`));
});

// --- GET /api/v1/mentions ---------------------------------------------------------

function reply() {
  const r = { statusCode: 200, headers: {} };
  r.status = (code) => ((r.statusCode = code), r);
  r.header = (name, value) => ((r.headers[name] = value), r);
  r.json = (body) => ((r.body = body), r);
  return r;
}

const story = `0x${"ab".repeat(36)}`;
function people(n) {
  return Array.from({ length: n }, (_, i) =>
    utils.getAddress(`0x${(i + 1).toString(16).padStart(40, "0")}`),
  );
}
const [op, c1, c2, c3, other1, other2, banned] = people(7);
const profileOf = {
  [op.toLowerCase()]: { displayName: "olive.eth", ens: "olive.eth", safeAvatar: "https://example.com/o.png" },
  [c1.toLowerCase()]: { displayName: "@carl", farcaster: { username: "carl" } },
  [c2.toLowerCase()]: { displayName: "0x0000...0003" },
  [c3.toLowerCase()]: { displayName: "omar", kiwiProfile: { name: "omar" }, ens: "zed.eth" },
  [other1.toLowerCase()]: { displayName: "oscar.eth", ens: "oscar.eth" },
  [other2.toLowerCase()]: { displayName: "carla.eth", ens: "carla.eth" },
  [banned.toLowerCase()]: { displayName: "ollie.eth", ens: "ollie.eth" },
};
const endpointDeps = {
  getLists: async () => ({ addresses: [banned.toLowerCase()] }),
  resolve: async (address) => profileOf[address.toLowerCase()] || {},
  cachedProfile: async (address) => profileOf[address.toLowerCase()] || {},
  // Who posted, then who commented, most recent first (with repeats and
  // other spellings, like the table can have).
  storyPeople: (index) =>
    index === story
      ? [op, c2, banned, c1.toLowerCase(), op, c3]
      : [],
  ranking: () =>
    [banned, other2, op, other1, c3].map((identity) => ({ identity, karma: 1 })),
  nicknamed: () => [],
};

async function ask(query, deps = endpointDeps) {
  mentions.resetDirectory();
  const r = reply();
  await mentions.handler(deps)({ query }, r);
  return r;
}

test.serial("without q, the story's poster comes first, then its latest commenters", async (t) => {
  const r = await ask({ index: story });
  t.is(r.statusCode, 200);
  t.is(r.headers["Cache-Control"], "no-cache");
  t.is(r.body.status, "success");
  t.deepEqual(r.body.data.people, [
    { address: op, name: "olive.eth", avatar: "https://example.com/o.png" },
    { address: c2, name: "0x0000...0003", avatar: null },
    { address: c1, name: "carl", avatar: null },
    { address: c3, name: "omar", avatar: null },
  ]);
  // No story, nobody to guess.
  t.deepEqual((await ask({})).body.data.people, []);
  t.deepEqual((await ask({ q: "" })).body.data.people, []);
});

test.serial("with q, the story's people whose name starts with it come first", async (t) => {
  const names = async (query) =>
    (await ask(query)).body.data.people.map(({ name }) => name);
  t.deepEqual(await names({ q: "o", index: story }), [
    "olive.eth",
    "omar",
    "oscar.eth",
  ]);
  // ENS names and Farcaster usernames match too, and case doesn't matter.
  t.deepEqual(await names({ q: "ZED", index: story }), ["omar"]);
  t.deepEqual(await names({ q: "Car", index: story }), ["carl", "carla.eth"]);
  // Without a story, only other named people; never banned ones.
  t.deepEqual(await names({ q: "o" }), ["olive.eth", "oscar.eth", "omar"]);
  t.deepEqual(await names({ q: "olli" }), []);
});

test.serial("the endpoint answers at most eight people", async (t) => {
  const many = people(20).slice(8);
  const deps = {
    ...endpointDeps,
    resolve: async () => ({ displayName: "kiwi.eth", ens: "kiwi.eth" }),
    cachedProfile: async () => ({ displayName: "kiwi.eth", ens: "kiwi.eth" }),
    storyPeople: () => many.slice(0, 10),
    ranking: () => many.map((identity) => ({ identity, karma: 1 })),
  };
  t.is((await ask({ index: story }, deps)).body.data.people.length, 8);
  t.is((await ask({ q: "kiwi" }, deps)).body.data.people.length, 8);
});

test.serial("the endpoint answers 400 for a long q or a bad index", async (t) => {
  t.is((await ask({ q: "a".repeat(32) })).statusCode, 200);
  for (const query of [
    { q: "a".repeat(33) },
    { q: ["a", "b"] },
    { q: "a", index: "0x1234" },
    { q: "a", index: story.slice(2) },
    { q: "a", index: [story] },
  ]) {
    const r = await ask(query);
    t.is(r.statusCode, 400, JSON.stringify(query));
    t.is(r.body.status, "error");
    t.is(r.headers["Cache-Control"], "no-cache");
  }
});

test("the endpoint is rate limited like search", (t) => {
  const rule = LOAD_BALANCER_RULES.find(({ name }) => name === "mentions");
  t.is(rule.limit, 60);
  t.true(rule.match({ method: "GET" }, "/api/v1/mentions"));
  t.false(rule.match({ method: "OPTIONS" }, "/api/v1/mentions"));
});

test.serial("a story's people are its poster, then its commenters, latest first", (t) => {
  const index = randomIndex();
  const [poster, x, y] = people(3);
  db.prepare(`INSERT INTO submissions VALUES (?, ?, ?, ?, ?, ?, NULL)`).run(
    `kiwi:${index}`,
    `https://example.com/people-${Date.now()}`,
    "A story",
    1,
    poster,
    poster,
  );
  const comment = db.prepare(`INSERT INTO comments VALUES (?, ?, ?, ?, ?, ?)`);
  comment.run(`kiwi:${randomIndex()}`, `kiwi:${index}`, 2, "first", x, x);
  comment.run(`kiwi:${randomIndex()}`, `kiwi:${index}`, 3, "second", y, y);
  comment.run(`kiwi:${randomIndex()}`, `kiwi:${index}`, 4, "third", x, x);
  t.teardown(() => {
    db.prepare(`DELETE FROM comments WHERE submission_id = ?`).run(`kiwi:${index}`);
    db.prepare(`DELETE FROM submissions WHERE id = ?`).run(`kiwi:${index}`);
  });
  t.deepEqual(cache.getStoryPeople(index), [poster, x, y]);
  t.deepEqual(cache.getStoryPeople(randomIndex()), []);
});

// --- Push notifications -----------------------------------------------------------

async function signComment(signer, title, storyIndex = story) {
  const message = id.create(title, `kiwi:${storyIndex}`, "comment", now());
  return await id.sign(signer, message, EIP712_MESSAGE);
}

function notificationDeps(overrides = {}) {
  const pushed = [];
  return {
    pushed,
    deps: {
      getSubmission: () => ({
        identity: op,
        index: story.slice(2),
        title: "A story",
        comments: [{ identity: c1 }],
      }),
      getLists: async () => ({ addresses: [] }),
      isModerated: () => false,
      resolve: async (address) =>
        profileOf[address.toLowerCase()] || { displayName: "0x0000...0000" },
      getFids: async () => [],
      sendNeynar: async () => {},
      sendPush: async (receivers, notification) =>
        pushed.push({ receivers, notification }),
      ...overrides,
    },
  };
}

test("a comment tells the people it mentions", async (t) => {
  const author = Wallet.createRandom();
  const message = await signComment(author, `nice one @${other1}, cc @${c3}.`);
  const { pushed, deps } = notificationDeps();
  const { sent } = await triggerMentionNotification(message, "ff".repeat(36), {}, deps);
  const url = `https://news.kiwistand.com/stories/A-story?index=${story}&commentIndex=${"ff".repeat(36)}#0x${"ff".repeat(36)}`;
  t.deepEqual(sent, {
    receivers: [other1.toLowerCase(), c3.toLowerCase()],
    title: "New mention",
    body: "0x0000...0000 mentioned you: nice one @oscar.eth, cc @omar.",
    url,
  });
  t.deepEqual(pushed, [{ receivers: sent.receivers, notification: { title: sent.title, body: sent.body, url } }]);
});

test("the author, banned profiles and who the comment already tells aren't told again", async (t) => {
  const author = Wallet.createRandom();
  const index = "ff".repeat(36);
  // The story's author (op) and a commenter (c1) get the comment
  // notification already; the author mentioning themselves is no news.
  const message = await signComment(
    author,
    `@${op} @${c1} @${author.address} @${other1} @${other2}`,
  );
  const { pushed, deps } = notificationDeps({
    getLists: async () => ({ addresses: [other2.toLowerCase()] }),
  });
  const { sent } = await triggerMentionNotification(message, index, {}, deps);
  t.deepEqual(sent.receivers, [other1.toLowerCase()]);
  t.is(pushed.length, 1);

  const own = await signComment(author, `@${author.address} @${op}`);
  t.regex((await triggerMentionNotification(own, index, {}, deps)).reason, /nobody else/);

  const fromBanned = notificationDeps({
    getLists: async () => ({ addresses: [author.address.toLowerCase()] }),
  });
  t.regex(
    (await triggerMentionNotification(message, index, {}, fromBanned.deps)).reason,
    /author is banned/,
  );
  const moderated = notificationDeps({ isModerated: () => true });
  t.regex(
    (await triggerMentionNotification(message, index, {}, moderated.deps)).reason,
    /moderated/,
  );
  const none = await signComment(author, "no mentions here, kiwi@" + other1);
  t.is((await triggerMentionNotification(none, index, {}, deps)).reason, "no mentions");
  t.is(fromBanned.pushed.length + moderated.pushed.length, 0);
});

test("only a comment's first five mentions notify", async (t) => {
  const author = Wallet.createRandom();
  const six = people(30).slice(24);
  const message = await signComment(author, six.map((a) => `@${a}`).join(" "));
  const { deps } = notificationDeps();
  const { sent } = await triggerMentionNotification(message, "ff".repeat(36), {}, deps);
  t.deepEqual(sent.receivers, six.slice(0, 5).map((a) => a.toLowerCase()));
});

test("a delegated key mentions as its account", async (t) => {
  const device = Wallet.createRandom();
  const message = await signComment(device, `@${A} @${other1}`);
  const { deps } = notificationDeps();
  const { sent } = await triggerMentionNotification(
    message,
    "ff".repeat(36),
    { [device.address]: A },
    deps,
  );
  t.deepEqual(sent.receivers, [other1.toLowerCase()]);
});

test.serial("the node's API tells the people a comment it took mentions", async (t) => {
  const dir = "dbtestMentions";
  await rm(dir, { recursive: true, force: true });
  env.DATA_DIR = dir;
  t.teardown(() => rm(dir, { recursive: true, force: true }));
  store.upvotes.clear();
  const trie = await store.create();
  const poster = Wallet.createRandom();
  const submission = await id.sign(
    poster,
    id.create("Mentions", `https://example.com/mentions-${Date.now()}`, "amplify", now() - 10),
    EIP712_MESSAGE,
  );
  const storyIndex = await store.add(trie, submission, null, {});

  const told = [];
  const notifyMention = async (...args) => told.push(args);
  const handler = handleMessage(trie, null, async () => ({}), undefined, notifyMention);
  const message = await signComment(Wallet.createRandom(), `hi @${A}`, `0x${storyIndex}`);
  const r = reply();
  await handler({ body: message, query: {} }, r);
  t.is(r.body.code, 200);
  await new Promise((resolve) => setImmediate(resolve));
  t.is(told.length, 1);
  t.is(told[0][0], message);
  t.is(`0x${told[0][1]}`, r.body.data.index);
});

// --- In-app notifications -----------------------------------------------------------

test.serial("the activity has the comments that mention someone", async (t) => {
  const me = Wallet.createRandom().address;
  const [poster, alice, bob, eve] = people(40).slice(30, 34);
  const mine = randomIndex();
  const theirs = randomIndex();
  const nowSecs = now();
  const submissions = db.prepare(`INSERT INTO submissions VALUES (?, ?, ?, ?, ?, ?, NULL)`);
  submissions.run(`kiwi:${mine}`, `https://example.com/mine-${Date.now()}`, "My story", nowSecs - 900, me, me);
  submissions.run(`kiwi:${theirs}`, `https://example.com/theirs-${Date.now()}`, "Their <b>story</b>", nowSecs - 900, poster, poster);
  const comment = (storyIndex, author, title, timestamp) => {
    const commentId = `kiwi:${randomIndex()}`;
    db.prepare(`INSERT INTO comments VALUES (?, ?, ?, ?, ?, ?)`).run(
      commentId,
      `kiwi:${storyIndex}`,
      timestamp,
      title,
      author,
      author,
    );
    return commentId.slice(7);
  };
  t.teardown(() => {
    for (const storyIndex of [mine, theirs]) {
      db.prepare(`DELETE FROM comments WHERE submission_id = ?`).run(`kiwi:${storyIndex}`);
      db.prepare(`DELETE FROM submissions WHERE id = ?`).run(`kiwi:${storyIndex}`);
    }
  });

  const mention = comment(theirs, alice, `look @${me.toLowerCase()} <i>now</i>`, nowSecs - 600);
  // A sixth mention, an email, a banned author and an old comment.
  comment(theirs, alice, `${people(5).map((a) => `@${a}`).join(" ")} @${me}`, nowSecs - 550);
  comment(theirs, alice, `kiwi@${me}`, nowSecs - 540);
  comment(theirs, eve, `@${me} spam`, nowSecs - 530);
  comment(theirs, alice, `@${me} old`, nowSecs - 22 * 24 * 60 * 60);
  // On my own story: it's in `notifications` already.
  comment(mine, bob, `@${me} hi`, nowSecs - 500);
  // My own comment. After it, the thread's comments are in `notifications`.
  comment(theirs, me, `@${me} talking to myself`, nowSecs - 450);
  comment(theirs, bob, `@${me} again`, nowSecs - 200);

  const known = { [alice.toLowerCase()]: "alice.eth", [me.toLowerCase()]: "me.eth" };
  const resolve = async (address) => ({
    address,
    displayName: known[address.toLowerCase()] || "anon",
    safeAvatar: null,
  });
  const options = {
    delegations: {},
    resolve,
    getLists: async () => ({ addresses: [eve.toLowerCase()] }),
  };
  const data = await activity.data(null, me, 0, false, options);
  t.deepEqual(data.mentions.map(({ verb, timestamp, message, story, identities }) => ({ verb, timestamp, message, story, identities })), [
    {
      verb: "mentioned",
      timestamp: nowSecs - 600,
      message: {
        index: mention,
        title: `look @${me.toLowerCase()} <i>now</i>`,
        href: `kiwi:${theirs}`,
        identity: alice,
      },
      story: { index: theirs.slice(2), title: "Their <b>story</b>" },
      identities: [{ address: alice, displayName: "alice.eth", safeAvatar: null }],
    },
  ]);
  t.false(data.notifications.some(({ verb }) => verb === "mentioned"));
  t.is(data.lastUpdate, nowSecs - 200);

  // The page: "<name> mentioned you in <story>", linking to the comment.
  const html = (
    await activity.page("light", me, data.feed, 0, false, data.names)
  ).toString();
  t.true(html.includes("alice.eth mentioned you in"), html);
  t.true(
    html.includes(
      `href="/stories/${getSlug("Their <b>story</b>")}?index=${theirs}#0x${mention}"`,
    ),
  );
  t.true(html.includes("look @me.eth &lt;i&gt;now&lt;/i&gt;"), html);
  t.false(html.includes("<i>now</i>"));
  t.false(html.includes("<b>story</b>"));
  t.false(html.includes(`@${me.toLowerCase()}`));

  // A banned profile isn't told.
  const bannedMe = await activity.data(null, me, 0, false, {
    ...options,
    getLists: async () => ({ addresses: [me.toLowerCase()] }),
  });
  t.deepEqual(bannedMe.mentions, []);
  // The beacon's quick read skips them, like joins.
  t.deepEqual((await activity.data(null, me, 0, true, options)).mentions, []);
});
