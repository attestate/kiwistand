// @format
import test from "ava";
import esmock from "esmock";
import process from "process";

import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { toString } from "uint8arrays/to-string";
import { fromString } from "uint8arrays/from-string";

import { fromWire, toWire, topics } from "../src/sync.mjs";
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

test.serial(
  "if third node can be discovered from bootstrap and newly online node",
  async (t) => {
    let node1, node2, node3;
    let peerId1, peerId2, peerId3;
    let connections = {
      "1t2": false,
      "1t3": false,
      "2t1": false,
      "2t3": false,
      "3t1": false,
      "3t2": false,
    };
    const message = { hello: "world" };
    const actual = await new Promise(async (resolve, reject) => {
      process.env.PORT = "53462";
      process.env.BIND_ADDRESS_V4 = "127.0.0.1";
      process.env.IS_BOOTSTRAP_NODE = "true";
      process.env.USE_EPHEMERAL_ID = "false";
      const config1 = (await import(`../src/config.mjs?${randInt()}`)).default;

      const nodeHandler1 = {
        "peer:discovery": (evt) => {
          console.log(`node1 discovered`);
        },
      };
      const connHandler1 = {
        "peer:connect": (evt) => {
          const remote = evt.detail.remotePeer.toString();
          console.log(`node1 connected ${remote}`);
          if (remote === peerId2) connections["1t2"] = true;
          if (remote === peerId3) connections["1t3"] = true;
        },
      };
      const protoHandler1 = {};

      node1 = await start(
        config1,
        nodeHandler1,
        connHandler1,
        protoHandler1,
        topics
      );
      peerId1 = node1.peerId.toString();

      process.env.PORT = "0";
      process.env.BIND_ADDRESS_V4 = "127.0.0.1";
      process.env.IS_BOOTSTRAP_NODE = "false";
      process.env.USE_EPHEMERAL_ID = "true";
      const config2 = (await import(`../src/config.mjs?${randInt()}`)).default;
      const nodeHandler2 = {
        "peer:discovery": (evt) => {
          console.log(`node2 discovered`);
        },
      };
      const connHandler2 = {
        "peer:connect": (evt) => {
          const remote = evt.detail.remotePeer.toString();
          console.log(`node2 connected ${remote}`);
          if (remote === peerId1) connections["2t1"] = true;
          if (remote === peerId3) {
            connections["2t3"] = true;
            if (connections["3t2"]) resolve();
          }
        },
      };
      const protoHandler2 = {};
      node2 = await start(
        config2,
        nodeHandler2,
        connHandler2,
        protoHandler2,
        topics
      );
      peerId2 = node2.peerId.toString();

      process.env.PORT = "0";
      process.env.BIND_ADDRESS_V4 = "127.0.0.1";
      process.env.IS_BOOTSTRAP_NODE = "false";
      process.env.USE_EPHEMERAL_ID = "true";
      const config3 = (await import(`../src/config.mjs?${randInt()}`)).default;
      const nodeHandler3 = {
        "peer:discovery": (evt) => {
          console.log(`node3 discovered`);
        },
      };
      const connHandler3 = {
        "peer:connect": (evt) => {
          const remote = evt.detail.remotePeer.toString();
          console.log(`node3 connected ${remote}`);
          if (remote === peerId1) connections["3t1"] = true;
          if (remote === peerId2) {
            connections["3t2"] = true;
            if (connections["2t3"]) resolve();
          }
        },
      };
      const protoHandler3 = {};
      node3 = await start(
        config3,
        nodeHandler3,
        connHandler3,
        protoHandler3,
        topics
      );
      peerId3 = node3.peerId.toString();
    });
    t.true(connections["1t2"]);
    t.true(connections["1t3"]);
    t.true(connections["2t1"]);
    t.true(connections["2t3"]);
    t.true(connections["3t1"]);
    t.true(connections["3t2"]);
    await node1.stop();
    await node2.stop();
    await node3.stop();
  }
);
