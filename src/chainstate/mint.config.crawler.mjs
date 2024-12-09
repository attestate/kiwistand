// @format
import { env } from "process";

import * as blockLogs from "@attestate/crawler-call-block-logs";
import * as transferLoader from "./transfer-loader.mjs";
import * as delegations from "./delegations.mjs";
import * as registry from "./registry.mjs";

export default {
  environment: {
    // NOTE: We're hard-coding these values here as they're mandated (falsely)
    // by the @attestate/crawler but since kiwistand will never use them for
    // anything.
    rpcHttpHost: env.OPTIMISM_RPC_HTTP_HOST,
    // NOTE: We're hard-coding these values here as they're mandated (falsely)
    // by the @attestate/crawler but since kiwistand will never use them for
    // anything.
    ipfsHttpsGateway: "https://",
    arweaveHttpsGateway: "https://",
  },
  path: [
    {
      name: "op-call-block-logs",
      coordinator: {
        archive: false,
        module: blockLogs.state,
        interval: 1000 * 5,
      },
      extractor: {
        module: blockLogs.extractor,
        args: {
          start: 109542336,
          address: "0x66747bdC903d17C586fA09eE5D6b54CC85bBEA45",
          topics: [
            "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          ],
          blockspan: 5000,
          includeTimestamp: true,
          includeValue: true,
        },
        output: {
          name: "op-call-block-logs-extraction",
        },
      },
      transformer: {
        module: blockLogs.transformer,
        args: {},
        input: {
          name: "op-call-block-logs-extraction",
        },
        output: {
          name: "op-call-block-logs-transformation",
        },
      },
      loader: {
        module: transferLoader,
        input: {
          name: "op-call-block-logs-transformation",
        },
        output: {
          name: "op-call-block-logs-load",
        },
      },
      end: registry.refreshAccounts,
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
      requestsPerUnit: 15,
      unit: "second",
    },
  },
};
