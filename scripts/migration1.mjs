// @format
import { env } from "process";
import { renameSync } from "fs";

import LMDB from "../src/lmdb.mjs";
import log from "../src/logger.mjs";
import * as store from "../src/store.mjs";
import * as id from "../src/id.mjs";
import * as registry from "../src/chainstate/registry.mjs";

export async function deduplicate(nextTrie, nextMetaDB, prevTrie) {
  const allowlist = await registry.allowlist();

  const leaves = await store.leaves(prevTrie);
  for await (let leaf of leaves) {
    const message = JSON.parse(leaf);
    try {
      const libp2p = null;
      const syncing = false;
      await store.add(
        nextTrie,
        message,
        libp2p,
        allowlist,
        syncing,
        nextMetaDB
      );
    } catch (err) {
      log(`Found duplicate and removing it: ${JSON.stringify(message)}`);
    }
  }
}

// NOTE: Please only run this migration when you know what you're doing NOTE:
// In our first migration in ./src/migrations/0.mjs we fixed an issue where our
// hashing wasn't canonical as we hadn't sorted JSON property keys. This lead
// to in-deterministic results in the synchronization. But there were a few
// more issues that we ended up discovering:
//
// - Both the LMDB for storing metadata and the LMDB for ethereumjs/trie were
// not using ordered binary key-encoding, which didn't make the databases range
// searchable (useful for e.g. doing efficient queries on all leaves from say
// "a week ago").
// - ethereumjs/trie actually doesn't delete leaves when "trie.del" is called,
// it just marks them deleted (which doubled our database size in the last
// migration).
// - Most importantly however, the non-canonical hashing of messages may have
// lead to duplicates being able to sneak into the database and trie. This
// could have happened in cases where the we didn't have the unique link
// constraint yet and messages were replicating between two nodes.
//   - In such cases, a replicating node may have accidentially "duplicated" a
//   message by generating a new hash from an existing message with differently
//   sorted property keys.
//   - And since the set reconciliation is generally "greedy" in that it seeks
//   to "reconcile" the set, this must have lead to a lot of "shadow" messages
//   replicating.
// - With the algorithm here in "migration1", we're fixing this by re-adding
// all messages found in the "flawed" old database and by counting on the
// validation logic to work this time and hence filter out duplicates.
// - If you need help applying this script, please consult us on Telegram,
// we're happy to help.
export async function run() {
  log(`Running deduplicate on DATA_DIR: ${env.DATA_DIR}`);
  const oldLMDB = new LMDB({
    path: env.DATA_DIR,
    keyEncoding: "ordered-binary",
    encoding: "cbor",
  });
  const oldTrie = await store.create({ useNodePruning: false });

  const nextPath = `${env.DATA_DIR}-copy`;
  const nextLMDB = new LMDB({ path: nextPath });
  const nextTrie = await store.create({ db: nextLMDB });
  const nextMetaDB = store.metadata({
    path: nextPath,
  });

  await deduplicate(nextTrie, nextMetaDB, oldTrie);
}

await run();
