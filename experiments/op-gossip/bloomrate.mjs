// @format
// How often does a real block's logs bloom flag a possible Delegate log?
import { hexToBytes } from "viem";
import * as op from "./op.mjs";

const RPC = "https://mainnet.optimism.io";
const call = async (body) =>
  (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();

const head = Number((await call({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] })).result);
const N = Number(process.argv[2] || 2000);
let hits = 0, seen = 0, either = 0;
const get = async (n) => {
  for (let tries = 0; tries < 5; tries++) {
    const r = await call({ jsonrpc: "2.0", id: 1, method: "eth_getBlockByNumber", params: [`0x${n.toString(16)}`, false] }).catch(() => null);
    if (r?.result) return r.result;
    await new Promise((res) => setTimeout(res, 1000 * (tries + 1)));
  }
};
for (let n = head - N; n < head; n += 10) {
  const blocks = await Promise.all([...Array(10).keys()].map((i) => get(n + i)));
  for (const b of blocks) {
    if (!b) continue;
    const bloom = hexToBytes(b.logsBloom);
    seen++;
    if (op.inBloom(bloom, op.DELEGATOR) || op.inBloom(bloom, op.DELEGATE_TOPIC)) either++;
    if (op.mayHoldDelegation(bloom)) hits++;
  }
}
console.log(JSON.stringify({ blocks: seen, hits, rate: hits / seen, perDay: Math.round((hits / seen) * 43200), eitherRate: either / seen }));
