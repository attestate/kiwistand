// @format
// The sequencer: the one node with an Ethereum key (SEQUENCER_PRIVATE_KEY)
// that orders the messages. It notes every message it takes, in order, and
// once an hour sends the ones since the last commit as the next commit
// (src/commits.mjs): one blob transaction to the inbox. Nothing new, no
// commit; fees too high, the commit waits. scripts/commit.mjs sends
// the genesis and can show any commit without sending it (--dry-run).
import { env } from "process";
import { appendFileSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

import { Trie } from "@ethereumjs/trie";
import { loadKZG } from "kzg-wasm";
import {
  toBlobs,
  toRlp,
  fromRlp,
  bytesToHex,
  commitmentToVersionedHash,
  parseGwei,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import log from "./logger.mjs";
import { COMMITS } from "./constants.mjs";
import * as commits from "./commits.mjs";

let kzg;

// A commit waits while the base fee is above this.
export const MAX_BASE_FEE = parseGwei("20");

export function enabled() {
  return Boolean(env.SEQUENCER_PRIVATE_KEY);
}

function path(name) {
  return join(env.DATA_DIR, name);
}

function lines(name) {
  if (!existsSync(path(name))) return [];
  return readFileSync(path(name), "utf8").split("\n").filter(Boolean);
}

// Notes that the sequencer took the message `id`, for the next commit.
export function take(id) {
  if (enabled()) appendFileSync(path("sequence.ids"), `${id}\n`);
}

// The next commit from the messages held (commits.held) and the commits so
// far, or null if nothing is new. Without commits, it's the genesis: every
// message up to now. Else it's every message no commit has yet, in the order
// the sequencer took them; ones it didn't note (e.g. from before it ran) come
// after those, by timestamp.
export async function next(messages, chain, snapshot) {
  const trie = await Trie.create();
  const all = [...messages.values()];
  if (!chain.length) {
    const now = Math.floor(Date.now() / 1000);
    const entries = all.filter(({ timestamp }) => timestamp <= now);
    return {
      k: 0,
      prev: snapshot,
      root: await commits.root(trie, entries),
      n: entries.length,
      ids: [],
      genesis: entries.map(({ id }) => id),
    };
  }

  // NOTE: The genesis' IDs are only on the sequencer (genesis.ids, written
  // by scripts/commit.mjs). Without them, it's what every node assumes.
  let genesis = lines("genesis.ids");
  if (!genesis.length)
    genesis = commits.genesis(messages, chain).map(({ id }) => id);
  const committed = new Set([...genesis, ...chain.flatMap(({ ids }) => ids)]);
  await commits.root(
    trie,
    all.filter(({ id }) => committed.has(id)),
  );
  const order = new Map(lines("sequence.ids").map((id, i) => [id, i]));
  const place = ({ id }) => order.get(id) ?? Infinity;
  const batch = all
    .filter(({ id }) => !committed.has(id))
    .sort(
      (a, b) =>
        place(a) - place(b) ||
        a.timestamp - b.timestamp ||
        (a.id < b.id ? -1 : 1),
    );
  if (!batch.length) return null;

  const last = chain.at(-1);
  return {
    k: last.k + 1,
    prev: last.hash,
    root: await commits.root(trie, batch),
    n: batch.length,
    ids: batch.map(({ id }) => id),
    blob: commits.pack(batch.map(({ canonical }) => canonical)),
  };
}

// The signed type-3 transaction as nodes take it over eth_sendRawTransaction:
// since Fusaka (EIP-7594) with the blobs' cell proofs (wrapper version 1), on
// older nodes with one proof per blob.
function wrap(signed, blobs, commitments, proofs, version) {
  const body = fromRlp(`0x${signed.slice(4)}`);
  const sidecar = version
    ? ["0x01", blobs, commitments, proofs]
    : [blobs, commitments, proofs];
  return `0x03${toRlp([body, ...sidecar]).slice(2)}`;
}

// Sends a commit to the inbox and waits for it. A commit with a blob goes as
// a type-3 transaction, the genesis as a normal one. Returns the transaction
// hash, or null if fees are too high.
export async function send(commit, rpc = commits.client()) {
  const account = privateKeyToAccount(env.SEQUENCER_PRIVATE_KEY);
  const data = commits.encodeCommit(commit);
  const { baseFeePerGas } = await rpc.getBlock();
  if (baseFeePerGas > MAX_BASE_FEE) {
    log(
      `sequencer: Base fee ${baseFeePerGas} too high, commit ${commit.k} waits`,
    );
    return null;
  }
  const to = COMMITS.inbox;
  const tx = {
    chainId: await rpc.getChainId(),
    nonce: await rpc.getTransactionCount({ address: account.address }),
    to,
    data,
    gas: await rpc.estimateGas({ account: account.address, to, data }),
    ...(await rpc.estimateFeesPerGas()),
  };

  let hash;
  if (!commit.blob) {
    const signed = await account.signTransaction({ ...tx, type: "eip1559" });
    hash = await rpc.sendRawTransaction({ serializedTransaction: signed });
  } else {
    // NOTE: Loading the trusted setup takes kzg-wasm about 20 seconds.
    kzg ??= loadKZG();
    const {
      blobToKZGCommitment,
      computeCellsAndKZGProofs,
      computeBlobKZGProof,
    } = await kzg;
    const blobs = toBlobs({ data: bytesToHex(commit.blob) });
    const commitments = blobs.map((blob) => blobToKZGCommitment(blob));
    const signed = await account.signTransaction({
      ...tx,
      type: "eip4844",
      maxFeePerBlobGas: (await rpc.getBlobBaseFee()) * 2n,
      blobVersionedHashes: commitments.map((commitment) =>
        commitmentToVersionedHash({ commitment }),
      ),
    });
    const cells = blobs.flatMap(
      (blob) => computeCellsAndKZGProofs(blob).proofs,
    );
    try {
      hash = await rpc.request({
        method: "eth_sendRawTransaction",
        params: [wrap(signed, blobs, commitments, cells, 1)],
      });
    } catch (err) {
      if (!/decode/i.test(err.details ?? err.message)) throw err;
      const proofs = blobs.map((blob, i) =>
        computeBlobKZGProof(blob, commitments[i]),
      );
      hash = await rpc.request({
        method: "eth_sendRawTransaction",
        params: [wrap(signed, blobs, commitments, proofs, 0)],
      });
    }
  }
  const receipt = await rpc.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success")
    throw new Error(`Commit ${commit.k} reverted: ${hash}`);
  if (commit.genesis)
    writeFileSync(path("genesis.ids"), `${commit.genesis.join("\n")}\n`);
  log(`sequencer: Sent commit ${commit.k} with ${commit.n} messages: ${hash}`);
  return hash;
}

// Sends the hour's commit, if there's something new: at the first tick (every
// 10 minutes, src/commits.mjs) of a UTC hour without a commit yet. `chain`
// are the commits so far (commits.refresh read them).
export async function tick(trie, chain, rpc, now = Date.now()) {
  const last = chain.at(-1);
  if (!enabled() || !last) return null;
  const hour = Math.floor(now / 1000 / 3600) * 3600;
  if (last.time >= hour) return null;
  const commit = await next(await commits.held(trie), chain);
  if (!commit) return null;
  return await send(commit, rpc);
}
