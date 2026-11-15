// Builds the sequencer's next commit (src/commits.mjs), prints it and,
// unless --dry-run, sends it. Without a commit of the sequencer on the inbox,
// that's the genesis: every message up to now, and the delegations
// snapshot's hash. Run it on the sequencer, next to the node (it reads the
// node's trie):
//
//   node -r dotenv/config scripts/commit.mjs --dry-run
//   node -r dotenv/config scripts/commit.mjs
//
// After the genesis, the node sends a commit every hour with something new.
import { argv, exit } from "process";

import * as store from "../src/store.mjs";
import * as commits from "../src/commits.mjs";
import * as sequencer from "../src/sequencer.mjs";
import * as registry from "../src/chainstate/registry.mjs";
import { COMMITS } from "../src/constants.mjs";

const dry = argv.includes("--dry-run");
const rpc = commits.client();
const { commits: chain } = await commits.read(rpc, COMMITS.block);
const snapshot = registry.snapshot()?.hash;
if (!chain.some(({ sequencer }) => sequencer) && !snapshot) {
  console.error("The genesis needs src/chainstate/delegations.json");
  exit(1);
}

const trie = await store.create();
const commit = await sequencer.next(await commits.held(trie), chain, snapshot);
if (!commit) {
  console.log("Nothing new to commit");
  exit(0);
}
const { root, ids, blob } = commit;
console.log({
  genesis: Boolean(commit.genesis),
  root,
  ids,
  blob: blob ? `${blob.length} bytes` : null,
});
console.log(`calldata: ${(commits.encodeCommit(commit).length - 2) / 2} bytes`);
if (!dry) console.log(`sent: ${await sequencer.send(commit, rpc)}`);
exit(0);
