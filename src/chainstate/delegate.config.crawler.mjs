// @format
import { env } from "process";

import * as blockLogs from "@attestate/crawler-call-block-logs";
import * as delegations from "./delegations.mjs";
import * as registry from "./registry.mjs";

export default {
  environment: {
    // NOTE: We're hard-coding these values here as they're mandated (falsely)
    // by the @attestate/crawler but since kiwistand will never use them for
    // anything.
    rpcHttpHost: env.OPTIMISM_RPC_HTTP_HOST,
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
        module: blockLogs.state,
        interval: 1000 * 15,
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
  endpoints: {
    [process.env.OPTIMISM_RPC_HTTP_HOST]: {
      timeout: 10_000,
      // Respect Alchemy per-key throughput with a conservative cap
      // Adjust upward if your plan allows higher RPS
      requestsPerUnit: 15,
      unit: "second",
    },
  },
};
