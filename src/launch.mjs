import { start } from "./index.mjs";
import log from "./logger.mjs";
import config from "./config.mjs";
import { handleDiscovery, handleConnection } from "./sync.mjs";

const handlers = {
  node: {
    "peer:discovery": handleDiscovery,
  },
  connection: {
    "peer:connect": handleConnection,
  },
};

(async () => {
  const node = await start(config, handlers.node, handlers.connection);

  node.getMultiaddrs().forEach((addr) => {
    log(`listening: ${addr.toString()}`);
  });
})();
