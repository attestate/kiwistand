import { start } from "./index.mjs";
import log from "./logger.mjs";
import config from "./config.mjs";
import {
  handleDiscovery,
  handleConnection,
  handleDisconnection,
  topics,
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
};

(async () => {
  const node = await start(
    config,
    handlers.node,
    handlers.connection,
    handlers.protocol,
    topics
  );

  node.getMultiaddrs().forEach((addr) => {
    log(`listening: ${addr.toString()}`);
  });
})();
