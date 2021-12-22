// @format
import Libp2p from "libp2p";
import TCP from "libp2p-tcp";
import { NOISE, Noise } from "@chainsafe/libp2p-noise";
import MPLEX from "libp2p-mplex";
import multiaddr from "multiaddr";
import Gossipsub from "libp2p-gossipsub";
import Bootstrap from "libp2p-bootstrap";

export async function init(config, peerId) {
  return await Libp2p.create({
    peerId,
    addresses: config.addresses,
    modules: {
      transport: [TCP],
      connEncryption: [NOISE],
      streamMuxer: [MPLEX],
      pubsub: Gossipsub,
      peerDiscovery: [Bootstrap]
    },
    config: {
      peerDiscovery: config.peerDiscovery
    }
  });
}
