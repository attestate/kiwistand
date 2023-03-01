//@format
import { createLibp2p } from "libp2p";

import log from "./logger.mjs";
import { bootstrap } from "./id.mjs";

export async function start(
  config,
  nodeHandlers = {},
  connectionHandlers = {},
  protocolHandlers = {},
  topics = []
) {
  const peerId = await bootstrap(config.peerId.path);
  const node = await createLibp2p({ ...config, peerId });
  await node.start();

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

  for await (const { name, handlers } of topics) {
    log(`Subscribing to pubsub topic: "${name}"`);
    node.pubsub.subscribe(name);
    for await (const [key, value] of Object.entries(handlers)) {
      log(`Adding "${key}" pubsub handler`);
      await node.pubsub.addEventListener(key, value);
    }
  }

  return node;
}
