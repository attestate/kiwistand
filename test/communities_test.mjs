// @format
// Communities (protocol 13.0.0): the `Community` message, posts to a
// community, and how nodes store, sync and serve them.
import { env } from "process";
import { rm } from "fs/promises";
import { join } from "path";

import test from "ava";
import { Wallet } from "ethers";
import Database from "better-sqlite3";

import * as id from "../src/id.mjs";
import * as store from "../src/store.mjs";
import * as communities from "../src/communities.mjs";
import * as cache from "../src/cache.mjs";
import { put, serialize } from "../src/sync.mjs";
import { listMessages, handleMessage } from "../src/api.mjs";
import {
  PROTOCOL,
  EIP712_MESSAGE,
  EIP712_COMMUNITY,
  EIP712_COMMUNITY_MESSAGE,
} from "../src/constants.mjs";
import { PHOSPHOR_ICONS } from "../src/phosphor-icons.mjs";

const T = 1700000000;
const db = new Database(join(env.CACHE_DIR, "database.db"));

test.before(() => {
  // NOTE: The lifetime cache that store.posts uses, and the tables these tests
  // read, without the foreign keys of cache.initialize: the test database is
  // shared with other test files, whose cleanups rely on that.
  cache.initializeLtCache();
  for (const table of [
    `submissions (id TEXT PRIMARY KEY NOT NULL, href TEXT NOT NULL UNIQUE, title TEXT NOT NULL, timestamp INTEGER NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL, community TEXT)`,
    `upvotes (id TEXT PRIMARY KEY NOT NULL, href TEXT NOT NULL, timestamp INTEGER NOT NULL, title TEXT NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL)`,
  ]) {
    db.exec(`CREATE TABLE IF NOT EXISTS ${table}`);
  }
  cache.initializeCommunities();
});

let dirs = 0;
async function freshTrie(t) {
  const dir = `dbtestCommunities${++dirs}`;
  await rm(dir, { recursive: true, force: true });
  env.DATA_DIR = dir;
  t.teardown(() => rm(dir, { recursive: true, force: true }));
  store.upvotes.clear();
  return await store.create();
}

function draft(overrides = {}) {
  return communities.create({
    name: "AI",
    about: "Links about building with AI.",
    rules: ["Link to the original source.", "No price talk."],
    icon: "robot",
    color: "#6E56CF",
    timestamp: T,
    ...overrides,
  });
}

async function signCommunity(signer, overrides) {
  return await id.sign(signer, draft(overrides), EIP712_COMMUNITY);
}

async function signPost(signer, community, timestamp, href) {
  const message = id.create(
    "A story",
    href ?? `https://example.com/${Math.random()}`,
    "amplify",
    timestamp,
    community,
  );
  return await id.sign(signer, message, EIP712_COMMUNITY_MESSAGE);
}

function add(trie, message, delegations = {}, synching = false) {
  return store.add(trie, message, null, delegations, synching);
}

// Drops a community from this process's table, e.g. to stand for a node that
// doesn't have it.
function forgetCommunity(signer, name = "AI") {
  db.prepare(`DELETE FROM communities WHERE signer = ? AND key = ?`).run(
    signer.toLowerCase(),
    communities.nameKey(name),
  );
}

function submissionCommunity(href) {
  return db.prepare(`SELECT community FROM submissions WHERE href = ?`).get(href)
    ?.community;
}

// --- Protocol version -----------------------------------------------------

test("communities bump the protocol versions", (t) => {
  t.is(PROTOCOL.pubsub.topics.roots.version, "13.0.0");
  t.is(PROTOCOL.pubsub.topics.messages.version, "13.0.0");
  t.is(PROTOCOL.protocols.leaves.version, "16.0.0");
  t.is(PROTOCOL.protocols.levels.version, "16.0.0");
});

// --- Names and IDs --------------------------------------------------------

test("a community's ID is the owner's address and the name key", (t) => {
  t.is(communities.nameKey("Agent Builders"), "agent-builders");
  t.is(communities.nameKey("web3-dev"), "web3-dev");
  t.is(
    communities.communityId("0x0f6A79A579658E401E0B81c6dde1F2cd51d97176", "AI"),
    "0x0f6a79a579658e401e0b81c6dde1f2cd51d97176/ai",
  );
});

test("the icons are Phosphor 2.1.1", (t) => {
  t.is(PHOSPHOR_ICONS.length, 1512);
  t.is(new Set(PHOSPHOR_ICONS).size, 1512);
  t.true(PHOSPHOR_ICONS.includes("robot"));
  t.false(PHOSPHOR_ICONS.some((name) => /-(thin|light|bold|fill|duotone)$/.test(name)));
});

// --- Schema and signatures ------------------------------------------------

test("a community is signed and verified as its own EIP-712 type", async (t) => {
  const signer = Wallet.createRandom();
  const message = await signCommunity(signer);
  t.is(id.messageTypes(message), EIP712_COMMUNITY);
  t.is(id.verify(message), signer.address);
});

test("a post to a community is signed as the 5-field Message", async (t) => {
  const signer = Wallet.createRandom();
  const post = await signPost(signer, `${signer.address}/ai`, T);
  t.is(id.messageTypes(post), EIP712_COMMUNITY_MESSAGE);
  t.is(id.verify(post), signer.address);

  // A signature over the 4-field Message doesn't carry over: the community
  // isn't part of what was signed, so the signer doesn't recover.
  const plain = id.create("A story", "https://example.com/x", "amplify", T);
  const signed = await id.sign(signer, plain, EIP712_MESSAGE);
  const moved = { ...signed, community: `${signer.address}/ai` };
  t.not(id.verify(moved), signer.address);
});

const valid = [
  ["a name with a space", { name: "Agent Builders" }],
  ["a name with a hyphen and digits", { name: "web3-dev" }],
  ["a 24 character name", { name: "a".repeat(24) }],
  ["no rules", { rules: [] }],
  ["five rules of 140 characters", { rules: Array(5).fill("r".repeat(140)) }],
  ["an empty description", { about: "" }],
  ["a 100 character description", { about: "a".repeat(100) }],
  ["unicode in texts", { about: "Für alle 🥝", rules: ["Kein Spam ✋"] }],
  ["a hex colour outside the designer's palette", { color: "#123ABC" }],
  ["a lowercase hex colour", { color: "#6e56cf" }],
];
for (const [title, overrides] of valid) {
  test(`a community with ${title} is valid`, async (t) => {
    const signer = Wallet.createRandom();
    t.is(id.verify(await signCommunity(signer, overrides)), signer.address);
  });
}

const invalid = [
  ["an icon that isn't in Phosphor", { icon: "not-an-icon" }],
  ["an icon with a weight suffix", { icon: "robot-bold" }],
  ["no icon", { icon: "" }],
  ["a colour name", { color: "violet" }],
  ["a 3-digit hex colour", { color: "#FFF" }],
  ["a hex colour with alpha", { color: "#6E56CF80" }],
  ["a hex colour without #", { color: "6E56CF" }],
  ["a colour that isn't hex", { color: "#GGGGGG" }],
  ["six rules", { rules: Array(6).fill("rule") }],
  ["a rule of 141 characters", { rules: ["r".repeat(141)] }],
  ["an empty rule", { rules: [""] }],
  ["a rule with a line break", { rules: ["one\ntwo"] }],
  ["a description of 101 characters", { about: "a".repeat(101) }],
  ["a description with a line break", { about: "one\ntwo" }],
  ["an empty name", { name: "" }],
  ["a 25 character name", { name: "a".repeat(25) }],
  ["a name with a leading space", { name: " AI" }],
  ["a name with two spaces in a row", { name: "Agent  Builders" }],
  ["a name with a trailing hyphen", { name: "AI-" }],
  ["a name with punctuation", { name: "AI!" }],
  ["a name with an emoji", { name: "AI 🥝" }],
];
for (const [title, overrides] of invalid) {
  test(`a community with ${title} is rejected`, async (t) => {
    const message = await signCommunity(Wallet.createRandom(), overrides);
    t.throws(() => id.verify(message), { message: /Wrongly formatted message/ });
  });
}

test("a community can't carry fields beyond the schema", async (t) => {
  const signer = Wallet.createRandom();
  const message = { ...(await signCommunity(signer)), deleted: true };
  t.throws(() => id.verify(message), { message: /Wrongly formatted message/ });
  const { rules, ...missing } = await signCommunity(signer);
  t.throws(() => id.verify(missing), { message: /Wrongly formatted message/ });
});

test("a post's community must be an address and a name key", async (t) => {
  const signer = Wallet.createRandom();
  const address = signer.address;
  for (const community of [
    `${address}/AI`,
    `${address}/agent builders`,
    `${address}`,
    "ai",
    `${address.slice(0, 41)}/ai`,
    `${address}/${"a".repeat(25)}`,
    "",
  ]) {
    const post = await signPost(signer, community, T);
    t.throws(() => id.verify(post), { message: /Wrongly formatted message/ }, community);
  }
});

test("comments can't name a community", async (t) => {
  const signer = Wallet.createRandom();
  const comment = id.create("hi", `kiwi:0x${"a".repeat(72)}`, "comment", T, `${signer.address}/ai`);
  const signed = await id.sign(signer, comment, EIP712_COMMUNITY_MESSAGE);
  t.throws(() => id.verify(signed), { message: /Wrongly formatted message/ });
});

// --- Store ----------------------------------------------------------------

test.serial("a post to an existing, older community is stored", async (t) => {
  const trie = await freshTrie(t);
  const owner = Wallet.createRandom();
  const poster = Wallet.createRandom();
  await add(trie, await signCommunity(owner));

  const id_ = communities.communityId(owner.address, "AI");
  const href = `https://example.com/story-${Date.now()}`;
  const index = await add(trie, await signPost(poster, id_, T + 1, href));
  t.truthy(index);

  const [post] = await store.leaves(trie, null, null, JSON.parse, null, null, "amplify");
  t.is(post.community, id_);
  t.is(submissionCommunity(href), id_);
});

test.serial("a post to a community that doesn't exist is rejected", async (t) => {
  const trie = await freshTrie(t);
  const poster = Wallet.createRandom();
  const post = await signPost(poster, `${poster.address}/ai`, T + 1);
  await t.throwsAsync(() => add(trie, post), {
    message: "add: Didn't find the community of the post",
  });
  t.is((await store.leaves(trie, null, null, JSON.parse, null, null, "amplify")).length, 0);
});

test.serial("a post can't be as old as or older than its community", async (t) => {
  const trie = await freshTrie(t);
  const owner = Wallet.createRandom();
  await add(trie, await signCommunity(owner, { timestamp: T + 10 }));
  const id_ = communities.communityId(owner.address, "AI");
  for (const timestamp of [T + 10, T + 9]) {
    await t.throwsAsync(async () => add(trie, await signPost(owner, id_, timestamp)), {
      message: "add: The community must be older than the post",
    });
  }
  t.truthy(await add(trie, await signPost(owner, id_, T + 11)));
});

test.serial("a post may name the owner's address in any case", async (t) => {
  const trie = await freshTrie(t);
  const owner = Wallet.createRandom();
  await add(trie, await signCommunity(owner, { name: "Agent Builders" }));
  const href = `https://example.com/checksummed-${Date.now()}`;
  await add(trie, await signPost(owner, `${owner.address}/agent-builders`, T + 1, href));
  t.is(submissionCommunity(href), `${owner.address.toLowerCase()}/agent-builders`);
});

test.serial("another owner's community of the same name is a different community", async (t) => {
  const trie = await freshTrie(t);
  const alice = Wallet.createRandom();
  const bob = Wallet.createRandom();
  await add(trie, await signCommunity(alice));
  await add(trie, await signCommunity(bob, { color: "#1F8A7A" }));
  t.is(cache.getCommunity(communities.communityId(alice.address, "AI")).color, "#6E56CF");
  t.is(cache.getCommunity(communities.communityId(bob.address, "AI")).color, "#1F8A7A");
  // Bob's community doesn't make a post to a community Carol never created valid.
  const carol = Wallet.createRandom();
  await t.throwsAsync(async () => add(trie, await signPost(bob, `${carol.address}/ai`, T + 1)), {
    message: "add: Didn't find the community of the post",
  });
});

test.serial("a community signed with a delegated key belongs to the account", async (t) => {
  const trie = await freshTrie(t);
  const account = Wallet.createRandom();
  const device = Wallet.createRandom();
  const delegations = { [device.address]: account.address };
  await add(trie, await signCommunity(device), delegations);

  const community = cache.getCommunity(
    communities.communityId(account.address, "AI"),
    delegations,
  );
  t.is(community.owner, account.address);
  t.truthy(await add(trie, await signPost(device, `${account.address}/ai`, T + 1), delegations));
  await t.throwsAsync(async () => add(trie, await signPost(device, `${device.address}/ai`, T + 2), delegations), {
    message: "add: Didn't find the community of the post",
  });
});

test.serial("a community stored before its delegation was known belongs to the account once it is", async (t) => {
  const trie = await freshTrie(t);
  const account = Wallet.createRandom();
  const device = Wallet.createRandom();
  const before = {};
  const after = { [device.address]: account.address };
  // The node stores the community while it doesn't know the delegation yet,
  // e.g. right after the user delegated.
  await add(trie, await signCommunity(device), before);
  t.truthy(cache.getCommunity(`${device.address}/ai`, before));

  // Once it knows it, the community is the account's, as on a node that only
  // ever knew the delegation.
  t.is(cache.getCommunity(`${account.address}/ai`, after).owner, account.address);
  t.is(cache.getCommunity(`${device.address}/ai`, after), null);
  t.truthy(await add(trie, await signPost(device, `${account.address}/ai`, T + 1), after));
  await t.throwsAsync(
    async () => add(trie, await signPost(device, `${device.address}/ai`, T + 2), after),
    { message: "add: Didn't find the community of the post" },
  );
});

test("two nodes that stored a community with different delegations judge posts alike", (t) => {
  const account = Wallet.createRandom().address;
  const device = Wallet.createRandom().address;
  const version = {
    ...draft(),
    index: "ff".repeat(36),
    signer: device,
  };
  // Node A stored it before it knew the delegation, node B after. The rows
  // don't depend on that.
  const [a, b] = [new Database(":memory:"), new Database(":memory:")];
  for (const node of [a, b]) {
    cache.initializeCommunities(node);
    cache.insertCommunity(version, node);
  }
  t.deepEqual(
    a.prepare(`SELECT * FROM communities`).all(),
    b.prepare(`SELECT * FROM communities`).all(),
  );
  for (const delegations of [{}, { [device]: account }]) {
    for (const owner of [account, device]) {
      t.is(
        cache.communityCreatedAt(`${owner}/ai`, delegations, a),
        cache.communityCreatedAt(`${owner}/ai`, delegations, b),
      );
    }
  }
  t.is(cache.communityCreatedAt(`${account}/ai`, { [device]: account }, a), T);
  t.is(cache.communityCreatedAt(`${device}/ai`, { [device]: account }, a), undefined);
});

test("versions signed by an account and its device key make one community", (t) => {
  const account = Wallet.createRandom().address;
  const device = Wallet.createRandom().address;
  const node = new Database(":memory:");
  cache.initializeCommunities(node);
  cache.insertCommunity({ ...draft({ about: "from the device" }), index: "01".repeat(36), signer: device }, node);
  cache.insertCommunity(
    { ...draft({ about: "from the account", timestamp: T + 9 }), index: "02".repeat(36), signer: account },
    node,
  );
  const delegations = { [device]: account };
  const [community] = cache.listCommunities(delegations, node);
  t.is(cache.listCommunities(delegations, node).length, 1);
  t.is(community.owner, account);
  t.is(community.id, `${account.toLowerCase()}/ai`);
  t.is(community.about, "from the account");
  t.is(community.created, T);
  t.deepEqual(cache.getCommunity(community.id, delegations, node), community);
  // Without the delegation they're two communities.
  t.is(cache.listCommunities({}, node).length, 2);
});

test.serial("a community whose trie write fails leaves the table as it was", async (t) => {
  const owner = Wallet.createRandom();
  const failing = {
    get: async () => null,
    put: async () => {
      throw new Error("trie.put error");
    },
    root: () => Buffer.from("abc", "hex"),
  };
  const first = await signCommunity(owner);
  await t.throwsAsync(() => add(failing, first), { message: /trie.put error/ });
  t.is(cache.communityCreatedAt(`${owner.address}/ai`), undefined);

  // An existing row goes back to how it was.
  const trie = await freshTrie(t);
  await add(trie, first);
  const before = db
    .prepare(`SELECT * FROM communities WHERE signer = ?`)
    .get(owner.address.toLowerCase());
  const update = await signCommunity(owner, { about: "update", timestamp: T + 1 });
  await t.throwsAsync(() => add(failing, update), { message: /trie.put error/ });
  t.deepEqual(
    db.prepare(`SELECT * FROM communities WHERE signer = ?`).get(owner.address.toLowerCase()),
    before,
  );
});

test.serial("a community the table can't take isn't stored, so a peer offers it again", async (t) => {
  const trie = await freshTrie(t);
  const owner = Wallet.createRandom();
  db.exec(`ALTER TABLE communities RENAME TO communities_away`);
  t.teardown(() => {
    db.exec(`DROP TABLE IF EXISTS communities`);
    db.exec(`ALTER TABLE communities_away RENAME TO communities`);
  });
  const message = await signCommunity(owner);
  await t.throwsAsync(() => add(trie, message), { message: /no such table/ });
  t.is((await store.leaves(trie, null, null, JSON.parse, null, null, "community")).length, 0);
});

test("putting communities back skips broken entries and keeps going", async (t) => {
  const node = new Database(":memory:");
  cache.initializeCommunities(node);
  const signer = Wallet.createRandom().address;
  await cache.insertCommunities(
    [undefined, null, {}, { ...draft(), index: "03".repeat(36), signer }],
    node,
  );
  t.is(cache.communityCreatedAt(`${signer}/ai`, {}, node), T);
});

test("a missing communities table reads as no community", (t) => {
  const node = new Database(":memory:");
  t.is(cache.communityCreatedAt(`${Wallet.createRandom().address}/ai`, {}, node), undefined);
});

test.serial("signing a community again under its name updates it", async (t) => {
  const trie = await freshTrie(t);
  const owner = Wallet.createRandom();
  await add(trie, await signCommunity(owner, { about: "first" }));
  // Same key, different spelling: still the same community.
  await add(trie, await signCommunity(owner, { name: "ai", about: "second", timestamp: T + 100, icon: "brain" }));

  const community = cache.getCommunity(communities.communityId(owner.address, "AI"));
  t.is(community.name, "ai");
  t.is(community.about, "second");
  t.is(community.icon, "brain");
  t.is(community.created, T);
  t.is(community.timestamp, T + 100);
  t.is((await store.leaves(trie, null, null, JSON.parse, null, null, "community")).length, 2);
  // Posts count from the first version.
  t.truthy(await add(trie, await signPost(owner, `${owner.address}/ai`, T + 50)));
});

test.serial("an older version that arrives later keeps the newest content and moves the creation back", async (t) => {
  const trie = await freshTrie(t);
  const owner = Wallet.createRandom();
  const id_ = `${owner.address}/ai`;
  const older = await signCommunity(owner, { about: "older", timestamp: T });
  const newer = await signCommunity(owner, { about: "newer", timestamp: T + 100 });
  const post = await signPost(owner, id_, T + 50);

  await add(trie, newer, {}, true);
  await t.throwsAsync(() => add(trie, post, {}, true), {
    message: "add: The community must be older than the post",
  });
  await add(trie, older, {}, true);
  t.truthy(await add(trie, post, {}, true));

  const community = cache.getCommunity(id_);
  t.is(community.about, "newer");
  t.is(community.created, T);
});

test.serial("of two versions with the same timestamp, every node keeps the same one", async (t) => {
  const owner = Wallet.createRandom();
  const a = await signCommunity(owner, { about: "a", timestamp: T + 5 });
  const b = await signCommunity(owner, { about: "b", timestamp: T + 5 });
  const winner = id.toDigest(a).index > id.toDigest(b).index ? "a" : "b";
  for (const order of [
    [a, b],
    [b, a],
  ]) {
    const trie = await freshTrie(t);
    forgetCommunity(owner.address);
    for (const message of order) await add(trie, message);
    t.is(cache.getCommunity(`${owner.address}/ai`).about, winner);
  }
});

test.serial("the same community version can't be added twice", async (t) => {
  const trie = await freshTrie(t);
  const owner = Wallet.createRandom();
  const message = await signCommunity(owner);
  await add(trie, message);
  await t.throwsAsync(() => add(trie, message), { message: /already exists in the trie/ });
});

test.serial("a community missing from the table comes back when the node re-reads the trie", async (t) => {
  const trie = await freshTrie(t);
  const owner = Wallet.createRandom();
  const id_ = communities.communityId(owner.address, "AI");
  await add(trie, await signCommunity(owner));
  t.is(cache.communityCreatedAt(id_), T);

  // E.g. a failed insert: the node rejects posts to the community...
  forgetCommunity(owner.address);
  const post = await signPost(owner, id_, T + 1);
  await t.throwsAsync(() => add(trie, post), {
    message: "add: Didn't find the community of the post",
  });

  // ...until launch.mjs puts the trie's communities into the table again.
  await cache.insertCommunities(
    await store.posts(trie, null, null, JSON.parse, null, {}, null, "community"),
  );
  t.is(cache.communityCreatedAt(id_), T);
  t.truthy(await add(trie, post));
});

test.serial("a post to a link that's already a story counts as an upvote", async (t) => {
  const trie = await freshTrie(t);
  const owner = Wallet.createRandom();
  const reader = Wallet.createRandom();
  await add(trie, await signCommunity(owner));
  const href = `https://example.com/already-${Date.now()}`;
  const story = id.create("A story", href, "amplify", T + 1);
  await add(trie, await id.sign(owner, story, EIP712_MESSAGE));

  await add(trie, await signPost(reader, `${owner.address}/ai`, T + 2, href));
  t.is(submissionCommunity(href), null);
  const upvotes = db.prepare(`SELECT identity FROM upvotes WHERE href = ?`).all(href);
  t.deepEqual(upvotes.map((row) => row.identity), [reader.address]);
  // And it is still one upvote per person.
  await t.throwsAsync(async () => add(trie, await signPost(reader, `${owner.address}/ai`, T + 3, href)), {
    message: /duplicate/,
  });
});

test.serial("listing leaves by type and href skips communities", async (t) => {
  const trie = await freshTrie(t);
  const owner = Wallet.createRandom();
  await add(trie, await signCommunity(owner));
  const href = `https://example.com/listed-${Date.now()}`;
  await add(trie, await signPost(owner, `${owner.address}/ai`, T + 1, href));

  const all = await store.leaves(trie, null, null, JSON.parse, null, null, "community");
  t.is(all.length, 1);
  t.is(all[0].type, "community");
  const byHref = await store.leaves(trie, null, null, JSON.parse, null, href, "amplify");
  t.is(byHref.length, 1);
  t.is(byHref[0].href, href);
});

test.serial("posts recover the signers of communities and community posts", async (t) => {
  const trie = await freshTrie(t);
  const owner = Wallet.createRandom();
  await add(trie, await signCommunity(owner));
  await add(trie, await signPost(owner, `${owner.address}/ai`, T + 1));

  const [community] = await store.posts(trie, null, null, JSON.parse, null, {}, null, "community");
  t.is(community.signer, owner.address);
  t.is(community.identity, owner.address);
  const [post] = await store.posts(trie, null, null, JSON.parse, null, {}, null, "amplify");
  t.is(post.signer, owner.address);
});

// --- Sync -----------------------------------------------------------------

async function missingLeaves(trie) {
  const leaves = await store.leaves(trie, null, null, null, null, null, "amplify");
  const nodes = [];
  for (const value of leaves) {
    const { index } = id.toDigest(JSON.parse(value));
    const key = Buffer.from(index, "hex");
    const { node } = await trie.findPath(key);
    nodes.push({ key, hash: Buffer.from("00", "hex"), node });
  }
  return nodes;
}

test.serial("a peer syncs a community and its posts", async (t) => {
  const source = await freshTrie(t);
  const owner = Wallet.createRandom();
  await add(source, await signCommunity(owner));
  await add(source, await signPost(owner, `${owner.address}/ai`, T + 1));
  await add(source, await signCommunity(owner, { about: "updated", timestamp: T + 2 }));
  const nodes = serialize(await missingLeaves(source));
  t.is(nodes.length, 3);

  const target = await freshTrie(t);
  await put(target, nodes, {});
  t.is(target.root().toString("hex"), source.root().toString("hex"));
});

test.serial("a peer drops a post whose community it lacks, and takes it once the community arrives", async (t) => {
  const source = await freshTrie(t);
  const owner = Wallet.createRandom();
  await add(source, await signCommunity(owner));
  await add(source, await signPost(owner, `${owner.address}/ai`, T + 1));
  const [community, post] = await missingLeaves(source);

  // NOTE: Both "nodes" share this process's SQLite cache; the target's must
  // not know the community yet.
  forgetCommunity(owner.address);
  const target = await freshTrie(t);
  await put(target, serialize([post]), {});
  t.is((await store.leaves(target, null, null, JSON.parse, null, null, "amplify")).length, 0);
  await put(target, serialize([community]), {});
  await put(target, serialize([(await missingLeaves(source))[1]]), {});
  t.is(target.root().toString("hex"), source.root().toString("hex"));
});

// --- HTTP API -------------------------------------------------------------

function capture() {
  let response;
  const reply = {
    status: () => reply,
    json: (body) => {
      response = body;
      return body;
    },
  };
  return { reply, response: () => response };
}

test.serial("the API takes communities and community posts and lists communities", async (t) => {
  const trie = await freshTrie(t);
  const owner = Wallet.createRandom();
  const handler = handleMessage(trie, null, async () => ({}));

  const created = capture();
  await handler({ body: await signCommunity(owner), query: {} }, created.reply);
  t.is(created.response().code, 200);

  const posted = capture();
  await handler(
    { body: await signPost(owner, `${owner.address}/ai`, Math.floor(Date.now() / 1000)), query: {} },
    posted.reply,
  );
  t.is(posted.response().code, 200);

  const rejected = capture();
  await handler(
    { body: await signPost(owner, `${owner.address}/nope`, Math.floor(Date.now() / 1000)), query: {} },
    rejected.reply,
  );
  t.is(rejected.response().code, 400);
  t.regex(rejected.response().details, /Didn't find the community/);

  const listed = capture();
  await listMessages(trie, async () => ({}))(
    { body: { from: 0, amount: 10, type: "community" } },
    listed.reply,
  );
  t.is(listed.response().data.length, 1);
  t.is(listed.response().data[0].name, "AI");
  t.is(listed.response().data[0].identity, owner.address);
});

// --- Cache migration --------------------------------------------------------

test("a cache from before communities gets the column and the table", (t) => {
  const old = new Database(":memory:");
  old.exec(
    `CREATE TABLE submissions (id TEXT PRIMARY KEY NOT NULL, href TEXT NOT NULL UNIQUE, title TEXT NOT NULL, timestamp INTEGER NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL)`,
  );
  old
    .prepare(`INSERT INTO submissions VALUES (?, ?, ?, ?, ?, ?)`)
    .run("kiwi:0x01", "https://example.com", "Old story", T, "0x1", "0x1");
  cache.initializeCommunities(old);

  const columns = old.prepare(`PRAGMA table_info(submissions)`).all();
  t.true(columns.some(({ name }) => name === "community"));
  t.is(old.prepare(`SELECT community FROM submissions`).get().community, null);
  t.truthy(
    old.prepare(`SELECT name FROM sqlite_master WHERE name = 'communities'`).get(),
  );
  // Running it again, as every start does, changes nothing.
  t.notThrows(() => cache.initializeCommunities(old));
});

test("a communities table from the first 13.0.0 release is replaced", (t) => {
  const node = new Database(":memory:");
  node.exec(
    `CREATE TABLE communities (id TEXT PRIMARY KEY NOT NULL, owner TEXT NOT NULL, name TEXT NOT NULL, about TEXT NOT NULL, rules TEXT NOT NULL, icon TEXT NOT NULL, color TEXT NOT NULL, created INTEGER NOT NULL, timestamp INTEGER NOT NULL, message TEXT NOT NULL, signer TEXT NOT NULL)`,
  );
  cache.initializeCommunities(node);
  const columns = node.prepare(`PRAGMA table_info(communities)`).all().map(({ name }) => name);
  t.true(columns.includes("key"));
  t.false(columns.includes("owner"));
});

test("a fresh cache gets the communities table before the submissions table exists", (t) => {
  const fresh = new Database(":memory:");
  cache.initializeCommunities(fresh);
  t.truthy(
    fresh.prepare(`SELECT name FROM sqlite_master WHERE name = 'communities'`).get(),
  );
  t.falsy(
    fresh.prepare(`SELECT name FROM sqlite_master WHERE name = 'submissions'`).get(),
  );
});
