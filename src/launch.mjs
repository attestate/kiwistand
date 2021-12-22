import { start } from "./index.mjs";
import logger from "./logger.mjs";
import { discovery } from "./handlers/market.mjs";

(async () => {
  const handlers = {
    "peer:discovery": discovery
  };
  const node = await start(handlers);

  node.multiaddrs.forEach(addr => {
    logger.info(
      `listening: ${addr.toString()}/p2p/${node.peerId.toB58String()}`
    );
  });
})();
