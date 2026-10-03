// @format
// Regression tests for the set reconciliation between two tries
// (sync.initiate on one side, sync.compare + sync.put on the other), run
// in-process without libp2p: `innerSend` calls the peer's handlers directly.
import { env } from "process";
import { rm, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

import test from "ava";
import { Wallet } from "ethers";
import { LeafNode, BranchNode, ExtensionNode } from "@ethereumjs/trie";
import { encode } from "cbor-x";
import { keccak256 } from "ethereum-cryptography/keccak.js";

import * as sync from "../src/sync.mjs";
import * as store from "../src/store.mjs";
import * as id from "../src/id.mjs";
import { EIP712_MESSAGE, PROTOCOL } from "../src/constants.mjs";

const { levels, leaves } = PROTOCOL.protocols;
const emptyRoot =
  "56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421";

let dir;
test.before(async () => {
  dir = await mkdtemp(join(tmpdir(), "kiwi-reconcile-"));
});
test.after.always(async () => {
  await rm(dir, { recursive: true, force: true });
});

let trieCount = 0;
async function createTrie() {
  env.DATA_DIR = join(dir, `trie${trieCount++}`);
  return await store.create();
}

async function values(trie) {
  const out = new Set();
  if (trie.root().toString("hex") === emptyRoot) return out;
  async function walk(ref) {
    const node = await trie.lookupNode(ref);
    if (node instanceof LeafNode) {
      out.add(Buffer.from(node.value()).toString("hex"));
    } else if (node instanceof ExtensionNode) {
      await walk(node.value());
    } else if (node instanceof BranchNode) {
      for (const [, child] of node.getChildren()) await walk(child);
    }
  }
  await walk(trie.root());
  return out;
}

const peer = { equals: (other) => other === peer, toString: () => "peer" };

// NOTE: Like production keys ("<timestamp hex><keccak256 digest>"), our keys
// start with a timestamp, so that many keys share long prefixes and the trie
// contains extension nodes and leaves at varying depths. As in production
// (sync.put -> store.add), the receiver recomputes the key from the value and
// doesn't trust the key on the wire.
function keyOf(value) {
  return Buffer.concat([value.subarray(0, 4), Buffer.from(keccak256(value))]);
}
function randomValue(spread) {
  const ts = Buffer.alloc(4);
  ts.writeUInt32BE(1700000000 + Math.floor(Math.random() * spread));
  return Buffer.concat([ts, randomBytes(36)]);
}
async function putAll(trie, vals) {
  for (const value of vals) await trie.put(keyOf(value), value);
}

async function syncOnce(from, to, putFn) {
  const send = async (peerId, protocol, message) => {
    if (protocol === `/${levels.id}/${levels.version}`) {
      try {
        return await sync.compare(to, message);
      } catch (err) {
        // NOTE: handleLevels doesn't answer when compare throws (e.g. for the
        // final, empty list of levels).
        return;
      }
    } else if (protocol === `/${leaves.id}/${leaves.version}`) {
      return await putFn(to, message);
    }
  };
  await sync.initiate(
    from.copy(false),
    peer,
    [],
    0,
    send,
    sync.syncPeerFactory(),
  );
}

async function rawPut(trie, message) {
  for (const { node } of sync.deserialize(message)) {
    const value = Buffer.from(node.value());
    await trie.put(keyOf(value), value);
  }
}

const shapes = [
  { name: "one side empty", a: 0, b: 120, common: 0, spread: 1e6 },
  { name: "small overlap", a: 3, b: 4, common: 20, spread: 1e6 },
  { name: "large difference", a: 400, b: 300, common: 500, spread: 1e7 },
  { name: "identical", a: 0, b: 0, common: 200, spread: 1e6 },
  { name: "shared prefixes", a: 150, b: 150, common: 150, spread: 3 },
];
for (const shape of shapes) {
  test.serial(
    `tries converge in one round each way: ${shape.name}`,
    async (t) => {
      const A = await createTrie();
      const B = await createTrie();
      const common = Array.from({ length: shape.common }, () =>
        randomValue(shape.spread),
      );
      const onlyA = Array.from({ length: shape.a }, () =>
        randomValue(shape.spread),
      );
      const onlyB = Array.from({ length: shape.b }, () =>
        randomValue(shape.spread),
      );
      await putAll(A, [...common, ...onlyA]);
      await putAll(B, [...common, ...onlyB]);
      const expected = [
        ...new Set([...(await values(A)), ...(await values(B))]),
      ].sort();

      await syncOnce(A, B, rawPut);
      await syncOnce(B, A, rawPut);

      t.is(A.root().toString("hex"), B.root().toString("hex"));
      t.deepEqual([...(await values(A))].sort(), expected);
      t.deepEqual([...(await values(B))].sort(), expected);
    },
  );
}

// NOTE: A node rejects a comment whose parent it doesn't have yet. Leaves used
// to be sent level by level in trie order, so a comment located at a shallower
// trie level than its (also missing) parent was dropped and only arrived in a
// later sync round (one round per level of comment nesting).
test.serial("nested comment threads sync in a single round", async (t) => {
  const signer = Wallet.createRandom();
  const messages = [];
  const parents = [];
  for (let i = 0; i < 40; i++) {
    const timestamp = 1700000000 + Math.floor(Math.random() * 6e7);
    const message = await id.sign(
      signer,
      id.create(`story ${i}`, `https://example.com/${i}`, "amplify", timestamp),
      EIP712_MESSAGE,
    );
    parents.push({ index: id.toDigest(message).index, timestamp });
    messages.push(message);
  }
  for (let i = 0; i < 160; i++) {
    const parent = parents[Math.floor(Math.random() * parents.length)];
    const timestamp = parent.timestamp + 1 + Math.floor(Math.random() * 5e5);
    const message = await id.sign(
      signer,
      id.create(`comment ${i}`, `kiwi:0x${parent.index}`, "comment", timestamp),
      EIP712_MESSAGE,
    );
    parents.push({ index: id.toDigest(message).index, timestamp });
    messages.push(message);
  }

  const A = await createTrie();
  const B = await createTrie();
  const delegations = {};
  const libp2p = null;
  const synching = true;
  for (const message of messages) {
    await store.add(A, message, libp2p, delegations, synching);
  }
  // NOTE: store.add records upvote markers in a module-global set to reject
  // duplicates; as both tries live in this process, we reset it.
  store.upvotes.clear();
  t.is((await values(A)).size, messages.length);

  await syncOnce(A, B, (trie, message) => sync.put(trie, message, delegations));

  t.is((await values(B)).size, messages.length);
  t.is(A.root().toString("hex"), B.root().toString("hex"));
});

test.serial("put keeps adding leaves after an undecodable one", async (t) => {
  const signer = Wallet.createRandom();
  const good = [];
  for (let i = 0; i < 3; i++) {
    good.push(
      await id.sign(
        signer,
        id.create(
          `put ${i}`,
          `https://example.com/put/${i}`,
          "amplify",
          1700000000 + i,
        ),
        EIP712_MESSAGE,
      ),
    );
  }
  // NOTE: We create the leaf nodes the way the sending side does, by reading
  // them from a trie, and then corrupt the first one's value.
  const source = await createTrie();
  for (const message of good) {
    const { index, canonical } = id.toDigest(message);
    await source.put(Buffer.from(index, "hex"), canonical);
  }
  let nodes = [];
  for (let level = 0; level < 10; level++) {
    const found = await store.descend(source, level);
    nodes.push(...found.filter(({ node }) => node instanceof LeafNode));
  }
  t.is(nodes.length, good.length);
  nodes[0].node = new LeafNode(nodes[0].node.key(), Buffer.from("ff", "hex"));
  const target = await createTrie();
  await sync.put(target, sync.serialize(nodes), {});
  t.is((await values(target)).size, good.length - 1);
});
