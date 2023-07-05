// TODO: We should rename this file into a more descriptive name.
//@format
import { env } from "process";

import { createLibp2p } from "libp2p";

import log from "./logger.mjs";
import { bootstrap } from "./id.mjs";
import * as sync from "./sync.mjs";
import * as store from "./store.mjs";
import { PROTOCOL } from "./constants.mjs";

const { leaves, levels } = PROTOCOL.protocols;

export const handlers = {
  node: {
    "peer:discovery": sync.handleDiscovery,
  },
  connection: {
    "peer:connect": sync.handleConnection,
    "peer:disconnect": sync.handleDisconnection,
  },
  protocol: {
    [`/${levels.id}/${levels.version}`]: sync.handleLevels,
    [`/${leaves.id}/${leaves.version}`]: sync.handleLeaves,
  },
};

export async function start(config) {
  const peerId = await bootstrap(config.peerId.path);
  const node = await createLibp2p({ ...config, peerId });
  await node.start();
  return node;
}

export async function subscribe(
  node,
  nodeHandlers = {},
  connectionHandlers = {},
  protocolHandlers = {},
  topics = [],
  trie
) {
  const peerFab = sync.syncPeerFactory();

  // TODO: Move this into the launch file
  let protocolHandlerCopy = { ...protocolHandlers };
  try {
    protocolHandlerCopy[`/${levels.id}/${levels.version}`] =
      protocolHandlerCopy[`/${levels.id}/${levels.version}`](trie, peerFab);
    protocolHandlerCopy[`/${leaves.id}/${leaves.version}`] =
      protocolHandlerCopy[`/${leaves.id}/${leaves.version}`](trie, peerFab);
  } catch (err) {
    log(
      `Error setting up protocol handler (expected during testing): "${err.toString()}"`
    );
  }

  for (const [key, value] of Object.entries(nodeHandlers)) {
    log(`Adding "${key}" handler to node`);
    node.addEventListener(key, value);
  }
  for (const [key, value] of Object.entries(connectionHandlers)) {
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

  node.goblin = {};
  node.goblin.initiate = async (peerId) => {
    const level = 0;
    const exclude = [];
    const includeCheckpoints = false;
    const trieCopy = trie.copy(includeCheckpoints);
    return await sync.initiate(
      trieCopy,
      peerId,
      exclude,
      level,
      sync.send(node),
      peerFab
    );
  };

  sync.advertise(trie, node, env.ROOT_ADVERTISEMENT_TIMEOUT);

  node.getMultiaddrs().forEach((addr) => {
    log(`listening: ${addr.toString()}`);
  });

  return node;
}
