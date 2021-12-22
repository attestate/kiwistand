//@format
import logger from "../logger.mjs";

export function discovery(peerId) {
  logger.info(`discovered ${peerId.toB58String()}`);
}
