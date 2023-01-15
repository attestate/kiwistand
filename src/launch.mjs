import { start } from "./index.mjs";
import log from "./logger.mjs";
import config from "./config.mjs";
import { handleDiscovery, handleMessage } from "./sync.mjs";

const handlers = {
  "peer:discovery": handleDiscovery,
  "/messages/1.0.0/": handleMessage,
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
