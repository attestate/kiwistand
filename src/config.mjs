import { env } from "process";
import TCP from "libp2p-tcp";
import { NOISE } from "@chainsafe/libp2p-noise";
import MPLEX from "libp2p-mplex";
import Bootstrap from "libp2p-bootstrap";

import { appdir } from "./utils.mjs";
import logger from "./logger.mjs";

const { BIND_ADDRESS_V4, PORT } = env;
const DEFAULT_PORT = "53462";
const peerId = {
  options: {
    keyType: "secp256k1"
  }
};
const modules = {
  transport: [TCP],
  connEncryption: [NOISE],
  streamMuxer: [MPLEX]
};
const config = {
  protocolPrefix: "p2p",
  autoDial: true
};

let IS_BOOTSTRAP_NODE = env.IS_BOOTSTRAP_NODE === "true" ? true : false;
if (IS_BOOTSTRAP_NODE) {
  if (PORT !== DEFAULT_PORT) {
    throw new Error(
      `Bootstrap nodes must run on default port ${DEFAULT_PORT}, current port ${PORT}`
    );
  }
  logger.info("Launching as bootstrap node");
} else {
  modules.peerDiscovery = [Bootstrap];
  config.peerDiscovery = {
    [Bootstrap.tag]: {
      interval: 2000,
      enabled: true,
      list: [
        `/ip4/78.46.212.31/tcp/${DEFAULT_PORT}/${config.protocolPrefix}/12D3KooWDDfCNMZcC2qqYoUNEJuieCGhh5D9p7JDVivAodcx1PaU`,
        `/ip4/127.0.0.1/tcp/${DEFAULT_PORT}/${config.protocolPrefix}/12D3KooWDDfCNMZcC2qqYoUNEJuieCGhh5D9p7JDVivAodcx1PaU`
      ]
    }
  };
  logger.info("Attempting to connect to list of bootstrap nodes");
}

let USE_EPHEMERAL_ID = env.USE_EPHEMERAL_ID === "true" ? true : false;
if (USE_EPHEMERAL_ID) {
  logger.info("Using in-memory id.");
} else {
  logger.info("Using id from disk.");
  peerId.path = `${appdir()}/.keys.json`;
}

const options = {
  peerId,
  modules,
  config,
  addresses: {
    listen: [`/ip4/${BIND_ADDRESS_V4}/tcp/${PORT}`]
  }
};
export default options;
