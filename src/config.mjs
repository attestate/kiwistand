import { env } from "process";

import { appdir } from "./utils.mjs";
import logger from "./logger.mjs";

const { BIND_ADDRESS_V4, PORT } = env;
let peerId = {
  options: {
    keyType: "Ed25519"
  }
};

let IS_BOOTSTRAP_NODE = env.IS_BOOTSTRAP_NODE === "true" ? true : false;
if (IS_BOOTSTRAP_NODE) {
  peerId.isBootstrap = true;
  logger.info("Launching as bootstrap node");
} else {
  peerId.isBootstrap = false;
  logger.info("Attempting to connect to list of bootstrap nodes");
}

let USE_EPHEMERAL_ID = env.USE_EPHEMERAL_ID === "true" ? true : false;
if (USE_EPHEMERAL_ID) {
  logger.info("Using in-memory id.");
  peerId.isEphemeral = true;
} else {
  logger.info("Using id from disk.");
  peerId.isEphemeral = false;
  peerId.path = `${appdir()}/.keys.json`;
}

const config = {
  peerId,
  addresses: {
    listen: [`/ip4/${BIND_ADDRESS_V4}/tcp/${PORT}`]
  },
  peerDiscovery: {
    bootstrap: {
      interval: 60e3,
      enabled: true,
      list: [
        "/ip4/78.46.212.31/tcp/53462/p2p/12D3KooWDDfCNMZcC2qqYoUNEJuieCGhh5D9p7JDVivAodcx1PaU"
      ]
    }
  }
};
export default config;
