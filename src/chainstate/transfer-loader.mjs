// @format
import { decodeLog } from "eth-fun";
import ethers from "ethers";
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

const purchaseDelegatorABI = [
  { inputs: [], name: "ErrValue", type: "error" },
  {
    inputs: [{ internalType: "bytes32[3]", name: "data", type: "bytes32[3]" }],
    name: "setup",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
];
const purchaseDelegatorAddress = "0x418910fef46896eb0bfe38f656e2f7df3eca7198"; // Delegator3
const purchaseDelegatorInterface = new ethers.utils.Interface(
  purchaseDelegatorABI,
);

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

    let beneficiaries = [];
    let amounts = [];
    if (log.transaction.to === purchaseDelegatorAddress) {
      try {
        purchaseDelegatorInterface.decodeFunctionData(
          "setup",
          log.transaction.input,
        );
      } catch (error) {
        console.error(
          `Failed to decode setup input for transaction ${log.transaction.hash}: ${error.message}`,
        );
      }
    }

    yield {
      key,
      value: {
        from: parsedLog.from,
        to: parsedLog.to,
        timestamp: log.block.timestamp,
        value: log.transaction.value,
        revenueShare: {
          beneficiaries,
          amounts,
        },
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

    let beneficiaries = [];
    let amounts = [];
    if (log.transaction.to === purchaseDelegatorAddress) {
      try {
        purchaseDelegatorInterface.decodeFunctionData(
          "setup",
          log.transaction.input,
        );
      } catch (error) {
        console.error(
          `Failed to decode setup input for transaction ${log.transaction.hash}: ${error.message}`,
        );
      }
    }

    yield {
      key,
      value: {
        from: parsedLog.from,
        to: parsedLog.to,
        tokenId: parsedLog.tokenId,
        timestamp: log.block.timestamp,
        value: log.transaction.value,
        revenueShare: {
          beneficiaries,
          amounts,
        },
      },
    };
  }
}
