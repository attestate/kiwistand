import Libp2p from "libp2p";
import TCP from "libp2p-tcp";
import { NOISE, Noise } from "@chainsafe/libp2p-noise";
import MPLEX from "libp2p-mplex";
import multiaddr from "multiaddr";

const main = async () => {
  const node = await Libp2p.create({
    addresses: {
      listen: ["/ip4/127.0.0.1/tcp/0"]
    },
    modules: {
      transport: [TCP],
      connEncryption: [NOISE],
      streamMuxer: [MPLEX]
    }
  });

  await node.start();
  console.log("libp2p has started");

  console.log("listening on addresses:");
  node.multiaddrs.forEach(addr => {
    console.log(`${addr.toString()}/p2p/${node.peerId.toB58String()}`);
  });
};

main()
  .then()
  .catch(console.log);
