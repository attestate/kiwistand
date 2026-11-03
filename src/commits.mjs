// @format
// The order of all messages, committed to Ethereum mainnet (protocol 15.0.0).
//
// Sync stays set reconciliation; Ethereum orders and verifies. Once an hour,
// the sequencer (src/sequencer.mjs) sends commit k to the inbox contract
// (contracts/Inbox.sol). Its calldata, kept forever:
//
//   commit(uint8 version, uint256 k, bytes32 prev, bytes32 root, uint256 n,
//          bytes32[] ids)
//
// `prev` is the hash of commit k-1's calldata, `root` the trie root over every
// message committed through k (the root a node's trie has with exactly these
// messages), and `ids` the IDs (keccak256 of the signed message as the trie
// stores it) of the n messages the sequencer took since commit k-1, in that
// order. The transaction's blob (kept about 18 days) has those n messages:
// `pack` below. Commit 0, the genesis, lists no IDs: it is every message with
// a timestamp up to its block that no later commit lists, `n` of them, and
// its `prev` is the hash of the delegations snapshot.
//
// A message's place in the order is [k, position]; genesis messages are
// [0, timestamp]. A message no commit lists yet is pending: it comes after
// all committed ones, by timestamp, and rules that depend on the order are
// provisional for it.
import { brotliCompressSync, brotliDecompressSync } from "zlib";

import { Trie } from "@ethereumjs/trie";
import { encode, decode as decodeCbor } from "cbor-x";
import { keccak256 as keccak } from "ethereum-cryptography/keccak.js";
import { toHex } from "ethereum-cryptography/utils.js";
import {
  createPublicClient,
  http,
  parseAbi,
  encodeFunctionData,
  decodeFunctionData,
  keccak256,
} from "viem";

import log from "./logger.mjs";
import { COMMITS } from "./constants.mjs";
import * as cache from "./cache.mjs";

export const VERSION = 1;

export const abi = parseAbi([
  "function commit(uint8 version, uint256 k, bytes32 prev, bytes32 root, uint256 n, bytes32[] ids)",
  "event Commit(uint256 k, bytes32 root, uint256 n)",
]);

export function encodeCommit({ k, prev, root, n, ids }) {
  const args = [VERSION, BigInt(k), prev, root, BigInt(n), ids];
  return encodeFunctionData({ abi, functionName: "commit", args });
}

export function decodeCommit(input) {
  const { args } = decodeFunctionData({ abi, data: input });
  const [version, k, prev, root, n, ids] = args;
  return { version, k: Number(k), prev, root, n: Number(n), ids: [...ids] };
}

// The blob's content: the batch's messages as the trie stores them, in
// order, in one CBOR list, compressed with Brotli.
export function pack(canonicals) {
  return brotliCompressSync(encode(canonicals));
}

export function unpack(bytes) {
  return decodeCbor(brotliDecompressSync(bytes)).map((m) => Buffer.from(m));
}

// A message as the trie stores it: its ID, its index (the trie key) and its
// timestamp.
export function entry(canonical) {
  const digest = toHex(keccak(canonical));
  const { timestamp } = JSON.parse(decodeCbor(canonical));
  const index = `${timestamp.toString(16)}${digest}`;
  return { id: `0x${digest}`, index, timestamp, canonical };
}

// Every message of a trie, by ID.
export async function held(trie) {
  const messages = new Map();
  for await (const { value } of trie.createReadStream()) {
    const message = entry(value);
    messages.set(message.id, message);
  }
  return messages;
}

// The genesis' messages: a timestamp up to its block's, listed by no commit.
export function genesis(messages, commits) {
  const listed = new Set(commits.flatMap(({ ids }) => ids));
  return [...messages.values()].filter(
    ({ id, timestamp }) => timestamp <= commits[0].time && !listed.has(id),
  );
}

export async function root(trie, entries) {
  for (const { index, canonical } of entries) {
    await trie.put(Buffer.from(index, "hex"), canonical);
  }
  return `0x${trie.root().toString("hex")}`;
}

export function client(url = process.env.ETHEREUM_RPC_URL) {
  return createPublicClient({ transport: http(url), pollingInterval: 1_000 });
}

// The inbox's commits from block `from` on, as long as they chain: commit k
// follows k-1 and names its hash. `last` is the newest commit read before.
export async function read(rpc, from, last, inbox = COMMITS.inbox) {
  const latest = Number(await rpc.getBlockNumber());
  const logs = [];
  // NOTE: RPCs limit eth_getLogs' block range differently, so the range
  // shrinks when one refuses it.
  let span = 10_000;
  for (let start = from; start <= latest; ) {
    const end = Math.min(start + span - 1, latest);
    try {
      logs.push(
        ...(await rpc.getLogs({
          address: inbox,
          event: abi[1],
          fromBlock: BigInt(start),
          toBlock: BigInt(end),
        })),
      );
      start = end + 1;
    } catch (err) {
      if (span <= 10) throw err;
      span = Math.floor(span / 10);
    }
  }

  const commits = [];
  for (const { transactionHash, blockNumber } of logs) {
    const tx = await rpc.getTransaction({ hash: transactionHash });
    const commit = decodeCommit(tx.input);
    const previous = commits.at(-1) ?? last;
    const k = previous ? previous.k + 1 : 0;
    if (commit.k !== k || (previous && commit.prev !== previous.hash)) {
      log(`commits: Skipping ${transactionHash}, it doesn't follow ${k - 1}`);
      continue;
    }
    const block = await rpc.getBlock({ blockNumber });
    commits.push({
      ...commit,
      tx: transactionHash,
      block: Number(blockNumber),
      time: Number(block.timestamp),
      hash: keccak256(tx.input),
    });
  }
  return { commits, latest };
}

// Checks `commits` against the messages a node holds: it must hold every
// listed ID, and each root must be the trie root over all messages committed
// through it. Sets each commit's `status`: "verified", "missing" (a listed
// message isn't here yet, peers may still send it), "mismatch" (the messages
// here differ from the committed ones) or, after the first that isn't
// verified, "unverified". `snapshot` is the delegations snapshot's hash.
export async function check(messages, commits, snapshot) {
  if (!commits.length) return commits;
  const trie = await Trie.create();
  const genesisSet = genesis(messages, commits);
  let failed = false;
  for (const commit of commits) {
    commit.reason = null;
    if (failed) {
      commit.status = "unverified";
      continue;
    }
    if (commit.k === 0 && snapshot && commit.prev !== snapshot) {
      commit.status = "mismatch";
      commit.reason = "The delegations snapshot's hash differs";
      failed = true;
      continue;
    }
    const missing = commit.ids.filter((id) => !messages.has(id));
    if (missing.length) {
      commit.status = "missing";
      commit.reason = `${missing.length} of ${commit.n} messages missing: ${missing
        .slice(0, 3)
        .join(", ")}`;
      failed = true;
      continue;
    }
    const entries =
      commit.k === 0 ? genesisSet : commit.ids.map((id) => messages.get(id));
    if ((await root(trie, entries)) !== commit.root) {
      commit.status = "mismatch";
      commit.reason =
        commit.k === 0
          ? `The root differs (${entries.length} messages here, ${commit.n} committed)`
          : "The root differs";
      failed = true;
      continue;
    }
    commit.status = "verified";
  }
  return commits;
}

// Where `index` (a trie key: timestamp and ID) is in the order.
let genesisTime;
export function position(index) {
  const id = index.slice(-64);
  const timestamp = parseInt(index.slice(0, -64), 16);
  const committed = cache.getPosition(id);
  if (committed) return [committed.k, committed.i, id];
  genesisTime ??= cache.getCommits()[0]?.time;
  if (genesisTime !== undefined && timestamp <= genesisTime) {
    return [0, timestamp, id];
  }
  return [Infinity, timestamp, id];
}

// What GET /api/v1/commits answers: how far this node verified the order.
export function status() {
  const commits = cache.getCommits();
  const verified = commits.filter(({ status }) => status === "verified");
  const failed = commits.find(({ status }) => status !== "verified");
  return {
    sequencer: COMMITS.sequencer,
    inbox: COMMITS.inbox,
    commits: commits.length,
    verified: verified.length ? [0, verified.at(-1).k] : null,
    failed: failed
      ? { k: failed.k, status: failed.status, reason: failed.reason }
      : null,
    latest: commits.at(-1)
      ? {
          k: commits.at(-1).k,
          tx: commits.at(-1).tx,
          time: commits.at(-1).time,
        }
      : null,
  };
}

// The node's state: the commits it read, how far it read the chain, the
// trie root it last checked, the first commit that failed the check, and the
// delegations snapshot's hash. `distrusted` are peers whose messages made a
// root differ.
const state = { commits: [], block: null, root: null, failed: null };
export const distrusted = new Set();

export function enabled() {
  return Boolean(process.env.ETHEREUM_RPC_URL && COMMITS.inbox);
}

export function commits() {
  return state.commits;
}

export function failed() {
  return state.failed;
}

// Reads new commits and, if there are any, checks them all again; with
// `recheck` (after a sync), also if the trie changed. Returns the new
// commits. Runs one at a time.
let queue = Promise.resolve();
export function refresh(trie, rpc = client(), snapshot, recheck = false) {
  if (snapshot !== undefined) state.snapshot = snapshot;
  queue = queue.catch(() => {}).then(() => update(trie, rpc, recheck));
  return queue;
}

async function update(trie, rpc, recheck) {
  const from = state.block === null ? COMMITS.block : state.block + 1;
  const { commits, latest } = await read(rpc, from, state.commits.at(-1));
  state.commits.push(...commits);
  state.block = latest;
  const root = trie.root().toString("hex");
  const changed = state.root === null || (recheck && root !== state.root);
  if (!commits.length && !changed) return commits;
  state.root = root;

  await check(await held(trie), state.commits, state.snapshot);
  cache.saveCommits(state.commits);
  genesisTime = state.commits[0]?.time;
  state.failed =
    state.commits.find(({ status }) => status !== "verified") ?? null;
  if (state.failed) {
    const { k, status, reason } = state.failed;
    log(`commits: Commit ${k} is ${status}: ${reason}`);
  }
  return commits;
}

// After a sync: checks the commits again, a little later so that the rest
// of the sync's messages are in. A root that differs after messages from
// `peer` came in makes the node distrust that peer.
let timer;
export function synced(trie, peer) {
  if (!enabled()) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const before = state.failed;
    try {
      await refresh(trie, client(), undefined, true);
    } catch (err) {
      log(`commits: Check after sync failed: ${err.message}`);
      return;
    }
    if (!before && state.failed?.status === "mismatch") {
      distrusted.add(peer.toString());
      log(`commits: Distrusting ${peer}, commit ${state.failed.k} differs`);
    }
  }, 30_000);
  timer.unref();
}

// Reads and checks the commits every ten minutes; `after` gets the new ones
// (for the delegations, whose order may have changed, and the sequencer).
export async function run(trie, snapshot, after) {
  const rpc = client();
  for (;;) {
    try {
      await after(await refresh(trie, rpc, snapshot));
    } catch (err) {
      log(`commits: ${err.stack}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10 * 60 * 1000));
  }
}
