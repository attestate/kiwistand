// A kiwistand node in its own process, for test/commits_integration_test.mjs:
// its own DATA_DIR and CACHE_DIR (the parent sets them), a libp2p node that
// takes set reconciliation (levels and leaves) and commands over IPC.
import { mkdirSync } from "fs";

mkdirSync(process.env.DATA_DIR, { recursive: true });
mkdirSync(process.env.CACHE_DIR, { recursive: true });

const { createLibp2p } = await import("libp2p");
const { tcp } = await import("@libp2p/tcp");
const { noise } = await import("@chainsafe/libp2p-noise");
const { mplex } = await import("@libp2p/mplex");
const { multiaddr } = await import("@multiformats/multiaddr");
const cache = await import("../../src/cache.mjs");
const store = await import("../../src/store.mjs");
const registry = await import("../../src/chainstate/registry.mjs");
const commits = await import("../../src/commits.mjs");
const sequencer = await import("../../src/sequencer.mjs");
const sync = await import("../../src/sync.mjs");
const { PROTOCOL } = await import("../../src/constants.mjs");

cache.initializeLtCache();
cache.initializeCommunities();
cache.initializeMemberships();
cache.initializeDelegations();
cache.initializeCommits();
cache.initialize([]);
cache.initializeReactions();
await registry.initialize();
const trie = await store.create();

const node = await createLibp2p({
  addresses: { listen: ["/ip4/127.0.0.1/tcp/0"] },
  transports: [tcp()],
  streamMuxers: [mplex()],
  connectionEncryption: [noise()],
});
await node.start();
const { levels, leaves } = PROTOCOL.protocols;
const peerFab = sync.syncPeerFactory();
await node.handle(
  `/${levels.id}/${levels.version}`,
  sync.handleLevels(trie, peerFab),
  sync.streamLimits,
);
await node.handle(
  `/${leaves.id}/${leaves.version}`,
  sync.handleLeaves(trie, peerFab),
  sync.streamLimits,
);

const snapshot = process.env.TEST_SNAPSHOT_HASH;
async function refresh() {
  const added = await commits.refresh(trie, commits.client(), snapshot);
  if (added.length) await registry.reattribute();
  return commits.status();
}

const commands = {
  addr: () => node.getMultiaddrs()[0].toString(),
  add: async (messages) => {
    const errors = [];
    for (const message of messages) {
      try {
        await store.add(trie, message, null, await registry.delegations());
      } catch (err) {
        errors.push(err.message);
      }
    }
    return errors;
  },
  push: async (addr) => {
    const connection = await node.dial(multiaddr(addr));
    const peer = connection.remotePeer;
    await sync.initiate(
      trie,
      peer,
      [],
      0,
      sync.send(node),
      sync.syncPeerFactory(),
    );
    return trie.root().toString("hex");
  },
  refresh,
  commit: async () => {
    await refresh();
    const messages = await commits.held(trie);
    const commit = await sequencer.next(messages, commits.commits(), snapshot);
    const hash = await sequencer.send(commit);
    return { hash, status: await refresh() };
  },
  calldata: async (hash) => {
    const tx = await commits.client().getTransaction({ hash });
    return commits.decodeCommit(tx.input);
  },
  credited: (address) =>
    cache.getSubmissions(address, 50, 0, "new").map(({ href }) => href),
  // Swaps a stored message for another one without any checks, as a
  // dishonest node could.
  swap: async (index, message) => {
    const { toDigest } = await import("../../src/id.mjs");
    await trie.del(Buffer.from(index, "hex"));
    const { index: next, canonical } = toDigest(message);
    await trie.put(Buffer.from(next, "hex"), canonical);
    return next;
  },
};

process.on("message", async ({ id, command, args = [] }) => {
  try {
    process.send({ id, result: await commands[command](...args) });
  } catch (err) {
    process.send({ id, error: err.stack });
  }
});
process.send({ ready: true });
