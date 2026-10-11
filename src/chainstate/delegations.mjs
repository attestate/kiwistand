import * as blockLogs from "@attestate/crawler-call-block-logs";

const { serialize } = blockLogs.loader;

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
    updatedLogs.push({
      ...log,
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
    const key = serialize(
      [log.blockNumber, log.transactionIndex, log.logIndex],
      16,
    );
    yield {
      key,
      value: log,
    };
  }
}
