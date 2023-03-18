// TODO: We should rename this file into a more descriptive name.
//@format
import { createLibp2p } from "libp2p";

import log from "./logger.mjs";
import { bootstrap } from "./id.mjs";
import {
  handleLevels,
  handleLeaves,
  handleDiscovery,
  handleConnection,
  handleDisconnection,
} from "./sync.mjs";
import * as store from "./store.mjs";

export const handlers = {
  node: {
    "peer:discovery": handleDiscovery,
  },
  connection: {
    "peer:connect": handleConnection,
    "peer:disconnect": handleDisconnection,
  },
  protocol: {
    "/levels/1.0.0": handleLevels,
    "/leaves/1.0.0": handleLeaves,
  },
};

export async function start(
  config,
  nodeHandlers = {},
  connectionHandlers = {},
  protocolHandlers = {},
  topics = [],
  trie
) {
  const peerId = await bootstrap(config.peerId.path);
  const node = await createLibp2p({ ...config, peerId });
  await node.start();

  // NOTE: We're manually passing in libp2p's instantiation foward as we want
  // to avoid having to declare a global object.
  // TODO: Find a more elegant way of doing this.
  let connHandlerCopy = { ...connectionHandlers };
  try {
    connHandlerCopy["peer:connect"] = connHandlerCopy["peer:connect"](
      node,
      trie
    );
  } catch (err) {
    log(
      `Error setting up connection handler (expected during testing): "${err.toString()}"`
    );
  }
  let protocolHandlerCopy = { ...protocolHandlers };
  try {
    protocolHandlerCopy["/levels/1.0.0"] =
      protocolHandlerCopy["/levels/1.0.0"](trie);
    protocolHandlerCopy["/leaves/1.0.0"] =
      protocolHandlerCopy["/leaves/1.0.0"](trie);
  } catch (err) {
    log(
      `Error setting up protocol handler (expected during testing): "${err.toString()}"`
    );
  }

  for (const [key, value] of Object.entries(nodeHandlers)) {
    log(`Adding "${key}" handler to node`);
    node.addEventListener(key, value);
  }
  for (const [key, value] of Object.entries(connHandlerCopy)) {
    log(`Adding "${key}" handler to connectionManager`);
    node.connectionManager.addEventListener(key, value);
  }
  for await (const [key, value] of Object.entries(protocolHandlerCopy)) {
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

  node.getMultiaddrs().forEach((addr) => {
    log(`listening: ${addr.toString()}`);
  });

  return node;
}
