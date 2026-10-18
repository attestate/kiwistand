import { env } from "process";
import { BlockList } from "net";
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

// Peers announce their own addresses (identify, pubsub-peer-discovery), so
// without a gater we'd dial whatever a remote tells us to, including our own
// private network and cloud metadata.
const loopback = new BlockList();
loopback.addSubnet("127.0.0.0", 8, "ipv4");
loopback.addAddress("::1", "ipv6");

const reserved = new BlockList();
reserved.addSubnet("0.0.0.0", 8, "ipv4");
reserved.addSubnet("10.0.0.0", 8, "ipv4");
reserved.addSubnet("100.64.0.0", 10, "ipv4");
reserved.addSubnet("169.254.0.0", 16, "ipv4");
reserved.addSubnet("172.16.0.0", 12, "ipv4");
reserved.addSubnet("192.168.0.0", 16, "ipv4");
reserved.addSubnet("224.0.0.0", 3, "ipv4");
reserved.addAddress("::", "ipv6");
reserved.addSubnet("fc00::", 7, "ipv6");
reserved.addSubnet("fe80::", 10, "ipv6");
reserved.addSubnet("ff00::", 8, "ipv6");

// Local dev and tests run all nodes on 127.0.0.1.
const allowLoopback = BIND_ADDRESS_V4 === "127.0.0.1";

export function dialable(ma, allow) {
  const [name] = ma.protoNames();
  if (name !== "ip4" && name !== "ip6") return false;
  const [[, host]] = ma.stringTuples();
  const type = name === "ip4" ? "ipv4" : "ipv6";
  if (loopback.check(host, type)) return allow;
  return !reserved.check(host, type);
}

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
  connectionGater: {
    denyDialMultiaddr: async (peer, ma) => !dialable(ma, allowLoopback),
    filterMultiaddrForPeer: async (peer, ma) => dialable(ma, allowLoopback),
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
  // Leaf nodes dial us, so we don't chase peers from the peer store.
  config.connectionManager = {
    autoDial: false,
    maxConnections: 100,
    minConnections: 0,
  };
  // In pubsub-peer-discovery@8.0.0, listenOnly still subscribes (so we relay
  // the topic between leaf nodes) but drops every received peer record, as
  // _onMessage bails when no broadcast interval is running. That keeps
  // unauthenticated records out of our peer store, which can't be capped.
  config.peerDiscovery.push(pubsubPeerDiscovery({ listenOnly: true }));
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
    maxConnections: 100,
    minConnections: 5,
  };
  config.peerDiscovery.push(pubsubPeerDiscovery());
}

let USE_EPHEMERAL_ID = env.USE_EPHEMERAL_ID === "true" ? true : false;
if (USE_EPHEMERAL_ID) {
  log("Using in-memory id.");
} else {
  log("Using id from disk.");
  config.peerId.path = `${appdir()}/.keys.json`;
}

export default config;
