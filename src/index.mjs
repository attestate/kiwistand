//@format
import { createLibp2p } from "libp2p";

import logger from "./logger.mjs";
import { bootstrap } from "./id.mjs";

export async function start(config, handlers = {}) {
  const peerId = await bootstrap(config.peerId.path, config.peerId.options);
  const node = await createLibp2p({ ...config, peerId });

  for (const [key, value] of Object.entries(handlers)) {
    logger.info(`Adding "${key}" handler`);
    node.addEventListener(key, value);
  }

  await node.start();

  return node;
}
