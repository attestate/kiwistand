// @format
import { env } from "process";
import { rm } from "fs/promises";

import test from "ava";
import { pipe } from "it-pipe";
import { pushable } from "it-pushable";
import * as lp from "it-length-prefixed";

import all from "it-all";
import { encode, decode } from "cbor-x";

import {
  deserialize,
  compare,
  initiate,
  fromWire,
  toWire,
  advertise,
  syncPeerFactory,
} from "../src/sync.mjs";
import { bootstrap } from "../src/id.mjs";
import * as store from "../src/store.mjs";
import log from "../src/logger.mjs";
import { PROTOCOL } from "../src/constants.mjs";

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

test("initiate should not crash when innerSend returns an undefined missing field", async (t) => {
  const mockPeerFab = {
    isValid: () => ({
      result: true,
      syncPeer: "syncPeer",
      newPeer: "newPeer",
    }),
    set: () => {},
    get: () => {},
  };

  const mockInnerSend = () => {
    return {
      missing: undefined,
    };
  };

  const trie = await store.create();
  const peerId = "testPeerId";
  const exclude = [];
  const level = 0;

  await initiate(trie, peerId, exclude, level, mockInnerSend, mockPeerFab);

  t.pass();
});

test("advertising root periodically", async (t) => {
  env.DATA_DIR = "dbtestA";
  const trie = await store.create();
  t.plan(3);
  let publishCalled = false;
  const node = {
    pubsub: {
      publish: (name, message) => {
        publishCalled = true;
        t.truthy(name);
        const expected = encode({ root: trie.root().toString("hex") });
        t.deepEqual(message, expected);
      },
    },
  };
  const timeout = 10;
  await advertise(trie, node, timeout);
  t.true(publishCalled);

  await rm("dbtestA", { recursive: true });
});

test.serial(
  "ending syncing early when trying in other direction",
  async (t) => {
    env.DATA_DIR = "dbtestA";
    const trieA = await store.create();

    env.DATA_DIR = "dbtestB";
    const trieB = await store.create();
    await trieB.put(Buffer.from("0100", "hex"), Buffer.from("A", "utf8"));
    await trieB.put(Buffer.from("0101", "hex"), Buffer.from("C", "utf8"));
    await trieB.put(Buffer.from("0200", "hex"), Buffer.from("D", "utf8"));

    t.notDeepEqual(trieA.root(), trieB.root());
    const root = trieB.root();
    trieB.checkpoint();
    t.true(trieB.hasCheckpoints());

    const { levels, leaves } = PROTOCOL.protocols;
    const sendMock = async (peerId, protocol, message) => {
      if (protocol === `/${levels.id}/${levels.version}`) {
        return await compare(trieB, message);
      } else if (protocol === `/${leaves.id}/${leaves.version}`) {
        return await simplePut(trieB, message);
      }
    };

    const peerIdA = await bootstrap();
    const level = 0;
    const exclude = [];
    const peerFab = syncPeerFactory();
    await initiate(trieA, peerIdA, exclude, level, sendMock, peerFab);

    await trieB.commit();
    t.false(trieA.hasCheckpoints());
    t.notDeepEqual(trieA.root(), trieB.root());

    await rm("dbtestA", { recursive: true });
    await rm("dbtestB", { recursive: true });
  }
);

test.serial("syncing a partial trie", async (t) => {
  env.DATA_DIR = "dbtestA";
  const trieA = await store.create();
  await trieA.put(Buffer.from("0100", "hex"), Buffer.from("A", "utf8"));
  await trieA.put(Buffer.from("0101", "hex"), Buffer.from("C", "utf8"));
  await trieA.put(Buffer.from("0200", "hex"), Buffer.from("D", "utf8"));

  env.DATA_DIR = "dbtestB";
  const trieB = await store.create();
  await trieB.put(Buffer.from("0101", "hex"), Buffer.from("C", "utf8"));
  await trieB.put(Buffer.from("0200", "hex"), Buffer.from("D", "utf8"));

  t.notDeepEqual(trieA.root(), trieB.root());
  const root = trieB.root();
  trieB.checkpoint();
  t.true(trieB.hasCheckpoints());

  const { levels, leaves } = PROTOCOL.protocols;
  const sendMock = async (peerId, protocol, message) => {
    if (protocol === `/${levels.id}/${levels.version}`) {
      return await compare(trieB, message);
    } else if (protocol === `/${leaves.id}/${leaves.version}`) {
      return await simplePut(trieB, message);
    }
  };

  const peerIdA = await bootstrap();
  const level = 0;
  const exclude = [];
  const peerFab = syncPeerFactory();
  await initiate(trieA, peerIdA, exclude, level, sendMock, peerFab);

  await trieB.commit();
  t.false(trieA.hasCheckpoints());
  t.notDeepEqual(trieB.root(), root);
  t.deepEqual(trieA.root(), trieB.root());

  await rm("dbtestA", { recursive: true });
  await rm("dbtestB", { recursive: true });
});

test.serial("syncing an empty trie", async (t) => {
  env.DATA_DIR = "dbtestA";
  const trieA = await store.create();
  await trieA.put(Buffer.from("0100", "hex"), Buffer.from("A", "utf8"));
  await trieA.put(Buffer.from("0101", "hex"), Buffer.from("C", "utf8"));
  await trieA.put(Buffer.from("0200", "hex"), Buffer.from("D", "utf8"));

  env.DATA_DIR = "dbtestB";
  const trieB = await store.create();
  t.notDeepEqual(trieA.root(), trieB.root());
  const root = trieB.root();
  trieB.checkpoint();
  t.true(trieB.hasCheckpoints());

  const { levels, leaves } = PROTOCOL.protocols;
  const sendMock = async (peerId, protocol, message) => {
    if (protocol === `/${levels.id}/${levels.version}`) {
      return await compare(trieB, message);
    } else if (protocol === `/${leaves.id}/${leaves.version}`) {
      return await simplePut(trieB, message);
    }
  };

  const peerIdA = await bootstrap();
  const level = 0;
  const exclude = [];
  const peerFab = syncPeerFactory();
  await initiate(trieA, peerIdA, exclude, level, sendMock, peerFab);

  await trieB.commit();
  t.false(trieA.hasCheckpoints());
  t.notDeepEqual(trieB.root(), root);
  t.deepEqual(trieA.root(), trieB.root());

  await rm("dbtestA", { recursive: true });
  await rm("dbtestB", { recursive: true });
});

test("serializing into wire", async (t) => {
  t.plan(1);
  const message = { hello: "world" };
  const sink = async (source) => {
    const messages = await all(source);
    const sMessages = await pipe(messages, lp.decode(), async (source) => {
      const [msg] = await all(source);
      const actual = decode(Buffer.from(msg.subarray()));
      t.deepEqual(actual, message);
    });
  };

  await toWire(message, sink);
});

test("serializing from wire", async (t) => {
  t.plan(1);
  const message = { hello: "world" };
  const source = pushable();

  const buf = encode(message);
  const stream = await pipe([buf], lp.encode());

  const actual = await fromWire(stream);
  t.deepEqual(actual, [message]);
});
