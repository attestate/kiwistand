//@format
import { init } from "./network.mjs";
import logger from "./logger.mjs";
import { bootstrap } from "./id.mjs";
import config from "./config.mjs";

export async function start(handlers = {}) {
  const peerId = await bootstrap(config.peerId.path);
  const node = await init(config, peerId);

  for (const [key, value] of Object.entries(handlers)) {
    logger.info(`Adding "${key}" handler`);
    node.on(key, value);
  }

  await node.start();

  return node;
}
