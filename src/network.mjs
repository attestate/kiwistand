// @format
import Libp2p from "libp2p";
import TCP from "libp2p-tcp";
import { NOISE, Noise } from "@chainsafe/libp2p-noise";
import MPLEX from "libp2p-mplex";
import multiaddr from "multiaddr";

import config from "./config.mjs";

export async function init() {
  return await Libp2p.create({
    addresses: config.addresses,
    modules: {
      transport: [TCP],
      connEncryption: [NOISE],
      streamMuxer: [MPLEX]
    }
  });
}
