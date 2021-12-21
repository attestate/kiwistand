//@format
import { init } from "./network.mjs";

const main = async () => {
  const node = await init();
  await node.start();
  console.log("listening on addresses:");
  node.multiaddrs.forEach(addr => {
    console.log(`${addr.toString()}/p2p/${node.peerId.toB58String()}`);
  });
};

main()
  .then()
  .catch(console.log);
