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
          start: 106733451,
          address: "0x08b7ecfac2c5754abafb789c84f8fa37c9f088b0",
          topics: [
            // keccak256("Delegate(bytes32[3])") ===
            "0x9fcbf2ac7d9825115ae81812d10efa7fce04fcc9ca46f1d416aba53cdea8483e",
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
      concurrent: 100,
    },
  },
  endpoints: {
    [process.env.OPTIMISM_RPC_HTTP_HOST]: {
      timeout: 10_000,
    },
  },
};
