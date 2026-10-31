// @format
import { env } from "process";
import { rm } from "fs/promises";

import test from "ava";
import { pipe } from "it-pipe";
import { pushable } from "it-pushable";
import * as lp from "it-length-prefixed";
import { createLibp2p } from "libp2p";
import { tcp } from "@libp2p/tcp";
import { noise } from "@chainsafe/libp2p-noise";
import { mplex } from "@libp2p/mplex";

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
  chunkList,
  maxMessageBytes,
  send,
  handleLevels,
  receive,
  read,
  streamLimits,
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
  // NOTE: The first publish happens synchronously; we stop the loop right
  // away so that it can't publish again (and exceed t.plan) during teardown.
  const stop = advertise(trie, node, timeout);
  stop();
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

test("fromWire reads only the first frame of an endless source", async (t) => {
  const message = { hello: "world" };
  const frame = await all(lp.encode()([encode(message)]));
  let yielded = 0;
  let returned = false;
  async function* endless() {
    try {
      while (true) {
        yielded++;
        yield* frame;
      }
    } finally {
      returned = true;
    }
  }

  const actual = await fromWire(endless());
  t.deepEqual(actual, [message]);
  t.true(yielded < 3);
  t.true(returned);
});

test("fromWire returns an empty list for an empty source", async (t) => {
  const actual = await fromWire([]);
  t.deepEqual(actual, []);
});

// A peer declares a big frame, sends all but its last byte and stalls.
async function stalledStream() {
  const parts = await all(lp.encode()([new Uint8Array(1024 * 1024)]));
  const frame = Buffer.concat(parts.map((part) => part.subarray()));
  const stream = { aborted: null, closed: false };
  stream.abort = (err) => {
    stream.aborted = err;
  };
  stream.close = async () => {
    stream.closed = true;
  };
  stream.source = (async function* () {
    yield frame.subarray(0, frame.length - 1);
    await new Promise(() => {});
  })();
  return stream;
}

test("read aborts a stream that stalls inside a frame", async (t) => {
  const stream = await stalledStream();
  const timeout = 50;
  await t.throwsAsync(read(stream, timeout), { message: /no frame within/ });
  t.truthy(stream.aborted);
});

test("receive gives up on a stalled stream and resets the sync peer", async (t) => {
  const stream = await stalledStream();
  const peerFab = syncPeerFactory();
  peerFab.set({ equals: () => false });
  let handled = false;
  const handler = async () => {
    handled = true;
  };
  const timeout = 50;
  const connection = { remotePeer: null };
  await receive(peerFab, null, false, handler, timeout)({ connection, stream });
  t.false(handled);
  t.truthy(stream.aborted);
  t.is(peerFab.get(), undefined);
});

test("chunkList stays under the byte budget and keeps order", (t) => {
  const items = Array.from({ length: 40 }, (_, i) => ({
    n: i,
    blob: "y".repeat(80),
  }));
  const maxBytes = 400;
  const chunks = chunkList(items, maxBytes);
  t.true(chunks.length > 1);
  t.deepEqual(
    chunks.flat().map((item) => item.n),
    items.map((item) => item.n),
  );
  for (const chunk of chunks) {
    const size = encode(chunk).length;
    if (chunk.length > 1) t.true(size <= maxBytes);
  }
});

// Two real libp2p nodes, both speaking the current (chunked) protocol.
// The trie is bigger than one frame, so a single leaves/levels message would
// have been the thing that used to force maxDataLength up.
test.serial("two nodes on the new protocol sync a trie bigger than one frame", async (t) => {
  t.is(PROTOCOL.protocols.leaves.version, "16.0.0");
  t.is(PROTOCOL.protocols.levels.version, "16.0.0");

  const dirA = "dbtestChunkA";
  const dirB = "dbtestChunkB";
  await rm(dirA, { recursive: true, force: true });
  await rm(dirB, { recursive: true, force: true });

  env.DATA_DIR = dirA;
  const trieA = await store.create();
  const value = Buffer.from("x".repeat(8000));
  const leafCount = 150;
  for (let i = 0; i < leafCount; i++) {
    const key = Buffer.from(i.toString(16).padStart(64, "0"), "hex");
    await trieA.put(key, value);
  }

  env.DATA_DIR = dirB;
  const trieB = await store.create();
  t.notDeepEqual(trieA.root(), trieB.root());

  const options = () => ({
    addresses: { listen: ["/ip4/127.0.0.1/tcp/0"] },
    transports: [tcp()],
    streamMuxers: [mplex()],
    connectionEncryption: [noise()],
  });
  const nodeA = await createLibp2p(options());
  const nodeB = await createLibp2p(options());
  await nodeA.start();
  await nodeB.start();

  const { levels, leaves } = PROTOCOL.protocols;
  const peerFabB = syncPeerFactory();
  await nodeB.handle(
    `/${levels.id}/${levels.version}`,
    handleLevels(trieB, peerFabB),
    streamLimits,
  );
  let leafFrames = 0;
  await nodeB.handle(
    `/${leaves.id}/${leaves.version}`,
    receive(peerFabB, trieB, false, async (message) => {
      leafFrames += 1;
      await simplePut(trieB, message);
    }),
    streamLimits,
  );

  const addr = nodeB.getMultiaddrs()[0];
  await nodeA.dial(addr);

  const frames = [];
  const innerSend = async (peerId, protocol, message) => {
    const bytes = encode(message).length;
    frames.push({ protocol, bytes, count: message.length });
    if (message.length > 1) t.true(bytes <= maxMessageBytes);
    return send(nodeA)(peerId, protocol, message);
  };

  try {
    await initiate(trieA, nodeB.peerId, [], 0, innerSend, syncPeerFactory());
    t.deepEqual(trieA.root(), trieB.root());
    t.true(leafFrames > 1, `expected several leaf frames, got ${leafFrames}`);
    const biggest = frames.reduce((max, frame) => Math.max(max, frame.bytes), 0);
    t.log(
      `frames=${frames.length} leafFrames=${leafFrames} biggest=${biggest} budget=${maxMessageBytes}`,
    );
    t.true(frames.length > leafFrames);
    t.true(biggest <= maxMessageBytes);
  } finally {
    await nodeA.stop();
    await nodeB.stop();
    await rm(dirA, { recursive: true, force: true });
    await rm(dirB, { recursive: true, force: true });
  }
});
