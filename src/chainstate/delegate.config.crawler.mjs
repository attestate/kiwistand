// @format
import { env } from "process";

import * as blockLogs from "@attestate/crawler-call-block-logs";
import * as delegations from "./delegations.mjs";
import * as registry from "./registry.mjs";

// NOTE: Instead of a WebSocket newHeads subscription (one paid event per
// Optimism block), we poll eth_blockNumber every 5 seconds and let the
// crawler scan all blocks since its last run. Each poll rotates through
// OPTIMISM_CRAWLER_RPC_HOSTS (comma-separated) to spread the load across
// several providers' free tiers.
const hosts = (
  env.OPTIMISM_CRAWLER_RPC_HOSTS || env.OPTIMISM_RPC_HTTP_HOST
).split(",");

function watch({ environment, onNewBlock }) {
  let busy = false;
  let i = 0;
  const interval = setInterval(async () => {
    if (busy) return;
    busy = true;
    environment.rpcHttpHost = hosts[i++ % hosts.length];
    try {
      const res = await fetch(environment.rpcHttpHost, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_blockNumber",
          params: [],
        }),
      });
      const { result, error } = await res.json();
      if (!result) throw new Error(error?.message ?? "no block number");
      await onNewBlock(parseInt(result, 16));
    } catch (err) {
      console.error(`Delegation poll failed: ${err.message}`);
    } finally {
      busy = false;
    }
  }, 5000);
  return () => clearInterval(interval);
}

export default {
  environment: {
    // NOTE: We're hard-coding these values here as they're mandated (falsely)
    // by the @attestate/crawler but since kiwistand will never use them for
    // anything.
    rpcHttpHost: hosts[0],
    // NOTE: We found that Infura's v3 endpoints don't like when we send
    // "Authorization: Bearer undefined" and so to make "environment.rpcApiKey"
    // in crawler-call-block-logs.state to not set an Authorization header,
    // we're submitting the empty string that evaluates to false.
    rpcApiKey: "",
    ipfsHttpsGateway: "https://",
    arweaveHttpsGateway: "https://",
  },
  path: [
    {
      name: "list-delegations-2",
      coordinator: {
        archive: false,
        module: { ...blockLogs.state, watch },
      },
      extractor: {
        module: {
          ...blockLogs.extractor,
          update: delegations.update,
        },
        args: {
          start: 140309527,  // Delegator3 deployment block
          address: "0x418910fef46896eb0bfe38f656e2f7df3eca7198",  // Delegator3 address
          topics: [
            // keccak256("Delegate(bytes32[3],address)") ===
            "0xcd9cc59d1cc3aa17955023d009176720c8a383000a973ae2933c1cf6cbeee480",
          ],
          blockspan: 5000,
          includeTimestamp: false,
        },
        output: {
          name: "list-delegations-extraction-2",
        },
      },
      transformer: {
        module: blockLogs.transformer,
        args: {
          inputs: [
            {
              type: "bytes32[3]",
              name: "data",
              indexed: false,
            },
            {
              type: "address",
              name: "sender",
              indexed: false,
            },
          ],
        },
        input: {
          name: "list-delegations-extraction-2",
        },
        output: {
          name: "list-delegations-transformation-2",
        },
      },
      loader: {
        module: {
          ...blockLogs.loader,
          order: delegations.order,
        },
        input: {
          name: "list-delegations-transformation-2",
        },
        output: {
          name: "list-delegations-load-2",
        },
      },
      end: registry.refreshDelegations,
    },
  ],
  queue: {
    options: {
      // Keep concurrency modest; actual RPS is enforced via endpoints below
      concurrent: 10,
    },
  },
  endpoints: Object.fromEntries(
    hosts.map((host) => [
      host,
      {
        timeout: 10_000,
        // Respect per-key throughput with a conservative cap
        // Adjust upward if your plan allows higher RPS
        requestsPerUnit: 15,
        unit: "second",
      },
    ]),
  ),
};
