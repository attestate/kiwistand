import { start } from "./index.mjs";
import log from "./logger.mjs";
import config from "./config.mjs";
import {
  handleDiscovery,
  handleConnection,
  handleDisconnection,
  handleMessage,
} from "./sync.mjs";

const handlers = {
  node: {
    "peer:discovery": handleDiscovery,
  },
  connection: {
    "peer:connect": handleConnection,
    "peer:disconnect": handleDisconnection,
  },
  protocol: {},
  pubsub: {
    message: handleMessage,
  },
};

(async () => {
  const node = await start(
    config,
    handlers.node,
    handlers.connection,
    handlers.protocol,
    handlers.pubsub
  );

  const topic = "replicatest";
  node.pubsub.subscribe(topic);
  setInterval(() => {
    try {
      node.pubsub.publish(topic, new TextEncoder().encode("banana"));
    } catch (err) {
      console.error(err);
    }
  }, 2000);

  node.getMultiaddrs().forEach((addr) => {
    log(`listening: ${addr.toString()}`);
  });
})();
