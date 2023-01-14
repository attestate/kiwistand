import { start } from "./index.mjs";
import log from "./logger.mjs";
import config from "./config.mjs";

(async () => {
  const handlers = {
    "peer:discovery": (peer) => log(`discovered ${peer.toB58String()}`),
  };
  const node = await start(config, handlers);

  node.getMultiaddrs().forEach((addr) => {
    log(
      `listening: ${addr.toString()}/${
        config.protocolPrefix
      }/${node.peerId.toCID()}`
    );
  });
})();
