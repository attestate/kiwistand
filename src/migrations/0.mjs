// @format
import { keccak256 } from "ethereum-cryptography/keccak.js";
import { toHex } from "ethereum-cryptography/utils.js";
import { encode } from "cbor-x";

import * as store from "../store.mjs";
import * as id from "../id.mjs";

export function oldToDigest(value) {
  // canonicalize({ ...value }) is missing here on purpose to simulate the old
  // hashing.
  const copy = { ...value };
  const canonical = encode(copy);
  const digest = toHex(keccak256(canonical));
  const index = `${value.timestamp.toString(16)}${digest}`;
  return {
    digest,
    canonical,
    index,
  };
}

// NOTE: As can be seen in `oldToDigest`, we didn't canonicalize the JSON which
// lead to other indexes in the total ordering. So for an existing node that
// has still the old values, we check whether they're in the database for the
// old key, and whether a new key exists. And in that case we signal that a
// migration is necessary.
export async function examine(trie, message) {
  const newOutcome = id.toDigest(message);
  const newValue = await trie.get(Buffer.from(newOutcome.index, "hex"));

  const oldOutcome = oldToDigest(message);
  const oldValue = await trie.get(Buffer.from(oldOutcome.index, "hex"));
  return oldValue && !newValue;
}

export async function examineAll(trie) {
  const leaves = await store.leaves(trie);
  const tasks = leaves.map((leaf) => examine(trie, leaf));
  const results = await Promise.all(tasks);
  return results.every((result) => result === true);
}

export async function rehash(trie) {
  //const leaves = await store.leaves(trie);
  //const judgement = await consider(trie, leaves[0]);
  //trie.checkpoint();
}
