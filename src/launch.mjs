import { start } from "./index.mjs";
import logger from "./logger.mjs";
import config from "./config.mjs";

(async () => {
  const handlers = {
    "peer:discovery": (peer) => logger.info(`discovered ${peer.toB58String()}`),
  };
  const node = await start(config, handlers);

  node.multiaddrs.forEach((addr) => {
    logger.info(
      `listening: ${addr.toString()}/${
        config.config.protocolPrefix
      }/${node.peerId.toB58String()}`
    );
  });
})();
