// @format
// Compares what listen.mjs saw with the chain: every Delegate log in the
// block range it covered (eth_getLogs over RPC) must sit in a block that
// listen.mjs received and flagged. Also reports missed blocks, reorgs,
// latency and how many RPC calls listen.mjs needed.
//
// usage: node verify.mjs [events.jsonl]
import { readFileSync } from "fs";
import { env } from "process";

import * as op from "./op.mjs";

const RPC = env.RPC || "https://mainnet.optimism.io";
const file = process.argv[2] || "events.jsonl";

async function rpc(method, params) {
  for (let tries = 0; ; tries++) {
    try {
      const res = await fetch(RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(30000),
      });
      const json = await res.json();
      if (json.error) throw new Error(JSON.stringify(json.error));
      return json.result;
    } catch (err) {
      if (tries >= 4) throw err;
      await new Promise((r) => setTimeout(r, 2000 * (tries + 1)));
    }
  }
}

const events = readFileSync(file, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const blocks = new Map();
const delegations = new Map();
let reorgs = 0;
let rpcCalls = 0;
for (const e of events) {
  if (e.type === "block") blocks.set(e.number, e);
  if (e.type === "delegation") delegations.set(e.number, e);
  if (e.type === "reorg") reorgs++;
  if (e.type === "stats") rpcCalls = e.rpc;
}
if (!blocks.size) {
  console.log("No blocks received yet.");
  process.exit(1);
}

const numbers = [...blocks.keys()].sort((a, b) => a - b);
const from = numbers[0];
const to = numbers.at(-1);
const span = to - from + 1;
const missed = span - blocks.size;
const lags = [...blocks.values()].map((b) => b.lagMs).sort((a, b) => a - b);
const pct = (p) => lags[Math.min(lags.length - 1, Math.floor(lags.length * p))];
const start = events.find((e) => e.type === "start")?.t;
const hours = (events.at(-1).t - start) / 3_600_000;

const logs = [];
for (let lo = from; lo <= to; lo += 10_000) {
  const hi = Math.min(to, lo + 9_999);
  logs.push(
    ...(await rpc("eth_getLogs", [
      {
        fromBlock: `0x${lo.toString(16)}`,
        toBlock: `0x${hi.toString(16)}`,
        address: op.DELEGATOR,
        topics: [op.DELEGATE_TOPIC],
      },
    ])),
  );
}

const results = logs.map((log) => {
  const number = Number(log.blockNumber);
  const block = blocks.get(number);
  const seen = delegations.get(number);
  let status = "found";
  if (!block) status = "block not received";
  else if (block.hash !== log.blockHash) status = "different block hash";
  else if (!block.hit) status = "bloom said no (bug)";
  else if (!seen?.logs?.some((l) => l.transactionHash === log.transactionHash))
    status = "lookup failed";
  const direct = seen?.direct?.some((c) => c.hash === log.transactionHash);
  return { number, tx: log.transactionHash, status, direct: !!direct };
});

const flagged = [...blocks.values()].filter((b) => b.hit).length;
console.log(
  JSON.stringify(
    {
      hours: Math.round(hours * 10) / 10,
      blocks: { from, to, received: blocks.size, missed, reorgs },
      lagMs: { p50: pct(0.5), p90: pct(0.9), p99: pct(0.99), max: lags.at(-1) },
      flaggedByBloom: flagged,
      rpcCalls,
      rpcCallsPerDay: Math.round((rpcCalls / hours) * 24),
      pollingCallsPerDayToday: Math.round((24 * 3600) / 5),
      delegationsOnChain: logs.length,
      delegationsFound: results.filter((r) => r.status === "found").length,
      delegationsDirect: results.filter((r) => r.direct).length,
      problems: results.filter((r) => r.status !== "found"),
    },
    null,
    2,
  ),
);
