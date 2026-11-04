import { env } from "process";

import test from "ava";
import { Wallet } from "ethers";
import { Trie } from "@ethereumjs/trie";

import { sign, toDigest } from "../src/id.mjs";
import * as commits from "../src/commits.mjs";
import { EIP712_MESSAGE, PROTOCOL } from "../src/constants.mjs";

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

test("the order bumps the protocol versions", (t) => {
  t.is(PROTOCOL.pubsub.topics.roots.version, "15.0.0");
  t.is(PROTOCOL.pubsub.topics.messages.version, "15.0.0");
  t.is(PROTOCOL.protocols.leaves.version, "18.0.0");
  t.is(PROTOCOL.protocols.levels.version, "18.0.0");
});

test("a commit's calldata and blob", async (t) => {
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

  const commit = {
    k: 3,
    prev: hash("11"),
    root: hash("22"),
    n: 2,
    ids: entries.map(({ id }) => id),
  };
  const data = commits.encodeCommit(commit);
  // Selector, five words, the array's offset and length, one word per ID.
  t.is((data.length - 2) / 2, 4 + 32 * 7 + 32 * 2);
  t.deepEqual(commits.decodeCommit(data), { version: 1, ...commit });

  const blob = commits.pack(entries.map(({ canonical }) => canonical));
  t.deepEqual(
    commits.unpack(blob).map((canonical) => commits.entry(canonical).id),
    commit.ids,
  );
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
  const messages = await held([...old, ...listed]);
  const all = [...messages.values()];
  const genesisRoot = await commits.root(await Trie.create(), all.slice(0, 2));
  const ids = all.slice(2).map(({ id }) => id);
  const chain = () => [
    { k: 0, time: T, prev: hash("aa"), root: genesisRoot, n: 2, ids: [] },
    { k: 1, time: T + 60, prev: hash("bb"), root: "", n: 2, ids },
  ];
  const good = chain();
  good[1].root = await commits.root(await Trie.create(), all);

  // NOTE: The message from before the genesis that commit 1 lists isn't in
  // the genesis.
  let result = await commits.check(messages, good, hash("aa"));
  t.deepEqual(
    result.map(({ status }) => status),
    ["verified", "verified"],
  );

  result = await commits.check(messages, good, hash("ab"));
  t.deepEqual(
    result.map(({ status }) => status),
    ["mismatch", "unverified"],
  );

  const without = new Map(messages);
  without.delete(ids[0]);
  result = await commits.check(without, good, hash("aa"));
  t.is(result[1].status, "missing");
  t.true(result[1].reason.includes(ids[0]));

  const extra = await held([
    ...old,
    ...listed,
    await story("https://e.example", T - 1),
  ]);
  result = await commits.check(extra, good, hash("aa"));
  t.is(result[0].status, "mismatch");
  t.is(result[0].reason, "The root differs (3 messages here, 2 committed)");
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
    t.is(await sequencer.tick(trie, [{ time: hour + 5 }], null, now), null);
    await t.throwsAsync(sequencer.tick(trie, [{ time: hour - 5 }], null, now), {
      message: "read the trie",
    });
  } finally {
    if (key === undefined) delete env.SEQUENCER_PRIVATE_KEY;
    else env.SEQUENCER_PRIVATE_KEY = key;
  }
});
