// @format
import { strict as assert } from "assert";

import { keccak256 } from "ethereum-cryptography/keccak.js";
import { toHex } from "ethereum-cryptography/utils.js";
import { encode } from "cbor-x";

import log from "../logger.mjs";
import * as store from "../store.mjs";
import * as id from "../id.mjs";

// NOTE: We used to implement the canonicalization of the message for storing
// them in the PMT as "oldToDigest" shows. However, "encode" from cbor-x
// didn't, to our surprise take care of sorting the JSON property names and so
// for two differently sorted JSONs this ended up generating a different hash.
//
// Hence, to (1) fix the issue, (2) since we have already live data on Kiwi
// Stand, and since there are potentially more of such situations, I thought it
// was a good moment to test what it takes to write a reasonable migration on
// life data and the amount of quality assurance and to find the structure it
// takes.
//
// The tactic of this migration is to tell the necessity of a migration from
// the pre-existing data structure and it then only applies it in case it finds
// evidence for the old data structure being present.

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
export async function isMigrated(trie, message) {
  const newOutcome = id.toDigest(message);
  const newValue = await trie.get(Buffer.from(newOutcome.index, "hex"));

  const oldOutcome = oldToDigest(message);
  const oldValue = await trie.get(Buffer.from(oldOutcome.index, "hex"));
  assert.notEqual(newOutcome.index, oldOutcome.index);
  if (oldValue && newValue) {
    throw new Error(
      "Both old and new key of message in database exists. Aborting."
    );
  } else if (!oldValue && newValue) {
    return true;
  } else if (oldValue && !newValue) {
    // NOTE: Now migration is potentially necessary
    return false;
  } else {
    throw new Error(
      "Both old and new value don't exist so someting is wrong. Aborting."
    );
  }
}

export async function migrate(trie, leaves) {
  trie.checkpoint();
  for await (let leaf of leaves) {
    const oldWay = oldToDigest(leaf);
    await trie.del(Buffer.from(oldWay.index, "hex"));

    const newWay = id.toDigest(leaf);
    await trie.put(Buffer.from(newWay.index, "hex"), newWay.canonical);
  }
  return await trie.commit();
}

export async function run(trie) {
  const leaves = await store.leaves(trie);
  if (leaves.length === 0) {
    log("Database has no leaves, migration not necessary");
    return;
  }
  const necessity0 = await necessary(trie, leaves);
  if (!necessity0) {
    log("No necessity for migration was found, aborting");
    return;
  }
  await migrate(trie, leaves);
  log("Migration done, checking migration for consistency");

  const necessity1 = await necessary(trie, leaves);
  if (necessity1) {
    throw new Error(
      "Still detecting necessity to migrate, must have resulted in an unexpected error"
    );
  }
  log("Migration successful, running node regularly now.");
}

export async function necessary(trie, leaves) {
  let count0 = 0;
  // TODO: Rename the results here to better values
  const clue0 = leaves.every((leaf) => {
    count0++;
    return typeof leaf === "string" && typeof leaf !== "object" && !leaf.title;
  });
  if (clue0) {
    if (count0 === leaves.length) {
      log(
        "clue0: All leaves were found to be strings, which looks like a migration happened. Casting them to objects to continue examination."
      );
      leaves = leaves.map(JSON.parse);
    } else {
      throw new Error(
        "clue0: Partial leaves were found to be migrated. Corrupted db. Aborting"
      );
    }
  }

  const tasks = leaves.map((leaf) => isMigrated(trie, leaf));
  const results = await Promise.all(tasks);
  const analysis0 = results.every((result) => {
    return result === true;
  });
  if (analysis0) {
    log("Migration is unnecessary.");
    return false;
  }

  let count2 = 0;
  const analysis1 = results.every((result) => {
    count2++;
    return result === false;
  });
  if (analysis1) {
    log("All leaves were found to be non-migrated. Migration necessary");
    return true;
  }
  throw new Error(
    "clue1: Partial leaves were found to be migrated. Corrupted db. Aborting"
  );
}
