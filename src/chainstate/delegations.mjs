// @format
import { decodeLog } from "eth-fun";
import * as blockLogs from "@attestate/crawler-call-block-logs";
import { ecrecover } from "../id.mjs";

const { serialize } = blockLogs.loader;

const receiptmsg = (txid, options) => ({
  version: "0.0.1",
  type: "json-rpc",
  method: "eth_getTransactionReceipt",
  params: [txid],
  options,
});

export async function update({ message, execute, environment }) {
  const options = {
    url: environment.rpcHttpHost,
  };

  if (environment.rpcApiKey) {
    options.headers = {
      Authorization: `Bearer ${environment.rpcApiKey}`,
    };
  }

  if (!Array.isArray(message.results)) {
    return {
      messages: [],
      write: null,
    };
  }

  const updatedLogs = [];

  for await (const log of message.results) {
    const receipt = await execute(receiptmsg(log.transactionHash, options));

    if (!receipt.results) {
      console.error(receipt.error);
      continue;
    }

    updatedLogs.push({
      ...log,
      receipt: {
        from: receipt.results.from,
      },
    });
  }

  return {
    messages: [],
    write: JSON.stringify(updatedLogs),
  };
}

export function* order({ state: { line } }) {
  let logs;
  try {
    logs = JSON.parse(line);
  } catch (err) {
    log(err.toString());
    return;
  }

  for (let log of logs) {
    const key = serialize([log.blockNumber, log.transactionIndex], 16);
    yield {
      key,
      value: log,
    };
  }
}
