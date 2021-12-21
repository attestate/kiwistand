//@format
import { init } from "./network.mjs";
import logger from "./logger.mjs";

const main = async () => {
  const node = await init();
  await node.start();
  node.multiaddrs.forEach(addr => {
    logger.info(
      `listening: ${addr.toString()}/p2p/${node.peerId.toB58String()}`
    );
  });
};

main()
  .then()
  .catch(logger.error);
