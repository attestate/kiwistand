// @format
import { decodeLog } from "eth-fun";
import * as blockLogs from "@attestate/crawler-call-block-logs";

const { serialize } = blockLogs.loader;

const inputs = [
  {
    type: "address",
    name: "from",
    indexed: true,
  },
  {
    type: "address",
    name: "to",
    indexed: true,
  },
  {
    type: "uint256",
    name: "tokenId",
    indexed: true,
  },
];

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
    const { topics } = log;
    topics.shift();
    const parsedLog = decodeLog(inputs, log.data, topics);
    yield {
      key,
      value: parsedLog.to,
    };
  }
}
