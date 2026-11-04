// @format
// Ethereum mainnet witnesses the protocol's messages (protocol 15.0.0).
//
// Sync stays set reconciliation, and the protocol's rules go by timestamps.
// Once an hour, the sequencer (src/sequencer.mjs) commits what it witnessed
// to the inbox contract (contracts/Inbox.sol). Its calldata, kept forever:
//
//   commit(uint8 version, bytes32 root, bytes32[] ids)
//
// `ids` are the IDs (keccak256 of the signed message as the trie stores it)
// of the messages the sequencer took since its last commit, in that order,
// and `root` is the trie root over every valid message listed so far, by all
// commits and include()s up to this one, plus the genesis set. The
// transaction's blob (kept about 18 days) has those messages: `pack` below.
// Anyone can put messages on Ethereum with include(bytes[] messages), their
// encodings in calldata. Both emit
// Commit(address sender, bool sequencer, bytes32 root, uint256 n), and the
// commits' order is the order of those events on Ethereum.
//
// The genesis is the sequencer's first commit: its root covers every message
// up to its block, and its one ID is the delegations snapshot's hash.
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
  bytesToHex,
} from "viem";

import log from "./logger.mjs";
import { COMMITS } from "./constants.mjs";
import * as cache from "./cache.mjs";

export const VERSION = 1;

export const abi = parseAbi([
  "function commit(uint8 version, bytes32 root, bytes32[] ids)",
  "function include(bytes[] messages)",
  "event Commit(address sender, bool sequencer, bytes32 root, uint256 n)",
]);

export function encodeCommit({ root, ids }) {
  const args = [VERSION, root, ids];
  return encodeFunctionData({ abi, functionName: "commit", args });
}

export function encodeInclude(canonicals) {
  const args = [canonicals.map((canonical) => bytesToHex(canonical))];
  return encodeFunctionData({ abi, functionName: "include", args });
}

// A commit's calldata: a sequencer commit's root and IDs, or an include()'s
// messages and their IDs.
export function decodeCommit(input) {
  const { functionName, args } = decodeFunctionData({ abi, data: input });
  if (functionName === "include") {
    const messages = args[0].map((message) =>
      Buffer.from(message.slice(2), "hex"),
    );
    const ids = messages.map((message) => `0x${toHex(keccak(message))}`);
    return { messages, ids };
  }
  const [version, root, ids] = args;
  return { version, root, ids: [...ids] };
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

// The genesis set: the messages dated up to the genesis' block that no later
// sequencer commit lists.
export function genesis(messages, commits) {
  const [first, ...rest] = commits.filter(({ sequencer }) => sequencer);
  const listed = new Set(rest.flatMap(({ ids }) => ids));
  return [...messages.values()].filter(
    ({ id, timestamp }) => timestamp <= first.time && !listed.has(id),
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

// The inbox's commits from block `from` on, in the order of their Commit
// events, numbered from `k` on. Only transactions to the inbox count: their
// calldata is the record.
export async function read(rpc, from, k = 0, inbox = COMMITS.inbox) {
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
          event: abi[2],
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
  for (const { transactionHash, blockNumber, args } of logs) {
    const tx = await rpc.getTransaction({ hash: transactionHash });
    let commit;
    try {
      if (tx.to?.toLowerCase() !== inbox.toLowerCase()) {
        throw new Error("it isn't a transaction to the inbox");
      }
      commit = decodeCommit(tx.input);
    } catch (err) {
      log(`commits: Skipping ${transactionHash}, ${err.message}`);
      continue;
    }
    const block = await rpc.getBlock({ blockNumber });
    commits.push({
      root: args.root,
      ...commit,
      k: k + commits.length,
      sequencer: args.sequencer,
      tx: transactionHash,
      block: Number(blockNumber),
      time: Number(block.timestamp),
    });
  }
  return { commits, latest };
}

// Checks `commits` against the messages a node holds. The messages of an
// include() that the node holds count from it on. A sequencer commit's IDs
// must all be here, and its root must be the trie root over the genesis set
// and every message listed so far that's here. Sets each commit's `status`:
// "included" for an include(), and for a sequencer commit "verified",
// "missing" (a listed message isn't here yet, peers may still send it),
// "mismatch" (the messages here differ from the committed ones) or, after
// the first that isn't verified, "unverified". `snapshot` is the delegations
// snapshot's hash.
export async function check(messages, commits, snapshot) {
  const first = commits.find(({ sequencer }) => sequencer);
  const genesisSet = first ? genesis(messages, commits) : [];
  const here = (ids) =>
    ids.filter((id) => messages.has(id)).map((id) => messages.get(id));
  const trie = await Trie.create();
  let failed = false;
  for (const commit of commits) {
    commit.reason = null;
    if (!commit.sequencer) {
      commit.status = "included";
      await root(trie, here(commit.ids));
      continue;
    }
    if (failed) {
      commit.status = "unverified";
      continue;
    }
    if (
      commit === first &&
      snapshot &&
      (commit.ids.length !== 1 || commit.ids[0] !== snapshot)
    ) {
      commit.status = "mismatch";
      commit.reason = "The delegations snapshot's hash differs";
      failed = true;
      continue;
    }
    const missing =
      commit === first ? [] : commit.ids.filter((id) => !messages.has(id));
    if (missing.length) {
      commit.status = "missing";
      commit.reason = `${missing.length} of ${commit.ids.length} messages missing: ${missing
        .slice(0, 3)
        .join(", ")}`;
      failed = true;
      continue;
    }
    const entries = commit === first ? genesisSet : here(commit.ids);
    if ((await root(trie, entries)) !== commit.root) {
      commit.status = "mismatch";
      commit.reason = "The root differs";
      failed = true;
      continue;
    }
    commit.status = "verified";
  }
  return commits;
}

// What GET /api/v1/commits answers: how far this node verified the commits.
export function status() {
  const commits = cache.getCommits();
  const sequenced = commits.filter(({ sequencer }) => sequencer);
  const verified = sequenced.filter(({ status }) => status === "verified");
  const failed = sequenced.find(({ status }) => status !== "verified");
  const latest = commits.at(-1);
  return {
    inbox: COMMITS.inbox,
    commits: commits.length,
    verified: verified.length ? [0, verified.at(-1).k] : null,
    failed: failed
      ? {
          k: failed.k,
          tx: failed.tx,
          status: failed.status,
          reason: failed.reason,
        }
      : null,
    latest: latest
      ? {
          k: latest.k,
          tx: latest.tx,
          time: latest.time,
          sequencer: Boolean(latest.sequencer),
        }
      : null,
  };
}

// The node's state: the commits it read, how far it read the chain, the
// trie root it last checked, the delegations snapshot's hash and the libp2p
// node that gossips the messages of include()s.
const state = { commits: [], block: null, root: null };

export function enabled() {
  return Boolean(process.env.ETHEREUM_RPC_URL && COMMITS.inbox);
}

export function commits() {
  return state.commits;
}

// Reads new commits, takes the messages of new include()s and, if there are
// new commits, checks them all again; with `recheck` (after a sync), also if
// the trie changed. Returns the new commits. Runs one at a time.
let queue = Promise.resolve();
export function refresh(trie, rpc = client(), snapshot, recheck = false) {
  if (snapshot !== undefined) state.snapshot = snapshot;
  queue = queue.catch(() => {}).then(() => update(trie, rpc, recheck));
  return queue;
}

async function update(trie, rpc, recheck) {
  const from = state.block === null ? COMMITS.block : state.block + 1;
  const { commits, latest } = await read(rpc, from, state.commits.length);
  state.commits.push(...commits);
  state.block = latest;
  for (const commit of commits) {
    if (!commit.sequencer) await take(trie, commit.messages);
  }
  const root = trie.root().toString("hex");
  const changed = state.root === null || (recheck && root !== state.root);
  if (!commits.length && !changed) return commits;
  state.root = root;

  await check(await held(trie), state.commits, state.snapshot);
  cache.saveCommits(state.commits);
  const failed = state.commits.find(
    ({ sequencer, status }) => sequencer && status !== "verified",
  );
  if (failed) {
    const { k, status, reason } = failed;
    log(`commits: Commit ${k} is ${status}: ${reason}`);
  }
  return commits;
}

// Takes the messages of an include() through the normal path, with the same
// checks as messages from a peer, and gossips them. Invalid ones and those
// the node holds already are dropped.
async function take(trie, messages) {
  // NOTE: Imported here, as store.mjs and registry.mjs import this module.
  const store = await import("./store.mjs");
  const registry = await import("./chainstate/registry.mjs");
  const synching = true;
  for (const canonical of messages) {
    try {
      const message = JSON.parse(decodeCbor(canonical));
      const delegations = await registry.delegations();
      await store.add(trie, message, state.libp2p, delegations, synching);
    } catch (err) {
      log(`commits: Didn't take a message of an include(): ${err.message}`);
    }
  }
}

// After a sync: checks the commits again, a little later so that the rest
// of the sync's messages are in.
let timer;
export function synced(trie) {
  if (!enabled()) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    refresh(trie, client(), undefined, true).catch((err) =>
      log(`commits: Check after sync failed: ${err.message}`),
    );
  }, 30_000);
  timer.unref();
}

// Reads and checks the commits every ten minutes, gossiping the messages of
// include()s with `libp2p`; `after` gets the new commits (the sequencer's
// tick).
export async function run(trie, libp2p, snapshot, after) {
  state.libp2p = libp2p;
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
