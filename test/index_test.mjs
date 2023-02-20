// @format
import test from "ava";
import esmock from "esmock";
import process from "process";

import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { toString } from "uint8arrays/to-string";
import { fromString } from "uint8arrays/from-string";

import { fromWire, toWire } from "../src/sync.mjs";
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

test.serial(
  "if nodes can be bootstrapped using from and to wire",
  async (t) => {
    let node1, node2;
    const message = { hello: "world" };
    const actual = await new Promise(async (resolve, reject) => {
      process.env.PORT = "53462";
      process.env.BIND_ADDRESS_V4 = "127.0.0.1";
      process.env.IS_BOOTSTRAP_NODE = "true";
      process.env.USE_EPHEMERAL_ID = "false";
      const config1 = (await import(`../src/config.mjs?${randInt()}`)).default;

      const nodeHandler1 = {};
      const connHandler1 = {};
      const protoHandler1 = {
        "/test/1.0.0": async ({ stream }) => {
          const result = await fromWire(stream);
          resolve(result);
        },
      };

      node1 = await start(config1, nodeHandler1, connHandler1, protoHandler1);

      process.env.PORT = "0";
      process.env.BIND_ADDRESS_V4 = "127.0.0.1";
      process.env.IS_BOOTSTRAP_NODE = "false";
      process.env.USE_EPHEMERAL_ID = "true";
      const config2 = (await import(`../src/config.mjs?${randInt()}`)).default;

      const nodeHandler2 = {
        "peer:discovery": async (evt) => {
          const stream = await node2.dialProtocol(
            evt.detail.multiaddrs[0],
            "/test/1.0.0"
          );
          await toWire(message, stream.sink);
        },
      };
      const connHandler2 = {};
      node2 = await start(config2, nodeHandler2, connHandler2);
    });
    t.deepEqual(actual, [message]);
    await node1.stop();
    await node2.stop();
  }
);

test.serial("if nodes can be bootstrapped", async (t) => {
  let node1, node2;
  const message = { hello: "world" };
  const actual = await new Promise(async (resolve, reject) => {
    process.env.PORT = "53462";
    process.env.BIND_ADDRESS_V4 = "127.0.0.1";
    process.env.IS_BOOTSTRAP_NODE = "true";
    process.env.USE_EPHEMERAL_ID = "false";
    const config1 = (await import(`../src/config.mjs?${randInt()}`)).default;

    const nodeHandler1 = {};
    const connHandler1 = {};
    const protoHandler1 = {
      "/test/1.0.0": async ({ stream }) => {
        await pipe(stream.source, lp.decode(), async function (source) {
          for await (const msg of source) {
            const s = toString(msg.subarray());
            resolve(JSON.parse(s));
          }
        });
      },
    };

    node1 = await start(config1, nodeHandler1, connHandler1, protoHandler1);

    process.env.PORT = "0";
    process.env.BIND_ADDRESS_V4 = "127.0.0.1";
    process.env.IS_BOOTSTRAP_NODE = "false";
    process.env.USE_EPHEMERAL_ID = "true";
    const config2 = (await import(`../src/config.mjs?${randInt()}`)).default;

    const nodeHandler2 = {
      "peer:discovery": async (evt) => {
        const stream = await node2.dialProtocol(
          evt.detail.multiaddrs[0],
          "/test/1.0.0"
        );
        await pipe(
          [fromString(JSON.stringify(message))],
          lp.encode(),
          stream.sink
        );
      },
    };
    const connHandler2 = {};
    node2 = await start(config2, nodeHandler2, connHandler2);
  });
  t.deepEqual(actual, message);
  await node1.stop();
  await node2.stop();
});
