// @format
import log from "./logger.mjs";

export function handleDiscovery(peer) {
  log(`discovered ${peer.toCID()}`);
}
