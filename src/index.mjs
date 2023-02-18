//@format
import { createLibp2p } from "libp2p";

import log from "./logger.mjs";
import { bootstrap } from "./id.mjs";

export async function start(
  config,
  nodeHandlers = {},
  connectionHandlers = {},
  protocolHandlers = {}
) {
  const peerId = await bootstrap(config.peerId.path);
  const node = await createLibp2p({ ...config, peerId });

  for (const [key, value] of Object.entries(nodeHandlers)) {
    log(`Adding "${key}" handler to node`);
    node.addEventListener(key, value);
  }
  for (const [key, value] of Object.entries(connectionHandlers)) {
    log(`Adding "${key}" handler to connectionManager`);
    node.connectionManager.addEventListener(key, value);
  }
  for await (const [key, value] of Object.entries(protocolHandlers)) {
    log(`Adding "${key}" protocol handler`);
    await node.handle(key, value);
  }

  await node.start();

  return node;
}
