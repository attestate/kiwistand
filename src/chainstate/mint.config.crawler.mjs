// @format
import * as blockLogs from "@attestate/crawler-call-block-logs";
import * as transferLoader from "./transfer-loader.mjs";
import * as delegations from "./delegations.mjs";

export default {
  environment: {
    // NOTE: We're hard-coding these values here as they're mandated (falsely)
    // by the @attestate/crawler but since kiwistand will never use them for
    // anything.
    ipfsHttpsGateway: "https://",
    arweaveHttpsGateway: "https://",
  },
  path: [
    {
      name: "call-block-logs",
      coordinator: {
        archive: false,
        module: blockLogs.state,
        interval: 1000 * 60,
      },
      extractor: {
        module: blockLogs.extractor,
        args: {
          start: 16873658,
          address: "0xebB15487787cBF8Ae2ffe1a6Cca5a50E63003786",
          topics: [
            "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
          ],
          blockspan: 5000,
        },
        output: {
          name: "call-block-logs-extraction",
        },
      },
      transformer: {
        module: blockLogs.transformer,
        args: {},
        input: {
          name: "call-block-logs-extraction",
        },
        output: {
          name: "call-block-logs-transformation",
        },
      },
      loader: {
        module: {
          ...blockLogs.loader,
          order: transferLoader.order,
        },
        input: {
          name: "call-block-logs-transformation",
        },
        output: {
          name: "call-block-logs-load",
        },
      },
    },
  ],
  queue: {
    options: {
      concurrent: 100,
    },
  },
  endpoints: {
    [process.env.RPC_HTTP_HOST]: {
      timeout: 10_000,
    },
  },
};
