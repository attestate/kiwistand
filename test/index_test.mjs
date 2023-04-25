// @format
import test from "ava";
import process from "process";
import { rm } from "fs/promises";
import { resolve } from "path";

import { database } from "@attestate/crawler";
import { bootstrap } from "@libp2p/bootstrap";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { CustomEvent } from "@libp2p/interfaces/events";
import { Wallet, utils } from "ethers";
import { encode, decode } from "cbor-x";

import {
  deserialize,
  fromWire,
  toWire,
  handleConnection,
  receive,
} from "../src/sync.mjs";
import * as messages from "../src/topics/messages.mjs";
import { start, subscribe, handlers } from "../src/index.mjs";
import * as store from "../src/store.mjs";
import log from "../src/logger.mjs";
import { sign, create } from "../src/id.mjs";
import { PROTOCOL, EIP712_MESSAGE } from "../src/constants.mjs";

const { leaves } = PROTOCOL.protocols;

async function removeTestFolders() {
  try {
    await rm("dbtestA", { recursive: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  try {
    await rm("dbtestB", { recursive: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

test.afterEach.always(async () => {
  await removeTestFolders();
});

async function simplePut(trie, message) {
  const missing = deserialize(message);
  for await (let { node, key } of missing) {
    const value = node.value();
    log(
      `TESTFN: Adding to key "${key.toString("hex")}" database value "${value}"`
    );
    await trie.put(key, value);
  }
}

function simpleHandleLeaves(trie) {
  return receive(async (message) => {
    log("Received leaves and storing them in db");
    trie.checkpoint();
    // NOTE: To test the trie syncing algorithm with simple values and variable
    // values we're initially testing it with an insertion function that
    // accepts any kind of key value (and not only correctly signed messages by
    // a member of an allowlist).
    await simplePut(trie, message);
    await trie.commit();
  });
}

function randInt() {
  return Math.floor(Math.random() * 10000);
}

// TODO: For some reason this fails with 2023-05-05T22:32:09.930Z
// @attestate/kiwistand put: Didn't add message to database becaus e of error:
// "Error: Wrongly formatted message: [{"instancePath":"","schemaPath":"#/type"
// ,"keyword":"type","params":{"type":"object"},"message":"must be object"}]"
//
// after changing the canonicalization of leaves. But the error is from the put
// function, I think where in production the cbor can be parsed into JSON, but
// here it see,s to be a string (confusingly)
test("if sync of signed messages work over the network", async (t) => {
  const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
  const privateKey =
    "0xad54bdeade5537fb0a553190159783e45d02d316a992db05cbed606d3ca36b39";
  const signer = new Wallet(privateKey);
  t.is(signer.address, address);

  const localhost = "127.0.0.1";
  const text = "hello world";
  const href = "https://example.com";
  const type = "amplify";
  const timestamp = 1676559616;
  const message = create(text, href, type, timestamp);
  const signedMessage = await sign(signer, message, EIP712_MESSAGE);
  t.deepEqual(signedMessage, {
    ...message,
    signature:
      "0x1df128dfe1f86df4e20ecc6ebbd586e0ab56e3fc8d0db9210422c3c765633ad8793af68aa232cf39cc3f75ea18f03260258f7276c2e0d555f98e1cf16672dd201c",
  });

  process.env.AUTO_SYNC = "false";
  process.env.DATA_DIR = "dbtestA";
  process.env.PORT = "53462";
  process.env.IS_BOOTSTRAP_NODE = "true";
  process.env.USE_EPHEMERAL_ID = "false";
  const config1 = (await import(`../src/config.mjs?${randInt()}`)).default;
  config1.peerDiscovery = [
    bootstrap({
      list: [
        `/ip4/${localhost}/tcp/${process.env.DEFAULT_PORT}/p2p/bafzaajiiaijccazrvdlmhms6g7cr6lurqp5aih27agldbplnh77i5oxn74sjm7773q`,
      ],
    }),
  ];

  const trieA = await store.create();
  const libp2p = null;
  const allowlist = [address];
  await store.add(trieA, signedMessage, libp2p, allowlist);

  const node1 = await start(config1);
  await subscribe(
    node1,
    handlers.node,
    handlers.connection,
    handlers.protocol,
    [],
    trieA
  );

  process.env.DATA_DIR = "dbtestB";
  const path = resolve(process.env.DATA_DIR, "call-block-logs-load");
  const db = database.open(path);
  const name = database.order("call-block-logs");
  const subdb = db.openDB(name);
  await subdb.put(["abc"], address);

  process.env.PORT = "0";
  process.env.IS_BOOTSTRAP_NODE = "false";
  process.env.USE_EPHEMERAL_ID = "true";
  const config2 = (await import(`../src/config.mjs?${randInt()}`)).default;
  config2.peerDiscovery = [
    bootstrap({
      list: [
        `/ip4/${localhost}/tcp/${process.env.DEFAULT_PORT}/p2p/bafzaajiiaijccazrvdlmhms6g7cr6lurqp5aih27agldbplnh77i5oxn74sjm7773q`,
      ],
    }),
  ];
  const trieB = await store.create();
  t.notDeepEqual(trieA.root(), trieB.root());

  const node2 = await start(config2);
  await subscribe(
    node2,
    handlers.node,
    handlers.connection,
    handlers.protocol,
    [],
    trieB
  );

  const addrs = node2.getMultiaddrs();
  await node1.goblin.initiate(addrs[0]);
  t.deepEqual(trieA.root(), trieB.root());

  await node1.stop();
  await node2.stop();
  await rm("dbtestA", { recursive: true });
  await rm("dbtestB", { recursive: true });
});

test.skip("if sync of simple messages work over the network", async (t) => {
  process.env.AUTO_SYNC = "false";
  process.env.DATA_DIR = "dbtestA";
  process.env.PORT = "53462";
  process.env.IS_BOOTSTRAP_NODE = "true";
  process.env.USE_EPHEMERAL_ID = "false";
  const config1 = (await import(`../src/config.mjs?${randInt()}`)).default;
  const trieA = await store.create();
  await trieA.put(Buffer.from("0100", "hex"), Buffer.from("A", "utf8"));
  await trieA.put(Buffer.from("0101", "hex"), Buffer.from("C", "utf8"));
  await trieA.put(Buffer.from("0200", "hex"), Buffer.from("D", "utf8"));

  const node1 = await start(config1);
  await subscribe(
    node1,
    handlers.node,
    handlers.connection,
    {
      ...handlers.protocol,
      ...{ [`/${leaves.id}/${leaves.version}`]: simpleHandleLeaves },
    },
    [],
    trieA
  );

  process.env.DATA_DIR = "dbtestB";
  process.env.PORT = "0";
  process.env.IS_BOOTSTRAP_NODE = "false";
  process.env.USE_EPHEMERAL_ID = "true";
  const config2 = (await import(`../src/config.mjs?${randInt()}`)).default;
  const trieB = await store.create();
  t.notDeepEqual(trieA.root(), trieB.root());

  const node2 = await start(config2);
  await subscribe(
    node2,
    handlers.node,
    handlers.connection,
    {
      ...handlers.protocol,
      ...{ [`/${leaves.id}/${leaves.version}`]: simpleHandleLeaves },
    },
    [],
    trieB
  );

  const addrs = node2.getMultiaddrs();
  await node1.goblin.initiate(addrs[0]);
  t.deepEqual(trieA.root(), trieB.root());

  await node1.stop();
  await node2.stop();
  await rm("dbtestA", { recursive: true });
  await rm("dbtestB", { recursive: true });
});

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

test.skip("if nodes can be bootstrapped using from and to wire", async (t) => {
  let node1, node2;
  const message = { hello: "world" };
  const actual = await new Promise(async (resolve, reject) => {
    process.env.AUTO_SYNC = "false";
    process.env.PORT = "53462";
    process.env.BIND_ADDRESS_V4 = "127.0.0.1";
    process.env.IS_BOOTSTRAP_NODE = "true";
    process.env.USE_EPHEMERAL_ID = "false";
    const config1 = (await import(`../src/config.mjs?${randInt()}`)).default;

    const localhost = "127.0.0.1";
    config1.peerDiscovery = [
      bootstrap({
        list: [
          `/ip4/${localhost}/tcp/${process.env.DEFAULT_PORT}/p2p/bafzaajiiaijccazrvdlmhms6g7cr6lurqp5aih27agldbplnh77i5oxn74sjm7773q`,
        ],
      }),
    ];

    const nodeHandler1 = {};
    const connHandler1 = {};
    const protoHandler1 = {
      "/test/1.0.0": async ({ stream }) => {
        const result = await fromWire(stream);
        resolve(result);
      },
    };
    const topics = [];
    const trie = await store.create();

    node1 = await start(config1);
    await subscribe(
      node1,
      nodeHandler1,
      connHandler1,
      protoHandler1,
      topics,
      trie
    );

    process.env.PORT = "0";
    process.env.BIND_ADDRESS_V4 = "127.0.0.1";
    process.env.IS_BOOTSTRAP_NODE = "false";
    process.env.USE_EPHEMERAL_ID = "true";
    const config2 = (await import(`../src/config.mjs?${randInt()}`)).default;

    config2.peerDiscovery = [
      bootstrap({
        list: [
          `/ip4/${localhost}/tcp/${process.env.DEFAULT_PORT}/p2p/bafzaajiiaijccazrvdlmhms6g7cr6lurqp5aih27agldbplnh77i5oxn74sjm7773q`,
        ],
      }),
    ];

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
    const protoHandler2 = {};
    node2 = await start(config2);
    await subscribe(
      node2,
      nodeHandler2,
      connHandler2,
      protoHandler2,
      topics,
      trie
    );
  });
  t.deepEqual(actual, [message]);
  await node1.stop();
  await node2.stop();
});

test.skip("if nodes can only be bootstrapped", async (t) => {
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
            const buf = Buffer.from(msg.subarray());
            const data = decode(buf);
            resolve(data);
          }
        });
      },
    };
    const topics = [];
    const trie = await store.create();

    node1 = await start(config1);
    await subscribe(
      node1,
      nodeHandler1,
      connHandler1,
      protoHandler1,
      topics,
      trie
    );

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
        await pipe([encode(message)], lp.encode(), stream.sink);
      },
    };
    const connHandler2 = {};
    const protoHandler2 = {};
    node2 = await start(config2);
    await subscribe(
      node2,
      nodeHandler2,
      connHandler2,
      protoHandler2,
      topics,
      trie
    );
  });
  t.deepEqual(actual, message);
  await node1.stop();
  await node2.stop();
});

// TODO: This tests seems to have been broken for some time now. Fix it.
test.skip("if third node can be discovered from bootstrap and newly online node", async (t) => {
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
    const trie = await store.create();

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

    const topic = "testtopic";
    node1 = await start(config1);
    await subscribe(
      node1,
      nodeHandler1,
      connHandler1,
      protoHandler1,
      [{ name: topic }],
      trie
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
    node2 = await start(config2);
    await subscribe(
      node2,
      nodeHandler2,
      connHandler2,
      protoHandler2,
      [{ name: topic }],
      trie
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
    node3 = await start(config3);
    await subscribe(
      node3,
      nodeHandler3,
      connHandler3,
      protoHandler3,
      [{ name: topic }],
      trie
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
});
