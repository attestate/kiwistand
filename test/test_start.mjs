// @format
import test from "ava";
import esmock from "esmock";
import process from "process";

import { start } from "../src/index.mjs";

function randInt() {
  return Math.floor(Math.random() * 10000);
}

test.serial(
  "run as bootstrap node but without correct default port",
  async (t) => {
    await t.throwsAsync(async () => {
      process.env.PORT = "1234";
      process.env.BIND_ADDRESS_V4 = "127.0.0.1";
      process.env.IS_BOOTSTRAP_NODE = "true";
      process.env.USE_EPHEMERAL_ID = "false";
      await import(`../src/config.mjs?${randInt()}`);
    });
  }
);

test.serial("run as bootstrap node", async (t) => {
  process.env.PORT = "53462";
  process.env.BIND_ADDRESS_V4 = "127.0.0.1";
  process.env.IS_BOOTSTRAP_NODE = "true";
  process.env.USE_EPHEMERAL_ID = "false";
  const config = (await import(`../src/config.mjs?${randInt()}`)).default;
  const node = await start(config);
  await node.stop();
  t.pass();
});

test.serial("if nodes can be bootstrapped", async (t) => {
  let node1, node2;
  const peer = await new Promise(async (resolve, reject) => {
    process.env.PORT = "53462";
    process.env.BIND_ADDRESS_V4 = "127.0.0.1";
    process.env.IS_BOOTSTRAP_NODE = "true";
    process.env.USE_EPHEMERAL_ID = "false";
    const config1 = (await import(`../src/config.mjs?${randInt()}`)).default;
    const handlers1 = {
      "peer:discovery": (peer) => {
        t.log("Bootstrap node: Found peer", peer);
      },
    };
    node1 = await start(config1, handlers1);

    process.env.PORT = "0";
    process.env.BIND_ADDRESS_V4 = "127.0.0.1";
    process.env.IS_BOOTSTRAP_NODE = "false";
    process.env.USE_EPHEMERAL_ID = "true";
    const config2 = (await import(`../src/config.mjs?${randInt()}`)).default;

    const handlers2 = {
      "peer:discovery": (peer) => {
        resolve(peer);
      },
    };
    node2 = await start(config2, handlers2);
  });
  t.truthy(peer);
  await node1.stop();
  await node2.stop();
});
