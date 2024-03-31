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

function parse(log) {
  const { topics } = log;
  topics.shift();
  return decodeLog(inputs, log.data, topics);
}

export function* direct({ state: { line } }) {
  let logs;
  try {
    logs = JSON.parse(line);
  } catch (err) {
    log(err.toString());
    return;
  }

  for (let log of logs) {
    const parsedLog = parse(log);
    const key = serialize(
      [log.blockNumber, log.transactionIndex, log.logIndex],
      16,
    );
    yield {
      key,
      value: {
        to: parsedLog.to,
        timestamp: log.block.timestamp,
        value: log.transaction.value,
      },
    };
  }
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
    const key = serialize(
      [log.blockNumber, log.transactionIndex, log.logIndex],
      16,
    );
    const parsedLog = parse(log);
    yield {
      key,
      value: parsedLog.to,
    };
  }
}
