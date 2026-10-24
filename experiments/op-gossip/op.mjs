// @format
// Pure helpers for reading OP Stack sequencer gossip (op-node p2p): message
// ids, signature checks, the SSZ execution payload and the logs bloom.
// Mirrors op-node/p2p/gossip.go, op-service/signer and op-service/eth/ssz.go.
import { createHash } from "crypto";

import SnappyJS from "snappyjs";
import {
  keccak256,
  recoverAddress,
  bytesToHex,
  hexToBytes,
  parseTransaction,
  recoverTransactionAddress,
  decodeFunctionData,
} from "viem";

export const CHAIN_ID = 10n;
// SystemConfig(0x2290…B290).unsafeBlockSigner() on Ethereum mainnet.
export const SEQUENCER = "0xaaaa45d9549eda09e70937013520214382ffc4a2";
export const DELEGATOR = "0x418910fef46896eb0bfe38f656e2f7df3eca7198";
// keccak256("Delegate(bytes32[3],address)")
export const DELEGATE_TOPIC =
  "0xcd9cc59d1cc3aa17955023d009176720c8a383000a973ae2933c1cf6cbeee480";

// Topic version → payload layout: /0/ v1, /1/ v2, /2/ v3 (+ beacon root),
// /3/ v4 (Isthmus, + withdrawals root).
export const topics = {
  [`/optimism/${CHAIN_ID}/2/blocks`]: 3,
  [`/optimism/${CHAIN_ID}/3/blocks`]: 4,
};

const MAX_GOSSIP_SIZE = 10 * (1 << 20);

export function uncompress(data) {
  return SnappyJS.uncompress(data, MAX_GOSSIP_SIZE);
}

// op-node BuildMsgIdFn: sha256(domain ‖ len(topic) LE u64 ‖ topic ‖ data)[:20]
export function msgId(topic, data) {
  let body;
  let domain;
  try {
    body = uncompress(data);
    domain = Uint8Array.of(1, 0, 0, 0);
  } catch {
    body = data;
    domain = Uint8Array.of(0, 0, 0, 0);
  }
  const len = Buffer.alloc(8);
  len.writeBigUInt64LE(BigInt(topic.length));
  return new Uint8Array(
    createHash("sha256")
      .update(domain)
      .update(len)
      .update(topic)
      .update(body)
      .digest()
      .subarray(0, 20),
  );
}

// keccak256(domain(32 zero bytes) ‖ chainId(32 bytes BE) ‖ keccak256(payload))
export function signingHash(payload, chainId = CHAIN_ID) {
  const input = new Uint8Array(96);
  input.set(hexToBytes(`0x${chainId.toString(16).padStart(64, "0")}`), 32);
  input.set(hexToBytes(keccak256(payload)), 64);
  return keccak256(input);
}

export async function signer(signature, payload) {
  // Go's crypto.Sign gives v as 0/1; viem wants 27/28.
  const sig = new Uint8Array(signature);
  if (sig[64] < 27) sig[64] += 27;
  return (
    await recoverAddress({ hash: signingHash(payload), signature: bytesToHex(sig) })
  ).toLowerCase();
}

const u64 = (b, o) => new DataView(b.buffer, b.byteOffset + o, 8).getBigUint64(0, true);
const u32 = (b, o) => new DataView(b.buffer, b.byteOffset + o, 4).getUint32(0, true);
const hex = (b) => bytesToHex(b);

const FIXED = { 1: 508, 2: 512, 3: 528, 4: 560 };

// Decodes a gossip payload (after the 65 byte signature) into the fields we
// need. Versions 3 and 4 start with the parent beacon block root.
export function decodePayload(version, bytes) {
  const p = version >= 3 ? bytes.subarray(32) : bytes;
  const fixed = FIXED[version];
  if (p.length < fixed) throw new Error("payload too short");
  const extraOffset = u32(p, 436);
  if (extraOffset !== fixed) throw new Error("bad extra data offset");
  const txOffset = u32(p, 504);
  const txEnd = version >= 2 ? u32(p, 508) : p.length;
  if (txOffset < extraOffset || txEnd < txOffset || txEnd > p.length)
    throw new Error("bad offsets");
  const txs = [];
  const list = p.subarray(txOffset, txEnd);
  if (list.length) {
    const count = u32(list, 0) / 4;
    for (let i = 0; i < count; i++) {
      const start = u32(list, i * 4);
      const end = i + 1 < count ? u32(list, (i + 1) * 4) : list.length;
      txs.push(list.subarray(start, end));
    }
  }
  return {
    parentHash: hex(p.subarray(0, 32)),
    logsBloom: p.subarray(116, 372),
    number: Number(u64(p, 404)),
    timestamp: Number(u64(p, 428)),
    hash: hex(p.subarray(472, 504)),
    txs,
  };
}

// Ethereum's 2048 bit bloom: three 11 bit indexes from keccak256(value).
export function inBloom(bloom, value) {
  const h = hexToBytes(keccak256(value));
  for (let i = 0; i < 6; i += 2) {
    const bit = ((h[i] << 8) | h[i + 1]) & 2047;
    if ((bloom[255 - (bit >> 3)] & (1 << (bit & 7))) === 0) return false;
  }
  return true;
}

// True when the block may hold a Delegate log of the Delegator contract. No
// false negatives: internal calls (smart wallets, 4337) show up here too.
export function mayHoldDelegation(bloom) {
  return inBloom(bloom, DELEGATOR) && inBloom(bloom, DELEGATE_TOPIC);
}

const ETCH_ABI = [
  {
    type: "function",
    name: "etch",
    inputs: [{ type: "bytes32[3]", name: "data" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
];

// Direct (top level) calls to the Delegator in a block, decoded from
// calldata. Deposits (type 0x7e) and unknown types are skipped.
export async function directCalls(txs) {
  const calls = [];
  for (const raw of txs) {
    if (raw[0] === 0x7e) continue;
    let tx;
    const serialized = bytesToHex(raw);
    try {
      tx = parseTransaction(serialized);
    } catch {
      continue;
    }
    if (tx.to?.toLowerCase() !== DELEGATOR) continue;
    let data = null;
    try {
      data = decodeFunctionData({ abi: ETCH_ABI, data: tx.data }).args[0];
    } catch {}
    const from = (
      await recoverTransactionAddress({ serializedTransaction: serialized })
    ).toLowerCase();
    calls.push({ hash: keccak256(serialized), from, input: tx.data, data });
  }
  return calls;
}

