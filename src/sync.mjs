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

// One frame is at most 1 MiB. A level (and the missing leaves under it) used
// to go out as a single length-prefixed message, so the cap had to double
// every time the trie grew (4MB, then 8, 16, 32). Frames stay this size and
// the trie can grow without another bump. maxDataLength is only headroom for
// one frame: the length prefix, plus a comparison object that is slightly
// larger than the request it answers. A single node bigger than
// maxMessageBytes is still sent alone; it must fit under maxDataLength.
export const maxMessageBytes = 1024 * 1024;
export const maxDataLength = maxMessageBytes * 2;

// Split a list into chunks whose CBOR encoding stays within maxBytes.
// encode([item]) includes a one-element array header, so summing those
// lengths overestimates the real array and chunks land under the budget.
// A single item larger than maxBytes is emitted as its own chunk.
export function chunkList(items, maxBytes = maxMessageBytes) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const chunks = [];
  let current = [];
  let bytes = 0;
  for (const item of items) {
    const itemBytes = encode([item]).length;
    if (current.length > 0 && bytes + itemBytes > maxBytes) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(item);
    bytes += itemBytes;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

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

export async function initiate(
  trie, // is ideally an immutable copy of the system's trie.
  peerId,
  exclude = [],
  level = 0,
  innerSend,
  peerFab,
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
    remotes = serialize(await store.descend(trie, level, exclude));
  } catch (err) {
    elog(err, "initiate: failed descending and aborting.");
    peerFab.set();
    return;
  }

  const levelsProtocol = `/${levels.id}/${levels.version}`;
  const leavesProtocol = `/${leaves.id}/${leaves.version}`;

  // An empty level used to be sent once and then end the walk. chunkList
  // would drop it, so keep that send explicit.
  if (remotes.length === 0) {
    try {
      await innerSend(peerId, levelsProtocol, remotes);
    } catch (err) {
      elog(err, "initiate: error when sending levels");
      peerFab.set();
      return;
    }
    log(
      `Ending initiate on level: "${level}" with root: "${trie
        .root()
        .toString("hex")}"`,
    );
    peerFab.set();
    return;
  }

  const levelChunks = chunkList(remotes);
  log(
    `Sending level "${level}" (${remotes.length} nodes) in "${levelChunks.length}" frame(s)`,
  );

  // Same order as one message: compare each frame, keep the missing leaves,
  // then send those (themselves framed) before descending.
  const missingLeaves = [];
  let allMatches = [...exclude];

  for (const chunk of levelChunks) {
    let response;
    try {
      response = await innerSend(peerId, levelsProtocol, chunk);
    } catch (err) {
      elog(err, "initiate: error when sending levels");
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
    for (const entry of missing) {
      if (entry.node instanceof LeafNode) missingLeaves.push(entry);
    }

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
  }

  if (missingLeaves.length > 0) {
    const leafChunks = chunkList(serialize(missingLeaves));
    log(
      `Sending "${missingLeaves.length}" missing leaves in "${leafChunks.length}" frame(s)`,
    );
    for (const chunk of leafChunks) {
      try {
        await innerSend(peerId, leavesProtocol, chunk);
      } catch (err) {
        elog(err, "initiate: Failed while sending leaves");
        peerFab.set();
        return;
      }
    }
  }

  return await initiate(
    trie,
    peerId,
    allMatches,
    level + 1,
    innerSend,
    peerFab,
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

  for await (let { node, key } of missing) {
    let value;
    try {
      value = decode(node.value());
    } catch (err) {
      elog(err, `put: can't decode node value "${node.value()}"`);
      break;
      throw err;
    }

    let obj;
    try {
      obj = JSON.parse(value);
    } catch (err) {
      elog(err, `put: Can't JSON-parse value "${value}"`);
      throw err;
    }

    const libp2p = null;
    const synching = true;
    try {
      await store.add(
        trie,
        obj,
        libp2p,
        delegations,
        synching,
      );
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
