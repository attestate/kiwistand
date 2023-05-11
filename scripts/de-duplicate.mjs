// @format
import { env } from "process";
import { rename } from "fs/promises";

import log from "../logger.mjs";
import * as store from "../store.mjs";
import * as id from "../id.mjs";
import * as registry from "../chainstate/registry.mjs";

TODOs:

- Make "passes" more modular and allow passing outside parameters
- Make sure that deduplicate can be ran everytime without destroying data. This
seems to be connected to the "constraints" part where the trie DATA_DIR is
disconnected from the DATA_DIR of constraints. Ideally all db instances are 
passed in from outside, I guess.

export async function deduplicate(trie, leaves) {
  const allowlist = await registry.allowlist();
  for await (let leaf of leaves) {
    const message = JSON.parse(leaf);
    const libp2p = null;
    try {
      await store.add(trie, message, libp2p, allowlist);
    } catch (err) {
      log(`Found duplicate and removing it: ${JSON.stringify(message)}`);
    }
    //const newWay = id.toDigest(leaf);
    //await trie.put(Buffer.from(newWay.index, "hex"), newWay.canonical);
  }
}

export async function run(trie) {
  const leaves = await store.leaves(trie);
  const encoding = "ordered-binary";
  const nextTrie = await store.create(`${env.DATA_DIR}-copy`, encoding);
  await deduplicate(nextTrie, leaves);
  await rename(env.DATA_DIR, `${env.DATA_DIR}-old`);
  await rename(`${env.DATA_DIR}-copy`, env.DATA_DIR);
  log("Migration 1 complete");
}

await run(
