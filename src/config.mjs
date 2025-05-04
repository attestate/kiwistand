import { env } from "process";
import { tcp } from "@libp2p/tcp";
import { noise } from "@chainsafe/libp2p-noise";
import { mplex } from "@libp2p/mplex";
import { bootstrap } from "@libp2p/bootstrap";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery";

import { appdir } from "./utils.mjs";
import log from "./logger.mjs";

const { BIND_ADDRESS_V4, PORT } = env;
const DEFAULT_PORT = "53462";
const config = {
  peerId: {},
  transports: [tcp({ portMapper: false })], // Disable UPnP/NAT-PMP in TCP
  streamMuxers: [mplex()],
  connectionEncryption: [noise()],
  pubsub: gossipsub({
    doPX: true,
    allowPublishToZeroPeers: true,
  }),
  protocolPrefix: "p2p",
  addresses: {
    listen: [`/ip4/${BIND_ADDRESS_V4}/tcp/${PORT}`],
  },
  peerDiscovery: [],
  // Add this top-level option to disable all NAT traversal
  nat: {
    enabled: false,
  },
};

let IS_BOOTSTRAP_NODE = env.IS_BOOTSTRAP_NODE === "true" ? true : false;
if (IS_BOOTSTRAP_NODE) {
  if (PORT !== DEFAULT_PORT) {
    throw new Error(
      `Bootstrap nodes must run on default port ${DEFAULT_PORT}, current port ${PORT}`
    );
  }
  log("Launching as bootstrap node");
} else {
  log("Configuring bootstrap nodes");
  let bootstrapAddr = "91.107.210.214";
  if (BIND_ADDRESS_V4 === "127.0.0.1") {
    bootstrapAddr = "127.0.0.1";
  }
  config.peerDiscovery.push(
    bootstrap({
      list: [
        // TODO: We must this allowed to be defined when running config
        `/ip4/${bootstrapAddr}/tcp/${DEFAULT_PORT}/${config.protocolPrefix}/bafzaajiiaijccazrvdlmhms6g7cr6lurqp5aih27agldbplnh77i5oxn74sjm7773q`,
      ],
    })
  );
  config.connectionManager = {
    autoDial: true,
  };
}

config.peerDiscovery.push(pubsubPeerDiscovery());

let USE_EPHEMERAL_ID = env.USE_EPHEMERAL_ID === "true" ? true : false;
if (USE_EPHEMERAL_ID) {
  log("Using in-memory id.");
} else {
  log("Using id from disk.");
  config.peerId.path = `${appdir()}/.keys.json`;
}

export default config;
