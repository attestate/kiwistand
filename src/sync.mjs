// @format
import { setTimeout } from "timers/promises";

import * as lp from "it-length-prefixed";
import map from "it-map";
import all from "it-all";
import { LeafNode, decodeNode } from "@ethereumjs/trie";
import { encode, decode } from "cbor-x";
import Ajv from "ajv";

import log from "./logger.mjs";
import * as store from "./store.mjs";
import * as roots from "./topics/roots.mjs";
import * as registry from "./chainstate/registry.mjs";
import { SCHEMATA, PROTOCOL } from "./constants.mjs";
import { elog } from "./utils.mjs";

const { levels, leaves } = PROTOCOL.protocols;
const ajv = new Ajv();
const comparisonValidator = ajv.compile(SCHEMATA.comparison);

export function syncPeerFactory() {
  // NOTE: We open a closure here for "peer" and the user calls the
  // syncPeerFactory such that for the functions, peer is always defined within
  // the factory's scope. This allows us to pass around state but having the
  // code remain fairly functional and classless.
  let peer;
  function isValid(newPeer) {
    const syncPeer = get();

    if (!syncPeer) {
      set(newPeer);
      return {
        result: true,
        syncPeer: newPeer,
        newPeer,
      };
    }

    if (syncPeer.equals(newPeer)) {
      return {
        result: true,
        syncPeer,
        newPeer,
      };
    }

    return {
      result: false,
      syncPeer,
      newPeer,
    };
  }

  function set(peerId) {
    if (!peerId) {
      log("Unsetting global peer");
    } else {
      log(`Setting global peer: "${peerId}"`);
    }
    peer = peerId;
  }

  function get() {
    return peer;
  }
  return {
    get,
    set,
    isValid,
  };
}

export async function toWire(message, sink) {
  const buf = encode(message);
  const encoded = lp.encode()([buf]);
  return await sink(encoded);
}

// NOTE: it-length-prefixed's default configuration will throw errors for
// messages that are longer than 4MB, so we're doubling it here.
// NOTE: 2024-09-09, we're doubling it again
// NOTE: 2025-01-03, doubling it once more to 32MB
export const maxDataLength = 1024 * 1024 * 4 * 2 * 2 * 2;
export async function fromWire(source) {
  const decoded = lp.decode({ maxDataLength })(source);
  const process = async (_source) => {
    const results = await map(_source, (message) => {
      if (!message) return;
      const buf = Buffer.from(message.subarray());
      const decoded = decode(buf);
      return decoded;
    });
    return await all(results);
  };
  return await process(decoded);
}

export function handleDiscovery(evt) {
  log(`discovered ${evt.detail.id.toString()}`);
}

// NOTE: Returns a `stop` function that ends the advertisement loop (used in
// tests, where an endless loop would keep publishing after assertions ran).
export function advertise(trie, node, timeout) {
  let stopped = false;
  async function loop() {
    // NOTE: We initially didn't send the same root twice, given that it
    // increases the gossiped messages. However, this lead to cases where two
    // nodes wouldn't synchronize (for unknown reasons).
    //
    // NOTE: This used to be `return await loop()` (async recursion), which
    // grows an ever longer promise chain over the process lifetime. A plain
    // loop does the same without retaining previous iterations.
    while (!stopped) {
      const rootMsg = encode({ root: trie.root().toString("hex") });
      log(
        `Advertising new root to peers: "${roots.name}" and message: "${rootMsg}"`,
      );
      node.pubsub.publish(roots.name, rootMsg);
      await setTimeout(timeout);
    }
  }

  loop();
  return () => {
    stopped = true;
  };
}

// TODO: serialize and deserialize should be mappable functions
export function serialize(nodes) {
  for (let node of nodes) {
    node.key = node.key.toString("hex");
    node.hash = node.hash.toString("hex");
    if (node.node) {
      // TODO: We definitely have to fix the (de-)serialization...
      node.node = node.node.serialize().toString("hex");
    }
  }
  return nodes;
}

export function deserialize(nodes) {
  if (!nodes && !Array.isArray(nodes)) {
    throw new Error(`deserialize: Didn't encounter array of nodes "${nodes}"`);
  }
  for (let node of nodes) {
    node.key = Buffer.from(node.key, "hex");
    node.hash = Buffer.from(node.hash, "hex");
    if (node.node) {
      // TODO: We definitely have to fix the (de-)serialization...
      node.node = decodeNode(Buffer.from(node.node, "hex"));
    }
  }
  return nodes;
}

export function send(libp2p) {
  return async (peerId, protocol, message) => {
    const { sink, source } = await libp2p.dialProtocol(peerId, protocol);
    await toWire(message, sink);
    const [results] = await fromWire(source);
    return results;
  };
}

function timestampOf(leaf) {
  try {
    const { timestamp } = JSON.parse(decode(leaf.node.value()));
    return Number.isFinite(timestamp) ? timestamp : Infinity;
  } catch (err) {
    return Infinity;
  }
}

// NOTE: Leaves are sent in chunks so that a large difference (e.g. a fresh
// node) doesn't produce a single wire message above `maxDataLength`.
export const leavesChunkSize = 500;
export async function sendLeaves(innerSend, peerId, missingLeaves) {
  // NOTE: The receiving node rejects a comment whose parent it doesn't have
  // yet, and a comment's timestamp is always greater than its parent's. So
  // sending all leaves in ascending timestamp order ensures that parents
  // arrive before their children, also across chunks.
  const sorted = missingLeaves
    .map((leaf) => ({ leaf, timestamp: timestampOf(leaf) }))
    .sort((a, b) =>
      a.timestamp === b.timestamp ? 0 : a.timestamp < b.timestamp ? -1 : 1,
    )
    .map(({ leaf }) => leaf);

  log(`Sending "${sorted.length}" missing leaves to peer node`);
  for (let i = 0; i < sorted.length; i += leavesChunkSize) {
    const chunk = sorted.slice(i, i + leavesChunkSize);
    await innerSend(
      peerId,
      `/${leaves.id}/${leaves.version}`,
      serialize(chunk),
    );
  }
}

// NOTE: Missing leaves used to be sent to the peer level by level, right after
// each level's comparison. But a comment and its parent are generally at
// different depths of the trie (the position depends on the key, not on the
// thread structure), and the peer rejects a comment whose parent it doesn't
// have yet. So whenever a comment sat at a shallower level than its (also
// missing) parent, it got dropped and needed another full sync round - one
// round per level of comment nesting. We hence collect the missing leaves of
// all levels and send them, sorted by timestamp, once the descent is done.
export async function initiate(
  trie, // is ideally an immutable copy of the system's trie.
  peerId,
  exclude = [],
  level = 0,
  innerSend,
  peerFab,
) {
  const pending = { leaves: [] };
  try {
    return await initiateLevel(
      trie,
      peerId,
      exclude,
      level,
      innerSend,
      peerFab,
      pending,
    );
  } finally {
    // NOTE: If the descent was aborted midway (e.g. an invalid response at a
    // deeper level), we still hand over the leaves we already know are
    // missing, as the level-by-level sending did before.
    if (pending.leaves.length > 0) {
      try {
        await sendLeaves(innerSend, peerId, pending.leaves);
      } catch (err) {
        elog(err, "initiate: Failed while sending leaves after abort");
      }
    }
  }
}

async function initiateLevel(
  trie,
  peerId,
  exclude,
  level,
  innerSend,
  peerFab,
  pending,
) {
  const lastSyncPeer = peerFab.get();
  if (lastSyncPeer && lastSyncPeer.equals(peerId) && level === 0) {
    // NOTE: There can be cases where a sync takes long and some process might
    // trigger a second sync between two nodes. This case, we are catching
    // and ending here.
    log(
      "initiate: Caught the two same nodes attempting to start a second sync on level=0 and shutting it down.",
    );
    return;
  }
  const { result, syncPeer, newPeer } = peerFab.isValid(peerId);
  if (!result) {
    log(
      `initiate: Currently syncing with "${syncPeer}" but tried initiating with "${newPeer}". Aborting`,
    );
    // NOTE: We are NOT unsetting the peerFab syncPeer here as that'd overwrite
    // the current peer (which crucially must not be overwritten for the
    // on-going sync to continue taking place).
    return;
  }

  log(
    `Initiating sync for peerId: "${peerId}" and level "${level}" and root "${trie
      .root()
      .toString("hex")}"`,
  );

  let remotes;
  try {
    remotes = await store.descend(trie, level, exclude);
  } catch (err) {
    elog(err, "initiate: failed descending and aborting.");
    peerFab.set();
    return;
  }

  if (remotes.length === 0 && pending.leaves.length > 0) {
    // NOTE: We send the leaves before the final (empty) levels message, as the
    // latter makes the peer end the sync.
    const missingLeaves = pending.leaves;
    pending.leaves = [];
    try {
      await sendLeaves(innerSend, peerId, missingLeaves);
    } catch (err) {
      elog(err, "initiate: Failed while sending leaves");
      peerFab.set();
      return;
    }
  }

  let response;
  try {
    response = await innerSend(
      peerId,
      `/${levels.id}/${levels.version}`,
      serialize(remotes),
    );
  } catch (err) {
    elog(err, "initiate: error when sending levels");
    peerFab.set();
    return;
  }

  if (remotes.length === 0) {
    log(
      `Ending initiate on level: "${level}" with root: "${trie
        .root()
        .toString("hex")}"`,
    );
    peerFab.set();
    return;
  }

  let isValidResponse;
  try {
    isValidResponse = comparisonValidator(response);
  } catch (err) {
    elog(
      err,
      "initiate: response of received levels comparison was schema-invalid",
    );
    peerFab.set();
    return;
  }

  if (!isValidResponse) {
    log(
      `Wrongly formatted comparison message: ${JSON.stringify(
        comparisonValidator.errors,
      )}. Instead got "${JSON.stringify(response)}". Aborting initiate.`,
    );
    peerFab.set();
    return;
  }

  let missing;
  try {
    missing = deserialize(response.missing);
  } catch (err) {
    elog(err, "initiate: deserializing response to parse 'missing' failed");
    peerFab.set();
    return;
  }
  missing = missing.filter(({ node }) => node instanceof LeafNode);

  pending.leaves.push(...missing);

  let allMatches = [...exclude];
  if (response.match && response.match.length !== 0) {
    let matches;
    try {
      matches = deserialize(response.match);
    } catch (err) {
      elog(err, "initiate: deserializing 'matches' failed");
      peerFab.set();
      return;
    }
    allMatches = [...allMatches, ...matches.map(({ hash }) => hash)];
  }
  return await initiateLevel(
    trie,
    peerId,
    allMatches,
    level + 1,
    innerSend,
    peerFab,
    pending,
  );
}

export async function put(trie, message, delegations) {
  let missing;
  try {
    missing = deserialize(message);
  } catch (err) {
    // TODO: There should be a timeout when levels are sent, that if there's no
    // follow up, then the peerFab is reset. Actually, it'd be great if the pee
    log(`put: error deserializing message: "${message}", ${err.toString()}`);
    throw err;
  }

  // NOTE: We first decode all received leaves and only then add them to the
  // store. A single undecodable leaf used to `break` out of the loop (and an
  // unparsable one used to `throw`), which silently dropped every leaf that
  // came after it in the batch.
  const objs = [];
  for (const { node } of missing) {
    let value;
    try {
      value = decode(node.value());
    } catch (err) {
      elog(err, `put: can't decode node value "${node.value()}"`);
      continue;
    }

    let obj;
    try {
      obj = JSON.parse(value);
    } catch (err) {
      elog(err, `put: Can't JSON-parse value "${value}"`);
      continue;
    }
    objs.push(obj);
  }

  // NOTE: Leaves arrive in trie order, i.e. ordered by their key's nibbles as
  // found by the trie walk, and not in causal order. But `store.add` rejects
  // a comment whose parent (story or comment) isn't in the trie yet. So when a
  // comment and its parent were part of the same batch and the comment came
  // first, the comment was dropped and only re-sent in a later sync round
  // (one extra round per level of comment nesting). A comment's timestamp is
  // enforced to be strictly greater than its parent's, so adding the messages
  // in ascending timestamp order guarantees parents are stored first.
  objs.sort((a, b) => {
    const tsA = Number.isFinite(a?.timestamp) ? a.timestamp : Infinity;
    const tsB = Number.isFinite(b?.timestamp) ? b.timestamp : Infinity;
    if (tsA === tsB) return 0;
    return tsA < tsB ? -1 : 1;
  });

  for (const obj of objs) {
    const libp2p = null;
    const synching = true;
    try {
      await store.add(trie, obj, libp2p, delegations, synching);
      log(`Adding to database value (as JSON)`);
    } catch (err) {
      // NOTE: We're not bubbling the error up here because we want to be
      // tolerant as to the errors that store.add sends (e.g. duplicate errors
      // may be tolerable in the consensus).
      elog(err, "put: Didn't add message to database");
    }
  }
}

// TODO: We must validate the incoming remotes using a JSON schema.
// TODO: It's very easy to confused this method with the one at store (it
// happened to me). We must rename it.
export async function compare(trie, message) {
  let remotes;
  try {
    remotes = deserialize(message);
  } catch (err) {
    log(
      `compare: error deserializing message: "${message}", ${err.toString()}`,
    );
    throw err;
  }

  if (remotes && Array.isArray(remotes) && remotes.length === 0) {
    // NOTE: This may happen when there is nothing to compare anymore.
    throw new Error("Received empty list of levels.");
  }

  const { missing, mismatch, match } = await store.compare(trie, remotes);
  return {
    missing: serialize(missing),
    mismatch: serialize(mismatch),
    match: serialize(match),
  };
}

export function receive(peerFab, trie, expectResponse, handler) {
  return async ({ connection, stream }) => {
    let message;
    try {
      [message] = await fromWire(stream.source);
    } catch (err) {
      elog(err, "receive: error in fromWire");
      peerFab.set();
      try {
        await stream.close(); // Properly await the stream close
      } catch (closeErr) {
        elog(closeErr, "receive: error closing stream after fromWire error");
      }
      return;
    }

    let response;
    try {
      response = await handler(message, connection.remotePeer);
    } catch (err) {
      elog(
        err,
        `receive: unexpected error in handler with message "${JSON.stringify(
          message,
        )}"`,
      );
      peerFab.set();
      try {
        await stream.close();
      } catch (closeErr) {
        elog(closeErr, "receive: unexpected error closing stream");
      }
      return;
    }

    if (expectResponse && !response) {
      log(
        "receive: Failed to handle response from remote. Can't generate answer, closing stream.",
      );
      peerFab.set();
      try {
        await stream.close();
      } catch (closeErr) {
        elog(closeErr, "receive: unexpected error closing stream");
      }
      return;
    }
    try {
      await toWire(response, stream.sink);
    } catch (err) {
      log(`receive: Failed to respond: ${err.stack}`);
      peerFab.set();
      return stream.close();
    }
  };
}

export function handleLevels(trie, peerFab) {
  const expectResponse = true;
  return receive(peerFab, trie, expectResponse, async (message, peer) => {
    const { result, syncPeer, newPeer } = peerFab.isValid(peer);
    if (!result) {
      log(
        `handle levels: Currently syncing with "${syncPeer}" but received levels from "${newPeer}". Aborting`,
      );
      return;
    }

    let comparisons;
    try {
      log("Received levels and comparing them");
      comparisons = await compare(trie, message);
    } catch (err) {
      elog(err, "handleLevels: error in compare, aborting");
      peerFab.set();
      return;
    }

    return comparisons;
  });
}

export function handleLeaves(trie, peerFab) {
  const expectResponse = false;
  return receive(peerFab, trie, expectResponse, async (message, peer) => {
    const { result, syncPeer, newPeer } = peerFab.isValid(peer);
    if (!result) {
      log(
        `handle leaves: Currently syncing with "${syncPeer}" but received leaves from "${newPeer}". Aborting`,
      );
      return;
    }

    log("handleLeaves: Received leaves and storing them in db");

    try {
      // NOTE: We're adding multiple statements here to the try catch
      // because in each of their failure, we want to abort writing into
      // the databases.
      const delegations = await registry.delegations();
      await put(trie, message, delegations);
    } catch (err) {
      elog(err, "handleLeaves: Unexpected error");
      peerFab.set();
    }

    peerFab.set();
  });
}

export function handleConnection(evt) {
  log(`connected ${evt.detail.remotePeer.toString()}`);
}

export function handleDisconnection(evt) {
  log(`disconnected ${evt.detail.remotePeer.toString()}`);
}
