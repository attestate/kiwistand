// @format
// Community membership (protocol 14.0.0): the `Membership` message (join and
// leave), how nodes store, sync and count it, the API that reads it, and the
// owner's notifications.
import { env } from "process";
import { rm } from "fs/promises";
import { join } from "path";

import test from "ava";
import { Wallet, utils } from "ethers";
import Database from "better-sqlite3";

import * as id from "../src/id.mjs";
import * as store from "../src/store.mjs";
import * as communities from "../src/communities.mjs";
import * as memberships from "../src/memberships.mjs";
import * as cache from "../src/cache.mjs";
import * as api from "../src/communities-api.mjs";
import * as activity from "../src/views/activity.mjs";
import { groupJoins } from "../src/views/activity-groups.mjs";
import {
  triggerJoinNotification,
  resetJoinNotifications,
  JOIN_NOTIFICATION_WINDOW_MS,
} from "../src/subscriptions.mjs";
import { put, serialize } from "../src/sync.mjs";
import { listMessages, handleMessage } from "../src/api.mjs";
import {
  PROTOCOL,
  EIP712_COMMUNITY,
  EIP712_COMMUNITY_MESSAGE,
  EIP712_MEMBERSHIP,
} from "../src/constants.mjs";

const T = 1700000000;
const now = () => Math.floor(Date.now() / 1000);
const db = new Database(join(env.CACHE_DIR, "database.db"));

test.before(() => {
  // NOTE: The lifetime cache that store.posts uses, and the tables these tests
  // read, without the foreign keys of cache.initialize: the test database is
  // shared with other test files, whose cleanups rely on that.
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

let dirs = 0;
async function freshTrie(t) {
  const dir = `dbtestMemberships${++dirs}`;
  await rm(dir, { recursive: true, force: true });
  env.DATA_DIR = dir;
  t.teardown(() => rm(dir, { recursive: true, force: true }));
  store.upvotes.clear();
  return await store.create();
}

async function signCommunity(signer, overrides = {}) {
  const draft = communities.create({
    name: "AI",
    about: "Links about building with AI.",
    rules: ["Link to the original source."],
    icon: "robot",
    color: "#6E56CF",
    timestamp: T,
    ...overrides,
  });
  return await id.sign(signer, draft, EIP712_COMMUNITY);
}

async function signMembership(signer, type, community, timestamp) {
  const message = memberships.create({ type, community, timestamp });
  return await id.sign(signer, message, EIP712_MEMBERSHIP);
}

function add(trie, message, delegations = {}, synching = false) {
  return store.add(trie, message, null, delegations, synching);
}

// A community owned by a new wallet, in a fresh trie: {trie, owner, id}.
async function setup(t, overrides) {
  const trie = await freshTrie(t);
  const owner = Wallet.createRandom();
  await add(trie, await signCommunity(owner, overrides));
  const id_ = communities.communityId(owner.address, overrides?.name ?? "AI");
  return { trie, owner, id: id_ };
}

function members(id_, delegations = {}) {
  return cache.memberCounts([id_], delegations).get(id_.toLowerCase());
}

// Drops a signer's rows, e.g. to stand for a node that doesn't have them.
function forgetMemberships(signer) {
  db.prepare(`DELETE FROM memberships WHERE signer = ?`).run(
    signer.toLowerCase(),
  );
}

function forgetCommunity(signer, name = "AI") {
  db.prepare(`DELETE FROM communities WHERE signer = ? AND key = ?`).run(
    signer.toLowerCase(),
    communities.nameKey(name),
  );
}

// --- Protocol version -----------------------------------------------------

test("membership bumps the protocol versions", (t) => {
  t.is(PROTOCOL.pubsub.topics.roots.version, "14.0.0");
  t.is(PROTOCOL.pubsub.topics.messages.version, "14.0.0");
  t.is(PROTOCOL.protocols.leaves.version, "17.0.0");
  t.is(PROTOCOL.protocols.levels.version, "17.0.0");
});

// --- Signatures -------------------------------------------------------------

test("joins and leaves are signed and verified as Membership", async (t) => {
  const signer = Wallet.createRandom();
  const community = `${Wallet.createRandom().address}/ai`;
  for (const type of ["join", "leave"]) {
    const message = await signMembership(signer, type, community, T);
    t.deepEqual(Object.keys(message).sort(), [
      "community",
      "signature",
      "timestamp",
      "type",
    ]);
    // NOTE: It has a `community` like a post to a community, but its type
    // decides.
    t.is(id.messageTypes(message), EIP712_MEMBERSHIP);
    t.is(id.verify(message), signer.address);
  }
});

test("a join's signature doesn't make a leave, or the other way round", async (t) => {
  const signer = Wallet.createRandom();
  const community = `${Wallet.createRandom().address}/ai`;
  const join = await signMembership(signer, "join", community, T);
  t.not(id.verify({ ...join, type: "leave" }), signer.address);
  const leave = await signMembership(signer, "leave", community, T);
  t.not(id.verify({ ...leave, type: "join" }), signer.address);
  // Nor another community or time.
  t.not(id.verify({ ...join, community: `${signer.address}/ai` }), signer.address);
  t.not(id.verify({ ...join, timestamp: T + 1 }), signer.address);
});

test("a membership signed as another type doesn't recover its signer", async (t) => {
  const signer = Wallet.createRandom();
  const message = memberships.create({
    type: "join",
    community: `${signer.address}/ai`,
    timestamp: T,
  });
  const wrong = await id.sign(
    signer,
    { ...message, title: "", href: "" },
    EIP712_COMMUNITY_MESSAGE,
  );
  const { title, href, ...moved } = wrong;
  t.not(id.verify(moved), signer.address);
});

// --- Schema -----------------------------------------------------------------

const owner = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
const validMemberships = [
  ["a join", "join", `${owner.toLowerCase()}/ai`],
  ["a leave", "leave", `${owner.toLowerCase()}/agent-builders`],
  ["a checksummed address in the ID", "join", `${owner}/ai`],
  ["a 24 character key", "join", `${owner}/${"a".repeat(24)}`],
];
for (const [title, type, community] of validMemberships) {
  test(`a membership with ${title} is valid`, async (t) => {
    const signer = Wallet.createRandom();
    const message = await signMembership(signer, type, community, T);
    t.is(id.verify(message), signer.address);
  });
}

const invalidMemberships = [
  ["another type", { type: "member" }],
  ["a capitalised type", { type: "Join" }],
  ["the past tense", { type: "joined" }],
  ["an ID without a key", { community: owner }],
  ["an uppercase key", { community: `${owner}/AI` }],
  ["a key with a space", { community: `${owner}/agent builders` }],
  ["a key of 25 characters", { community: `${owner}/${"a".repeat(25)}` }],
  ["a short address", { community: `${owner.slice(0, 41)}/ai` }],
  ["a bare name", { community: "ai" }],
  ["an empty ID", { community: "" }],
  ["a timestamp that isn't an integer", { timestamp: "1700000000" }],
];
for (const [title, overrides] of invalidMemberships) {
  test(`a membership with ${title} is rejected`, async (t) => {
    const signer = Wallet.createRandom();
    const message = await id.sign(
      signer,
      {
        ...memberships.create({
          type: "join",
          community: `${owner}/ai`,
          timestamp: T,
        }),
        ...overrides,
      },
      EIP712_MEMBERSHIP,
    ).catch(() => null);
    // NOTE: ethers refuses to sign some of these; a client could still send
    // them with any signature.
    const sent = message ?? {
      type: "join",
      community: `${owner}/ai`,
      timestamp: T,
      ...overrides,
      signature: "0x00",
    };
    t.throws(() => id.verify(sent), { message: /Wrongly formatted message/ });
  });
}

test("a membership can't carry fields beyond the schema or miss one", async (t) => {
  const signer = Wallet.createRandom();
  const message = await signMembership(signer, "join", `${owner}/ai`, T);
  for (const extra of [{ title: "" }, { href: "https://example.com" }, { name: "AI" }]) {
    t.throws(() => id.verify({ ...message, ...extra }), {
      message: /Wrongly formatted message/,
    });
  }
  for (const field of ["type", "community", "timestamp", "signature"]) {
    const { [field]: _, ...missing } = message;
    t.throws(() => id.verify(missing), { message: /Wrongly formatted message/ });
  }
});

// --- Store ------------------------------------------------------------------

test.serial("a join or leave of an existing, older community is stored", async (t) => {
  const { trie, id: id_ } = await setup(t);
  const member = Wallet.createRandom();
  t.truthy(await add(trie, await signMembership(member, "join", id_, T + 1)));
  t.truthy(await add(trie, await signMembership(member, "leave", id_, T + 2)));
  const leaves = await store.leaves(
    trie,
    null,
    null,
    JSON.parse,
    null,
    null,
    ["join", "leave"],
  );
  t.deepEqual(
    leaves.map(({ type }) => type),
    ["join", "leave"],
  );
});

test.serial("leaving a community you never joined is stored too", async (t) => {
  // NOTE: Nodes don't look at the signer's earlier messages, so a leave that
  // arrives before its join is taken like any other.
  const { trie, id: id_ } = await setup(t);
  const member = Wallet.createRandom();
  t.truthy(await add(trie, await signMembership(member, "leave", id_, T + 1)));
  t.is(members(id_), 1);
});

test.serial("a membership of a community that doesn't exist is rejected", async (t) => {
  const trie = await freshTrie(t);
  const member = Wallet.createRandom();
  for (const type of ["join", "leave"]) {
    const message = await signMembership(
      member,
      type,
      `${Wallet.createRandom().address}/ai`,
      T + 1,
    );
    await t.throwsAsync(() => add(trie, message), {
      message: "add: Didn't find the community to join or leave",
    });
  }
  t.is(
    (await store.leaves(trie, null, null, JSON.parse, null, null, ["join", "leave"]))
      .length,
    0,
  );
});

test.serial("a membership can't be as old as or older than its community", async (t) => {
  const { trie, id: id_ } = await setup(t, { timestamp: T + 10 });
  const member = Wallet.createRandom();
  for (const type of ["join", "leave"]) {
    for (const timestamp of [T + 10, T + 9]) {
      await t.throwsAsync(
        async () => add(trie, await signMembership(member, type, id_, timestamp)),
        { message: "add: The community must be older than the join or leave" },
      );
    }
  }
  t.truthy(await add(trie, await signMembership(member, "join", id_, T + 11)));
});

test.serial("a membership may name the owner's address in any case", async (t) => {
  const { trie, owner: o } = await setup(t, { name: "Agent Builders" });
  const member = Wallet.createRandom();
  await add(trie, await signMembership(member, "join", `${o.address}/agent-builders`, T + 1));
  t.is(members(`${o.address.toLowerCase()}/agent-builders`), 2);
  t.true(
    cache
      .joinedCommunities(member.address)
      .has(`${o.address.toLowerCase()}/agent-builders`),
  );
});

test.serial("the same join can't be added twice", async (t) => {
  const { trie, id: id_ } = await setup(t);
  const member = Wallet.createRandom();
  const message = await signMembership(member, "join", id_, T + 1);
  await add(trie, message);
  await t.throwsAsync(() => add(trie, message), {
    message: /already exists in the trie/,
  });
  t.is(members(id_), 2);
});

test.serial("joining again after leaving makes you a member again", async (t) => {
  const { trie, id: id_ } = await setup(t);
  const member = Wallet.createRandom();
  await add(trie, await signMembership(member, "join", id_, T + 1));
  t.is(members(id_), 2);
  await add(trie, await signMembership(member, "leave", id_, T + 2));
  t.is(members(id_), 1);
  await add(trie, await signMembership(member, "join", id_, T + 3));
  t.is(members(id_), 2);
});

test.serial("the newest membership wins in either order", async (t) => {
  const owner_ = Wallet.createRandom();
  const member = Wallet.createRandom();
  const community = await signCommunity(owner_);
  const id_ = communities.communityId(owner_.address, "AI");
  const join = await signMembership(member, "join", id_, T + 1);
  const leave = await signMembership(member, "leave", id_, T + 2);
  const rejoin = await signMembership(member, "join", id_, T + 3);
  for (const [order, expected] of [
    [[join, leave], 1],
    [[leave, join], 1],
    [[join, leave, rejoin], 2],
    [[rejoin, leave, join], 2],
    [[leave, rejoin, join], 2],
  ]) {
    const trie = await freshTrie(t);
    forgetMemberships(member.address);
    await add(trie, community);
    for (const message of order) await add(trie, message);
    t.is(members(id_), expected, order.map(({ type, timestamp }) => `${type}@${timestamp - T}`).join(","));
  }
});

test.serial("of a join and a leave with the same timestamp, every node keeps the same one", async (t) => {
  const owner_ = Wallet.createRandom();
  const member = Wallet.createRandom();
  const community = await signCommunity(owner_);
  const id_ = communities.communityId(owner_.address, "AI");
  const join = await signMembership(member, "join", id_, T + 5);
  const leave = await signMembership(member, "leave", id_, T + 5);
  const winner =
    id.toDigest(join).index > id.toDigest(leave).index ? "join" : "leave";
  for (const order of [
    [join, leave],
    [leave, join],
  ]) {
    const trie = await freshTrie(t);
    forgetMemberships(member.address);
    await add(trie, community);
    for (const message of order) await add(trie, message);
    t.is(members(id_), winner === "join" ? 2 : 1);
    t.is(cache.joinedCommunities(member.address).has(id_), winner === "join");
  }
});

test.serial("the owner is always a member", async (t) => {
  const { trie, owner: o, id: id_ } = await setup(t);
  t.is(members(id_), 1);
  // Joining their own community doesn't count them twice...
  await add(trie, await signMembership(o, "join", id_, T + 1));
  t.is(members(id_), 1);
  // ...and leaving it doesn't make them leave.
  await add(trie, await signMembership(o, "leave", id_, T + 2));
  t.is(members(id_), 1);
  const [listed] = await api.listCommunities({ member: o.address }, apiDeps);
  t.is(listed.id, id_);
});

test.serial("joins signed with a delegated key count for the account", async (t) => {
  const { trie, id: id_ } = await setup(t);
  const account = Wallet.createRandom();
  const device = Wallet.createRandom();
  const laptop = Wallet.createRandom();
  const delegations = {
    [device.address]: account.address,
    [laptop.address]: account.address,
  };
  await add(trie, await signMembership(device, "join", id_, T + 1), delegations);
  await add(trie, await signMembership(laptop, "join", id_, T + 2), delegations);
  // Two keys, one person.
  t.is(members(id_, delegations), 2);
  t.true(cache.joinedCommunities(account.address, delegations).has(id_));
  t.false(cache.joinedCommunities(device.address, delegations).has(id_));

  // The account's own leave is newer than both joins.
  await add(trie, await signMembership(account, "leave", id_, T + 3), delegations);
  t.is(members(id_, delegations), 1);
  t.false(cache.joinedCommunities(account.address, delegations).has(id_));

  // A node that doesn't know the delegations yet sees three people; once it
  // does, it comes to the same result as one that always knew them.
  t.is(members(id_, {}), 3);
});

test.serial("joining the community of an account that created it with a delegated key", async (t) => {
  const trie = await freshTrie(t);
  const account = Wallet.createRandom();
  const device = Wallet.createRandom();
  const delegations = { [device.address]: account.address };
  await add(trie, await signCommunity(device), delegations);
  const id_ = communities.communityId(account.address, "AI");
  const member = Wallet.createRandom();
  await add(trie, await signMembership(member, "join", id_, T + 1), delegations);
  // The owner signing a join with their device key doesn't count twice.
  await add(trie, await signMembership(device, "join", id_, T + 2), delegations);
  t.is(members(id_, delegations), 2);
  const joins = cache.getJoins(account.address, delegations);
  t.deepEqual(
    joins.map(({ identity }) => identity),
    [member.address],
  );
  t.is(joins[0].community.id, id_);
});

test.serial("a membership whose trie write fails leaves the table as it was", async (t) => {
  const { trie, id: id_ } = await setup(t);
  const member = Wallet.createRandom();
  const failing = {
    get: async () => null,
    put: async () => {
      throw new Error("trie.put error");
    },
    root: () => Buffer.from("abc", "hex"),
  };
  await t.throwsAsync(
    async () => add(failing, await signMembership(member, "join", id_, T + 1)),
    { message: /trie.put error/ },
  );
  t.is(members(id_), 1);

  // An existing row goes back to how it was.
  await add(trie, await signMembership(member, "join", id_, T + 1));
  const row = () =>
    db
      .prepare(`SELECT * FROM memberships WHERE signer = ?`)
      .get(member.address.toLowerCase());
  const before = row();
  await t.throwsAsync(
    async () => add(failing, await signMembership(member, "leave", id_, T + 2)),
    { message: /trie.put error/ },
  );
  t.deepEqual(row(), before);
  t.is(members(id_), 2);
});

test.serial("a membership the table can't take isn't stored, so a peer offers it again", async (t) => {
  const { trie, id: id_ } = await setup(t);
  const member = Wallet.createRandom();
  db.exec(`ALTER TABLE memberships RENAME TO memberships_away`);
  t.teardown(() => {
    db.exec(`DROP TABLE IF EXISTS memberships`);
    db.exec(`ALTER TABLE memberships_away RENAME TO memberships`);
  });
  await t.throwsAsync(
    async () => add(trie, await signMembership(member, "join", id_, T + 1)),
    { message: /no such table/ },
  );
  t.is(
    (await store.leaves(trie, null, null, JSON.parse, null, null, "join")).length,
    0,
  );
});

test.serial("memberships missing from the table come back when the node re-reads the trie", async (t) => {
  const { trie, id: id_ } = await setup(t);
  const alice = Wallet.createRandom();
  const bob = Wallet.createRandom();
  await add(trie, await signMembership(alice, "join", id_, T + 1));
  await add(trie, await signMembership(bob, "join", id_, T + 2));
  await add(trie, await signMembership(bob, "leave", id_, T + 3));
  t.is(members(id_), 2);

  // E.g. a failed insert, or a cache from before 14.0.0.
  forgetMemberships(alice.address);
  forgetMemberships(bob.address);
  t.is(members(id_), 1);

  // launch.mjs walks the trie once for communities, joins and leaves.
  const messages = await store.posts(
    trie,
    null,
    null,
    JSON.parse,
    null,
    {},
    null,
    ["community", "join", "leave"],
  );
  t.deepEqual(
    messages.map(({ type }) => type),
    ["community", "join", "join", "leave"],
  );
  t.true(messages.every(({ signer }) => utils.isAddress(signer)));
  await cache.insertMemberships(
    messages.filter(({ type }) => type !== "community"),
  );
  t.is(members(id_), 2);
  t.true(cache.joinedCommunities(alice.address).has(id_));
  t.false(cache.joinedCommunities(bob.address).has(id_));
});

test("putting memberships back skips broken entries and keeps going", async (t) => {
  const node = new Database(":memory:");
  cache.initializeMemberships(node);
  const signer = Wallet.createRandom().address;
  const community = `${Wallet.createRandom().address.toLowerCase()}/ai`;
  await cache.insertMemberships(
    [
      undefined,
      null,
      {},
      { type: "join", signer },
      { type: "join", community, timestamp: T, index: "01".repeat(36), signer },
    ],
    node,
  );
  t.is(cache.memberCounts([community], {}, node).get(community), 2);
});

test("membership tables are created once and their reads tolerate a missing table", (t) => {
  const node = new Database(":memory:");
  const community = `${Wallet.createRandom().address.toLowerCase()}/ai`;
  t.is(cache.memberCounts([community], {}, node).get(community), 1);
  t.is(cache.joinedCommunities(Wallet.createRandom().address, {}, node).size, 0);
  t.deepEqual(cache.getJoins(Wallet.createRandom().address, {}, 0, node), []);
  cache.initializeMemberships(node);
  t.notThrows(() => cache.initializeMemberships(node));
});

test("two nodes that stored memberships with different delegations count alike", (t) => {
  const community = `${Wallet.createRandom().address.toLowerCase()}/ai`;
  const account = Wallet.createRandom().address;
  const device = Wallet.createRandom().address;
  const [a, b] = [new Database(":memory:"), new Database(":memory:")];
  const join = { type: "join", community, timestamp: T + 1, index: "aa".repeat(36), signer: device };
  const leave = { type: "leave", community, timestamp: T + 2, index: "bb".repeat(36), signer: account };
  // Node A got them in one order, node B in the other.
  for (const [node, order] of [
    [a, [join, leave]],
    [b, [leave, join]],
  ]) {
    cache.initializeMemberships(node);
    for (const message of order) cache.insertMembership(message, node);
  }
  t.deepEqual(
    a.prepare(`SELECT * FROM memberships ORDER BY signer`).all(),
    b.prepare(`SELECT * FROM memberships ORDER BY signer`).all(),
  );
  for (const delegations of [{}, { [utils.getAddress(device)]: utils.getAddress(account) }]) {
    t.is(
      cache.memberCounts([community], delegations, a).get(community),
      cache.memberCounts([community], delegations, b).get(community),
    );
  }
  t.is(cache.memberCounts([community], {}, a).get(community), 2);
  t.is(
    cache
      .memberCounts([community], { [utils.getAddress(device)]: utils.getAddress(account) }, a)
      .get(community),
    1,
  );
});

// --- Sync -------------------------------------------------------------------

// NOTE: Without a parser, leaves() returns every leaf, so this filters.
async function leafNodes(trie, types) {
  const wanted = Array.isArray(types) ? types : [types];
  const leaves = (
    await store.leaves(trie, null, null, null, null, null, types)
  ).filter((value) => wanted.includes(JSON.parse(value).type));
  const nodes = [];
  for (const value of leaves) {
    const { index } = id.toDigest(JSON.parse(value));
    const key = Buffer.from(index, "hex");
    const { node } = await trie.findPath(key);
    nodes.push({ key, hash: Buffer.from("00", "hex"), node });
  }
  return nodes;
}

test.serial("peers reach the same root and members in either order", async (t) => {
  const source = await freshTrie(t);
  const owner_ = Wallet.createRandom();
  const member = Wallet.createRandom();
  const other = Wallet.createRandom();
  await add(source, await signCommunity(owner_));
  const id_ = communities.communityId(owner_.address, "AI");
  await add(source, await signMembership(member, "join", id_, T + 1));
  await add(source, await signMembership(other, "join", id_, T + 2));
  await add(source, await signMembership(member, "leave", id_, T + 3));
  const [community] = await leafNodes(source, "community");
  const rest = await leafNodes(source, ["join", "leave"]);
  t.is(rest.length, 3);

  for (const order of [rest, [...rest].reverse()]) {
    // NOTE: Both "nodes" share this process's SQLite cache; the target must
    // start without the memberships.
    forgetMemberships(member.address);
    forgetMemberships(other.address);
    const target = await freshTrie(t);
    await put(target, serialize([community]), {});
    for (const node of order) await put(target, serialize([node]), {});
    t.is(target.root().toString("hex"), source.root().toString("hex"));
    t.is(members(id_), 2);
    t.false(cache.joinedCommunities(member.address).has(id_));
    t.true(cache.joinedCommunities(other.address).has(id_));
  }
});

test.serial("a peer drops a join whose community it lacks, and takes it once the community arrives", async (t) => {
  const source = await freshTrie(t);
  const owner_ = Wallet.createRandom();
  const member = Wallet.createRandom();
  await add(source, await signCommunity(owner_));
  const id_ = communities.communityId(owner_.address, "AI");
  await add(source, await signMembership(member, "join", id_, T + 1));
  const [community] = await leafNodes(source, "community");
  const [joined] = await leafNodes(source, "join");

  forgetCommunity(owner_.address);
  forgetMemberships(member.address);
  const target = await freshTrie(t);
  await put(target, serialize([joined]), {});
  t.is((await store.leaves(target, null, null, JSON.parse, null, null, "join")).length, 0);
  t.is(members(id_), 1);
  await put(target, serialize([community]), {});
  await put(target, serialize([joined]), {});
  t.is(target.root().toString("hex"), source.root().toString("hex"));
  t.is(members(id_), 2);
});

// --- Read API ---------------------------------------------------------------

const apiDeps = {
  delegations: async () => ({}),
  getLists: async () => ({ addresses: [] }),
  resolve: async (address) => ({
    displayName: `${address.slice(0, 6)}...${address.slice(-4)}`,
  }),
};

function reply() {
  const r = { statusCode: 200, headers: {} };
  r.status = (code) => ((r.statusCode = code), r);
  r.header = (name, value) => ((r.headers[name] = value), r);
  r.json = (body) => ((r.body = body), r);
  return r;
}

test.serial("every community the API returns has its member count", async (t) => {
  const { trie, owner: o, id: id_ } = await setup(t);
  for (const timestamp of [T + 1, T + 2, T + 3]) {
    await add(trie, await signMembership(Wallet.createRandom(), "join", id_, timestamp));
  }
  const leaver = Wallet.createRandom();
  await add(trie, await signMembership(leaver, "join", id_, T + 4));
  await add(trie, await signMembership(leaver, "leave", id_, T + 5));

  const [listed] = await api.listCommunities({ owner: o.address }, apiDeps);
  t.is(listed.members, 4);
  t.is(Object.keys(listed).at(-1), "members");
  const found = await api.findCommunity(o.address, "ai", apiDeps);
  t.is(found.members, 4);

  const r = reply();
  await api.detailHandler(apiDeps)({ params: { owner: o.address.toUpperCase().replace("0X", "0x"), key: "ai" } }, r);
  t.is(r.body.data.members, 4);
  t.is(r.headers["Cache-Control"], "public, s-maxage=30, max-age=0, stale-while-revalidate=300");

  // A community nobody joined has its owner.
  const lonely = await setup(t, { name: "Lonely" });
  t.is((await api.findCommunity(lonely.owner.address, "lonely", apiDeps)).members, 1);
});

test.serial("the list takes a member: the communities they joined and own", async (t) => {
  const trie = await freshTrie(t);
  const member = Wallet.createRandom();
  const [a, b, c] = [Wallet.createRandom(), Wallet.createRandom(), Wallet.createRandom()];
  for (const o of [a, b, c, member]) await add(trie, await signCommunity(o));
  const idOf = (w) => communities.communityId(w.address, "AI");
  await add(trie, await signMembership(member, "join", idOf(a), T + 1));
  await add(trie, await signMembership(member, "join", idOf(b), T + 1));
  await add(trie, await signMembership(member, "leave", idOf(b), T + 2));
  // Another person's join of c isn't member's.
  await add(trie, await signMembership(Wallet.createRandom(), "join", idOf(c), T + 1));

  for (const spelling of [member.address, member.address.toLowerCase()]) {
    const listed = await api.listCommunities({ member: spelling }, apiDeps);
    t.deepEqual(listed.map(({ id }) => id).sort(), [idOf(a), idOf(member)].sort());
  }
  // With the other filters.
  t.deepEqual(
    (await api.listCommunities({ member: member.address, owner: a.address }, apiDeps)).map(({ id }) => id),
    [idOf(a)],
  );
  t.deepEqual(await api.listCommunities({ member: Wallet.createRandom().address }, apiDeps), []);
  // A banned owner's community isn't listed.
  const banned = { ...apiDeps, getLists: async () => ({ addresses: [a.address.toLowerCase()] }) };
  t.deepEqual(
    (await api.listCommunities({ member: member.address }, banned)).map(({ id }) => id),
    [idOf(member)],
  );
});

test.serial("a member's communities count the account's delegated keys", async (t) => {
  const { trie, id: id_ } = await setup(t);
  const account = Wallet.createRandom();
  const device = Wallet.createRandom();
  const delegations = { [device.address]: account.address };
  await add(trie, await signMembership(device, "join", id_, T + 1), delegations);
  const deps = { ...apiDeps, delegations: async () => delegations };
  t.deepEqual(
    (await api.listCommunities({ member: account.address }, deps)).map(({ id }) => id),
    [id_],
  );
});

test.serial("the list handler doesn't cache a member's communities, and answers 400 for a bad member", async (t) => {
  const { trie, id: id_ } = await setup(t);
  const member = Wallet.createRandom();
  await add(trie, await signMembership(member, "join", id_, T + 1));

  const ok = reply();
  await api.listHandler(apiDeps)({ query: { member: member.address } }, ok);
  t.is(ok.statusCode, 200);
  t.deepEqual(ok.body.data.map(({ id }) => id), [id_]);
  t.is(ok.body.data[0].members, 2);
  t.is(ok.headers["Cache-Control"], "no-cache");

  for (const bad of ["nope", "0x123", ["0x0f6A79A579658E401E0B81c6dde1F2cd51d97176"]]) {
    const r = reply();
    await api.listHandler(apiDeps)({ query: { member: bad } }, r);
    t.is(r.statusCode, 400, JSON.stringify(bad));
    t.regex(r.body.details, /member must be an address/);
  }
});

test.serial("/list takes the join and leave types", async (t) => {
  const { trie, id: id_ } = await setup(t);
  const member = Wallet.createRandom();
  await add(trie, await signMembership(member, "join", id_, T + 1));
  await add(trie, await signMembership(member, "leave", id_, T + 2));
  for (const type of ["join", "leave"]) {
    const r = reply();
    await listMessages(trie, async () => ({}))(
      { body: { from: 0, amount: 10, type } },
      r,
    );
    t.is(r.body.data.length, 1);
    t.is(r.body.data[0].type, type);
    t.is(r.body.data[0].community, id_);
    t.is(r.body.data[0].identity, member.address);
  }
  const bad = reply();
  await listMessages(trie, async () => ({}))(
    { body: { from: 0, amount: 10, type: "membership" } },
    bad,
  );
  t.is(bad.statusCode, 400);
});

test.serial("the node's API takes joins and leaves, and tells the owner about joins only", async (t) => {
  const { trie, owner: o, id: id_ } = await setup(t);
  const member = Wallet.createRandom();
  const notified = [];
  const notify = async (message, delegations) => notified.push({ message, delegations });
  const handler = handleMessage(trie, null, async () => ({}), notify);
  const tick = () => new Promise((resolve) => setImmediate(resolve));

  const joined = reply();
  await handler({ body: await signMembership(member, "join", id_, now()), query: {} }, joined);
  t.is(joined.body.code, 200);
  await tick();
  t.is(notified.length, 1);
  t.is(notified[0].message.type, "join");

  const left = reply();
  await handler({ body: await signMembership(member, "leave", id_, now() + 1), query: {} }, left);
  t.is(left.body.code, 200);
  await tick();
  t.is(notified.length, 1);

  const rejected = reply();
  await handler(
    { body: await signMembership(member, "join", `${o.address}/nope`, now()), query: {} },
    rejected,
  );
  t.is(rejected.body.code, 400);
  t.regex(rejected.body.details, /Didn't find the community to join or leave/);
  await tick();
  t.is(notified.length, 1);
});

// --- Notifications ----------------------------------------------------------

function notificationDeps(overrides = {}) {
  const pushed = [];
  const casts = [];
  return {
    pushed,
    casts,
    deps: {
      getLists: async () => ({ addresses: [] }),
      resolve: async () => ({ displayName: "alice.eth", neynarScore: 0.9 }),
      fetchENSData: async () => ({}),
      getFids: async () => [],
      sendNeynar: async (...args) => casts.push(args),
      sendPush: async (receivers, notification) => pushed.push({ receivers, notification }),
      ...overrides,
    },
  };
}

test.serial("a join notifies the community's owner", async (t) => {
  resetJoinNotifications();
  const { trie, owner: o, id: id_ } = await setup(t, { name: "Agent Builders" });
  const member = Wallet.createRandom();
  const message = await signMembership(member, "join", id_, T + 1);
  await add(trie, message);
  const { pushed, deps } = notificationDeps();
  const { sent } = await triggerJoinNotification(message, {}, deps);
  t.deepEqual(sent, {
    receivers: [o.address],
    title: "New member",
    body: "alice.eth joined Agent Builders",
    url: `https://news.kiwistand.com/c/${id_}`,
  });
  t.deepEqual(pushed, [{ receivers: [o.address], notification: { title: "New member", body: "alice.eth joined Agent Builders", url: `https://news.kiwistand.com/c/${id_}` } }]);
});

test.serial("leaves, the owner's own join and banned profiles don't notify", async (t) => {
  resetJoinNotifications();
  const { trie, owner: o, id: id_ } = await setup(t);
  const member = Wallet.createRandom();
  const device = Wallet.createRandom();
  const { pushed, deps } = notificationDeps();

  const leave = await signMembership(member, "leave", id_, T + 1);
  t.is((await triggerJoinNotification(leave, {}, deps)).reason, "not a join");

  const own = await signMembership(o, "join", id_, T + 1);
  t.regex((await triggerJoinNotification(own, {}, deps)).reason, /owner joined/);
  // Also with the owner's delegated key.
  const ownDevice = await signMembership(device, "join", id_, T + 1);
  t.regex(
    (await triggerJoinNotification(ownDevice, { [device.address]: o.address }, deps)).reason,
    /owner joined/,
  );

  const join = await signMembership(member, "join", id_, T + 2);
  for (const banned of [member.address, o.address]) {
    const lists = { getLists: async () => ({ addresses: [banned.toLowerCase()] }) };
    t.regex((await triggerJoinNotification(join, {}, { ...deps, ...lists })).reason, /banned/);
  }
  // Like an upvote: no name or a low Neynar score, no notification.
  t.regex(
    (await triggerJoinNotification(join, {}, { ...deps, resolve: async () => ({}) })).reason,
    /no name/,
  );
  t.regex(
    (await triggerJoinNotification(join, {}, { ...deps, resolve: async () => ({ displayName: "x", neynarScore: 0.1 }) })).reason,
    /below/,
  );
  // An unknown community.
  const elsewhere = await signMembership(member, "join", `${Wallet.createRandom().address}/ai`, T + 2);
  t.is((await triggerJoinNotification(elsewhere, {}, deps)).reason, "unknown community");
  t.is(pushed.length, 0);
});

test.serial("joining again within a day doesn't notify the owner twice", async (t) => {
  let clock = Date.now();
  resetJoinNotifications(() => clock);
  t.teardown(() => resetJoinNotifications());
  const { id: id_ } = await setup(t);
  const member = Wallet.createRandom();
  const { pushed, deps } = notificationDeps();

  const first = await signMembership(member, "join", id_, T + 1);
  t.truthy((await triggerJoinNotification(first, {}, deps)).sent);
  // Leaves and joins again an hour later.
  clock += 60 * 60 * 1000;
  const again = await signMembership(member, "join", id_, T + 3);
  t.regex((await triggerJoinNotification(again, {}, deps)).reason, /within the window/);
  // Someone else still notifies.
  const other = await signMembership(Wallet.createRandom(), "join", id_, T + 3);
  t.truthy((await triggerJoinNotification(other, {}, deps)).sent);
  // A day later, it's news again.
  clock += JOIN_NOTIFICATION_WINDOW_MS;
  const later = await signMembership(member, "join", id_, T + 5);
  t.truthy((await triggerJoinNotification(later, {}, deps)).sent);
  t.is(pushed.length, 3);
});

// --- In-app notifications -----------------------------------------------------

const profiles = async (address) => ({
  address,
  displayName: `name-${address.slice(2, 6).toLowerCase()}`,
  safeAvatar: null,
});

test.serial("the owner's notifications have who joined their communities", async (t) => {
  const trie = await freshTrie(t);
  const o = Wallet.createRandom();
  await add(trie, await signCommunity(o, { name: "Agent Builders", icon: "robot", color: "#1F8A7A" }));
  await add(trie, await signCommunity(o, { name: "Kiwi" }));
  const builders = communities.communityId(o.address, "Agent Builders");
  const kiwi = communities.communityId(o.address, "Kiwi");
  const [alice, bob, carol] = [Wallet.createRandom(), Wallet.createRandom(), Wallet.createRandom()];
  const t0 = now() - 600;
  await add(trie, await signMembership(alice, "join", builders, t0));
  await add(trie, await signMembership(bob, "join", builders, t0 + 10));
  await add(trie, await signMembership(carol, "join", kiwi, t0 + 20));
  await add(trie, await signMembership(carol, "join", builders, t0 + 30));
  await add(trie, await signMembership(carol, "leave", builders, t0 + 40));
  // The owner's own join isn't news to them.
  await add(trie, await signMembership(o, "join", kiwi, t0 + 50));
  // Joins older than three weeks aren't shown, like comments.
  const old = Wallet.createRandom();
  await add(trie, await signMembership(old, "join", kiwi, now() - 22 * 24 * 60 * 60));

  const joins = cache.getJoins(o.address, {}, now() - 1814400);
  t.deepEqual(
    joins.map(({ identity, community }) => [identity, community.id]),
    [
      [carol.address, kiwi],
      [bob.address, builders],
      [alice.address, builders],
    ],
  );

  const data = await activity.data(trie, o.address, 0, false, {
    delegations: {},
    resolve: profiles,
  });
  t.deepEqual(
    data.joins.map(({ verb, message }) => [verb, message.identity, message.community.id]),
    [
      ["joined", carol.address, kiwi],
      ["joined", bob.address, builders],
      ["joined", alice.address, builders],
    ],
  );
  t.deepEqual(data.joins[1].message.community, {
    id: builders,
    name: "Agent Builders",
    icon: "robot",
    color: "#1F8A7A",
  });
  t.is(data.joins[1].identities[0].displayName, `name-${bob.address.slice(2, 6).toLowerCase()}`);
  // `notifications` stays as the apps know it.
  t.false(data.notifications.some(({ verb }) => verb === "joined"));
  t.is(data.lastUpdate, t0 + 20);

  // The page: one row per community, its newest member first.
  const rows = data.feed.filter(({ verb }) => verb === "joins");
  t.deepEqual(
    rows.map(({ message, actorCount }) => [message.community.id, actorCount]),
    [
      [kiwi, 1],
      [builders, 2],
    ],
  );
  t.deepEqual(
    rows[1].actors.map(({ address }) => address),
    [bob.address, alice.address],
  );
  const html = (await activity.page("light", o.address, data.feed, 0, false)).toString();
  t.regex(html, /joined your community/);
  t.regex(html, /Agent Builders/);
  t.true(html.includes(`href="/c/${builders}"`));
  t.regex(html, / and 1 other joined your community/);
});

test.serial("the beacon's quick read of notifications skips joins", async (t) => {
  const { trie, owner: o, id: id_ } = await setup(t);
  await add(trie, await signMembership(Wallet.createRandom(), "join", id_, now() - 60));
  const data = await activity.data(trie, o.address, 0, true, { delegations: {}, resolve: profiles });
  t.deepEqual(data.joins, []);
});

test("joins group per community, newest first, without the viewer", (t) => {
  const viewer = "0x0000000000000000000000000000000000000001";
  const a = { id: "0xa/one", name: "One" };
  const b = { id: "0xa/two", name: "Two" };
  const join = (identity, community, timestamp) => ({
    verb: "joined",
    timestamp,
    message: { identity, community, timestamp },
  });
  const groups = groupJoins(
    [
      join("0x1", a, 1),
      join("0x2", a, 3),
      join("0x3", b, 2),
      join(viewer, b, 4),
      join("0x2", a, 5),
    ],
    viewer,
  );
  t.deepEqual(
    groups.map(({ message, members, timestamp }) => [message.community.id, members, timestamp]),
    [
      ["0xa/one", ["0x2", "0x1"], 5],
      ["0xa/two", ["0x3"], 2],
    ],
  );
});
