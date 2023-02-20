import { start } from "./index.mjs";
import log from "./logger.mjs";
import config from "./config.mjs";
import { handleDiscovery } from "./sync.mjs";

const handlers = {
  "peer:discovery": handleDiscovery,
};

(async () => {
  const node = await start(config, handlers);

  node.getMultiaddrs().forEach((addr) => {
    log(
      `listening: ${addr.toString()}/${
        config.protocolPrefix
      }/${node.peerId.toCID()}`
    );
  });
})();
