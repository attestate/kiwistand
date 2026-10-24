// @format
// Joins OP mainnet's sequencer gossip (no RPC), verifies every block's
// sequencer signature and checks its logs bloom for Delegate events. Only
// blocks that may hold one are looked up over RPC (eth_getLogs by blockHash).
// Writes one JSON line per event to $OUT (default ./events.jsonl).
import { appendFileSync } from "fs";
import { env } from "process";

import { createLibp2p } from "libp2p";
import { tcp } from "@libp2p/tcp";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify } from "@libp2p/identify";
import { ping } from "@libp2p/ping";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { TopicValidatorResult } from "@libp2p/interface";
import { generateKeyPair } from "@libp2p/crypto/keys";
import { Discv5 } from "@chainsafe/discv5";
import { ENR, SignableENR } from "@chainsafe/enr";
import { multiaddr } from "@multiformats/multiaddr";

import * as op from "./op.mjs";

const OUT = env.OUT || "events.jsonl";
const RPC = env.RPC || "https://mainnet.optimism.io";
const UDP_PORT = Number(env.UDP_PORT || 9200);
const MAX_PEERS = Number(env.MAX_PEERS || 30);

const BOOTNODES = [
  "enr:-J24QNz9lbrKbN4iSmmjtnr7SjUMk4zB7f1krHZcTZx-JRKZd0kA2gjufUROD6T3sOWDVDnFJRvqBBo62zuF-hYCohOGAYiOoEyEgmlkgnY0gmlwhAPniryHb3BzdGFja4OFQgCJc2VjcDI1NmsxoQKNVFlCxh_B-716tTs-h1vMzZkSs1FTu_OYTNjgufplG4N0Y3CCJAaDdWRwgiQG",
  "enr:-J24QH-f1wt99sfpHy4c0QJM-NfmsIfmlLAMMcgZCUEgKG_BBYFc6FwYgaMJMQN5dsRBJApIok0jFn-9CS842lGpLmqGAYiOoDRAgmlkgnY0gmlwhLhIgb2Hb3BzdGFja4OFQgCJc2VjcDI1NmsxoQJ9FTIv8B9myn1MWaC_2lJ-sMoeCDkusCsk4BYHjjCq04N0Y3CCJAaDdWRwgiQG",
  "enr:-J24QDXyyxvQYsd0yfsN0cRr1lZ1N11zGTplMNlW4xNEc7LkPXh0NAJ9iSOVdRO95GPYAIc6xmyoCCG6_0JxdL3a0zaGAYiOoAjFgmlkgnY0gmlwhAPckbGHb3BzdGFja4OFQgCJc2VjcDI1NmsxoQJwoS7tzwxqXSyFL7g0JM-KWVbgvjfB8JA__T7yY_cYboN0Y3CCJAaDdWRwgiQG",
  "enr:-J24QHmGyBwUZXIcsGYMaUqGGSl4CFdx9Tozu-vQCn5bHIQbR7On7dZbU61vYvfrJr30t0iahSqhc64J46MnUO2JvQaGAYiOoCKKgmlkgnY0gmlwhAPnCzSHb3BzdGFja4OFQgCJc2VjcDI1NmsxoQINc4fSijfbNIiGhcgvwjsjxVFJHUstK9L1T8OTKUjgloN0Y3CCJAaDdWRwgiQG",
  "enr:-J24QG3ypT4xSu0gjb5PABCmVxZqBjVw9ca7pvsI8jl4KATYAnxBmfkaIuEqy9sKvDHKuNCsy57WwK9wTt2aQgcaDDyGAYiOoGAXgmlkgnY0gmlwhDbGmZaHb3BzdGFja4OFQgCJc2VjcDI1NmsxoQIeAK_--tcLEiu7HvoUlbV52MspE0uCocsx1f_rYvRenIN0Y3CCJAaDdWRwgiQG",
];

const write = (event) =>
  appendFileSync(OUT, JSON.stringify({ t: Date.now(), ...event }) + "\n");

// "opstack" ENR entry: uvarint chainId ‖ uvarint version, RLP byte string.
function opstack(enr) {
  const value = enr.kvs.get("opstack");
  if (!value) return null;
  let i = 0;
  const varint = () => {
    let n = 0n;
    let shift = 0n;
    for (;;) {
      const b = value[i++];
      n |= BigInt(b & 0x7f) << shift;
      if (!(b & 0x80)) return n;
      shift += 7n;
    }
  };
  try {
    return { chainId: varint(), version: varint() };
  } catch {
    return null;
  }
}

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json();
  if (json.error) throw new Error(JSON.stringify(json.error));
  return json.result;
}

const privateKey = await generateKeyPair("secp256k1");
const node = await createLibp2p({
  privateKey,
  addresses: { listen: ["/ip4/0.0.0.0/tcp/0"] },
  transports: [tcp()],
  connectionEncrypters: [noise()],
  streamMuxers: [yamux()],
  connectionManager: { maxConnections: MAX_PEERS },
  services: {
    identify: identify(),
    ping: ping(),
    pubsub: gossipsub({
      globalSignaturePolicy: "StrictNoSign",
      msgIdFn: (msg) => op.msgId(msg.topic, msg.data),
      D: 8,
      Dlo: 6,
      Dhi: 12,
      Dlazy: 6,
      heartbeatInterval: 500,
      mcacheLength: 12,
      mcacheGossip: 3,
      seenTTL: 130_000,
      doPX: false,
      maxInboundDataLength: 10 * (1 << 20),
    }),
  },
});

const pubsub = node.services.pubsub;
const seen = new Map(); // number → hash
let last = null;
let stats = { blocks: 0, invalid: 0, hits: 0, gaps: 0, reorgs: 0, rpc: 0 };

for (const [topic, version] of Object.entries(op.topics)) {
  pubsub.topicValidators.set(topic, async (_peer, msg) => {
    try {
      const data = op.uncompress(msg.data);
      const signature = data.subarray(0, 65);
      const payload = data.subarray(65);
      if ((await op.signer(signature, payload)) !== op.SEQUENCER) {
        stats.invalid++;
        return TopicValidatorResult.Reject;
      }
      op.decodePayload(version, payload);
      return TopicValidatorResult.Accept;
    } catch (err) {
      stats.invalid++;
      return TopicValidatorResult.Reject;
    }
  });
  pubsub.subscribe(topic);
}

pubsub.addEventListener("message", ({ detail: msg }) =>
  onBlock(msg).catch((err) => write({ type: "error", error: String(err) })),
);

async function onBlock(msg) {
  const version = op.topics[msg.topic];
  if (!version) return;
  const recv = Date.now();
  const block = op.decodePayload(version, op.uncompress(msg.data).subarray(65));
  stats.blocks++;
  const known = seen.get(block.number);
  if (known === block.hash) return;
  if (known) {
    stats.reorgs++;
    write({ type: "reorg", number: block.number, old: known, new: block.hash });
  }
  seen.set(block.number, block.hash);
  if (seen.size > 2000) seen.delete(seen.keys().next().value);
  if (last !== null && block.number > last + 1) {
    stats.gaps++;
    write({ type: "gap", from: last + 1, to: block.number - 1 });
  }
  if (last === null || block.number > last) last = block.number;

  const hit = op.mayHoldDelegation(block.logsBloom);
  write({
    type: "block",
    number: block.number,
    hash: block.hash,
    lagMs: recv - block.timestamp * 1000,
    txs: block.txs.length,
    hit,
  });
  if (!hit) return;

  stats.hits++;
  const direct = await op.directCalls(block.txs);
  let logs = null;
  try {
    stats.rpc++;
    logs = await rpc("eth_getLogs", [
      { blockHash: block.hash, address: op.DELEGATOR, topics: [op.DELEGATE_TOPIC] },
    ]);
  } catch (err) {
    write({ type: "rpc-error", number: block.number, error: String(err) });
  }
  write({
    type: "delegation",
    number: block.number,
    hash: block.hash,
    direct,
    logs: logs?.map(({ transactionHash, data, logIndex }) => ({
      transactionHash,
      data,
      logIndex,
    })),
  });
}

// Discovery: walk discv5 for nodes tagged opstack chainId 10, dial them.
const enr = SignableENR.createFromPrivateKey(privateKey);
const discv5 = Discv5.create({
  enr,
  privateKey,
  bindAddrs: { ip4: multiaddr(`/ip4/0.0.0.0/udp/${UDP_PORT}`) },
  config: { enrUpdate: true },
});
const dialed = new Set();
discv5.addListener("discovered", async (found) => {
  const tag = opstack(found);
  if (!tag || tag.chainId !== op.CHAIN_ID || tag.version !== 0n) return;
  const addr = found.getLocationMultiaddr("tcp");
  if (!addr) return;
  const id = found.peerId.toString();
  if (dialed.has(id)) return;
  if (node.getConnections().length >= MAX_PEERS) return;
  dialed.add(id);
  try {
    await node.dial(multiaddr(`${addr.toString()}/p2p/${id}`), {
      signal: AbortSignal.timeout(10000),
    });
    write({ type: "connected", peer: id, addr: addr.toString() });
  } catch (err) {
    setTimeout(() => dialed.delete(id), 10 * 60_000);
  }
});
for (const bootnode of BOOTNODES) discv5.addEnr(bootnode);
await discv5.start();

(async () => {
  for (;;) {
    if (node.getConnections().length < MAX_PEERS) {
      await discv5.findRandomNode().catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
})();

setInterval(() => {
  const event = {
    type: "stats",
    peers: node.getConnections().length,
    mesh: pubsub.getMeshPeers(Object.keys(op.topics)[1]).length,
    known: discv5.kadValues().length,
    head: last,
    ...stats,
  };
  write(event);
  console.log(new Date().toISOString(), JSON.stringify(event));
}, 60_000);

process.on("unhandledRejection", (err) =>
  write({ type: "error", error: String(err) }),
);

write({ type: "start", peerId: node.peerId.toString() });
console.log("listening as", node.peerId.toString());
