import { env } from "process";
import { join } from "path";

import test from "ava";
import Database from "better-sqlite3";
import { Wallet } from "ethers";
import { Trie } from "@ethereumjs/trie";

import { sign, toDigest } from "../src/id.mjs";
import * as commits from "../src/commits.mjs";
import * as cache from "../src/cache.mjs";
import { EIP712_MESSAGE, PROTOCOL, COMMITS } from "../src/constants.mjs";

const T = 1800000000;
const story = (href, timestamp) =>
  sign(
    Wallet.createRandom(),
    { title: href, href, type: "amplify", timestamp },
    EIP712_MESSAGE,
  );
const hash = (byte) => `0x${byte.repeat(32)}`;

async function held(messages) {
  const entries = messages.map((message) =>
    commits.entry(toDigest(message).canonical),
  );
  return new Map(entries.map((entry) => [entry.id, entry]));
}

test("the commits bump the protocol versions", (t) => {
  t.is(PROTOCOL.pubsub.topics.roots.version, "15.0.0");
  t.is(PROTOCOL.pubsub.topics.messages.version, "15.0.0");
  t.is(PROTOCOL.protocols.leaves.version, "18.0.0");
  t.is(PROTOCOL.protocols.levels.version, "18.0.0");
});

test("a commit's calldata and blob, and an include()'s calldata", async (t) => {
  const messages = [
    await story("https://a.example", T),
    await story("https://b.example", T + 1),
  ];
  const entries = [...(await held(messages)).values()];
  t.deepEqual(
    entries.map(({ id, index }) => [id, index]),
    messages.map((message) => {
      const { digest, index } = toDigest(message);
      return [`0x${digest}`, index];
    }),
  );

  const commit = { root: hash("22"), ids: entries.map(({ id }) => id) };
  const data = commits.encodeCommit(commit);
  // Selector, version, root, the array's offset and length, one word per ID.
  t.is((data.length - 2) / 2, 4 + 32 * 4 + 32 * 2);
  t.deepEqual(commits.decodeCommit(data), { version: 1, ...commit });

  const blob = commits.pack(entries.map(({ canonical }) => canonical));
  t.deepEqual(
    commits.unpack(blob).map((canonical) => commits.entry(canonical).id),
    commit.ids,
  );

  // include() carries the messages themselves; their IDs are their hashes.
  const canonicals = entries.map(({ canonical }) => canonical);
  const included = commits.decodeCommit(commits.encodeInclude(canonicals));
  t.deepEqual(
    included.messages.map((message) => message.toString("hex")),
    canonicals.map((canonical) => Buffer.from(canonical).toString("hex")),
  );
  t.deepEqual(included.ids, commit.ids);
});

test("checking commits against the messages a node holds", async (t) => {
  const old = [
    await story("https://a.example", T - 10),
    await story("https://b.example", T - 5),
  ];
  const listed = [
    await story("https://c.example", T + 10),
    await story("https://d.example", T - 20),
  ];
  const forced = await story("https://f.example", T + 20);
  const messages = await held([...old, ...listed, forced]);
  const all = [...messages.values()];
  const genesisRoot = await commits.root(await Trie.create(), all.slice(0, 2));
  const ids = all.slice(2, 4).map(({ id }) => id);
  const chain = () => [
    { k: 0, sequencer: true, time: T, root: genesisRoot, ids: [hash("aa")] },
    {
      k: 1,
      sequencer: false,
      time: T + 30,
      root: hash("00"),
      ids: [all[4].id],
    },
    { k: 2, sequencer: true, time: T + 60, root: "", ids },
  ];
  const good = chain();
  good[2].root = await commits.root(await Trie.create(), all);

  // NOTE: The message from before the genesis that commit 2 lists isn't in
  // the genesis; the include()'s message is in every root after it.
  let result = await commits.check(messages, good, hash("aa"));
  t.deepEqual(
    result.map(({ status }) => status),
    ["verified", "included", "verified"],
  );

  result = await commits.check(messages, good, hash("ab"));
  t.deepEqual(
    result.map(({ status }) => status),
    ["mismatch", "included", "unverified"],
  );

  const without = new Map(messages);
  without.delete(ids[0]);
  result = await commits.check(without, good, hash("aa"));
  t.is(result[2].status, "missing");
  t.true(result[2].reason.includes(ids[0]));

  const extra = await held([
    ...old,
    ...listed,
    forced,
    await story("https://e.example", T - 1),
  ]);
  result = await commits.check(extra, good, hash("aa"));
  t.is(result[0].status, "mismatch");
  t.is(result[0].reason, "The root differs");

  // A sequencer that leaves the include()'s message out of its root.
  const censored = chain();
  censored[2].root = await commits.root(await Trie.create(), all.slice(0, 4));
  result = await commits.check(messages, censored, hash("aa"));
  t.is(result[2].status, "mismatch");

  // An include()'s message that no node took (e.g. an invalid one) is in no
  // root.
  const invalid = chain();
  invalid[1].ids.push(hash("ff"));
  invalid[2].root = good[2].root;
  result = await commits.check(messages, invalid, hash("aa"));
  t.is(result[2].status, "verified");
});

test.serial("whether a message was witnessed in time", (t) => {
  cache.initializeCommits();
  const { inbox } = COMMITS;
  const rpc = env.ETHEREUM_RPC_URL;
  COMMITS.inbox = `0x${"11".repeat(20)}`;
  env.ETHEREUM_RPC_URL = "http://127.0.0.1:8545";
  t.teardown(() => {
    COMMITS.inbox = inbox;
    if (rpc === undefined) delete env.ETHEREUM_RPC_URL;
    else env.ETHEREUM_RPC_URL = rpc;
    new Database(join(env.CACHE_DIR, "database.db")).exec(
      "DELETE FROM commits; DELETE FROM listings;",
    );
  });
  const H = commits.WINDOW;
  const index = (byte, timestamp) =>
    `${timestamp.toString(16)}${byte.repeat(32)}`;
  const messages = {
    early: index("0a", T - 100),
    listed: index("0b", T + 10),
    unlisted: index("0c", T + 20),
    byDeadline: index("0d", T + 30),
    afterDeadline: index("0e", T + 40),
    includedLast: index("0f", T + 50),
    includedLate: index("1a", T + 60),
    includedEarly: index("1b", T + 70),
    includedTooEarly: index("1c", T + 80),
  };
  const id = (name) => `0x${messages[name].slice(-64)}`;
  const commit = (k, time, sequencer, ids) => ({
    k,
    tx: hash(`0${k}`),
    block: k,
    time,
    sequencer,
    root: hash("00"),
    status: "verified",
    reason: null,
    ids,
  });
  // NOTE: The deadline of the messages dated T + 10 to T + 80 is commit 6,
  // the first sequencer commit after their timestamp + an hour.
  const chain = [
    commit(0, T, true, [hash("aa")]),
    commit(1, T + 10, false, [id("includedEarly")]),
    commit(2, T + 19, false, [id("includedTooEarly")]),
    commit(3, T + 600, true, [id("listed")]),
    commit(4, T + 50 + H, false, [id("includedLast")]),
    commit(5, T + 61 + H, false, [id("includedLate")]),
    commit(6, T + 100 + H, true, [id("byDeadline")]),
    commit(7, T + 200 + H, true, [id("afterDeadline")]),
  ];
  const late = (name) => commits.late(messages[name]);

  // Without a sequencer commit after its timestamp + an hour, a message is
  // pending.
  cache.saveCommits(chain.slice(0, 6));
  t.false(late("unlisted"));
  t.false(late("afterDeadline"));

  cache.saveCommits(chain);
  t.false(late("early"));
  t.false(late("listed"));
  t.true(late("unlisted"));
  t.false(late("byDeadline"));
  t.true(late("afterDeadline"));
  t.false(late("includedLast"));
  t.true(late("includedLate"));
  // An include() may be a little before the timestamp: the usual skew.
  t.false(late("includedEarly"));
  t.true(late("includedTooEarly"));
});

test("the sequencer commits at most once per UTC hour", async (t) => {
  const sequencer = await import("../src/sequencer.mjs");
  const key = env.SEQUENCER_PRIVATE_KEY;
  env.SEQUENCER_PRIVATE_KEY = `0x${"11".repeat(32)}`;
  // Reading the trie means it went on to build a commit.
  const trie = {
    createReadStream() {
      throw new Error("read the trie");
    },
  };
  const hour = 1800003600;
  const now = (hour + 20 * 60) * 1000;
  try {
    const committed = [{ sequencer: true, time: hour + 5 }];
    t.is(await sequencer.tick(trie, committed, null, now), null);
    // An include() this hour isn't the sequencer's commit.
    const included = [
      { sequencer: true, time: hour - 5 },
      { sequencer: false, time: hour + 5 },
    ];
    await t.throwsAsync(sequencer.tick(trie, included, null, now), {
      message: "read the trie",
    });
  } finally {
    if (key === undefined) delete env.SEQUENCER_PRIVATE_KEY;
    else env.SEQUENCER_PRIVATE_KEY = key;
  }
});
