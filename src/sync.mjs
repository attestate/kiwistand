// @format
import { setTimeout } from "timers/promises";

import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
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
  return await pipe([buf], lp.encode(), sink);
}

// NOTE: it-length-prefixed's default configuration will throw errors for
// messages that are longer than 4MB, so we're doubling it here.
// NOTE: 2024-09-09, we're doubling it again
export const maxDataLength = 1024 * 1024 * 4 * 2 * 2;
export async function fromWire(source) {
  return await pipe(source, lp.decode({ maxDataLength }), async (_source) => {
    const results = await map(_source, (message) => {
      if (!message) return;
      const buf = Buffer.from(message.subarray());
      const decoded = decode(buf);
      return decoded;
    });
    return await all(results);
  });
}

export function handleDiscovery(evt) {
  log(`discovered ${evt.detail.id.toString()}`);
}

export function advertise(trie, node, timeout) {
  let lastRoot;
  async function loop() {
    // NOTE: We initially didn't send the same root twice, given that it
    // increases the gossiped messages. However, this lead to cases where two
    // nodes wouldn't synchronize (for unknown reasons).
    //
    //if (lastRoot && Buffer.compare(lastRoot, trie.root()) === 0) {
    //  log(
    //    `Last root "${lastRoot.toString(
    //      "hex"
    //    )}" is equal to current root "${trie
    //      .root()
    //      .toString("hex")}", so advertisement is canceled`
    //  );
    //} else {
    const rootMsg = encode({ root: trie.root().toString("hex") });
    log(
      `Advertising new root to peers: "${roots.name}" and message: "${rootMsg}"`,
    );
    node.pubsub.publish(roots.name, rootMsg);
    //}

    lastRoot = trie.root();
    await setTimeout(timeout);
    return await loop();
  }

  loop();
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
    remotes = await store.descend(trie, level, exclude);
  } catch (err) {
    elog(err, "initiate: failed descending and aborting.");
    peerFab.set();
    return;
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

  if (missing.length > 0) {
    log(`Sending "${missing.length}" missing leaves to peer node`);
    try {
      await innerSend(
        peerId,
        `/${leaves.id}/${leaves.version}`,
        // TODO: This might go wrong and we might wanna try catch it separately.
        serialize(missing),
      );
    } catch (err) {
      elog(err, "initiate: Failed while sending leaves");
      peerFab.set();
      return;
    }
  }

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
  return await initiate(
    trie,
    peerId,
    allMatches,
    level + 1,
    innerSend,
    peerFab,
  );
}

export async function put(trie, message, allowlist, delegations, accounts) {
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
        allowlist,
        delegations,
        accounts,
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
    const [message] = await fromWire(stream.source);

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
      return stream.close();
    }

    if (expectResponse && !response) {
      log(
        "Failed to handle response from remote. Can't generate answer, closing stream.",
      );
      peerFab.set();
      return stream.close();
    }
    await toWire(response, stream.sink);
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

    if (!trie.hasCheckpoints()) trie.checkpoint();
    log("handleLeaves: Received leaves and storing them in db");

    try {
      // NOTE: We're adding multiple statements here to the try catch
      // because in each of their failure, we want to abort writing into
      // the databases.
      const allowlist = await registry.allowlist();
      const accounts = await registry.accounts();
      const delegations = await registry.delegations();
      await put(trie, message, allowlist, delegations, accounts);
    } catch (err) {
      elog(err, "handleLeaves: Unexpected error");
      await trie.revert();
      peerFab.set();
    }

    // NOTE: While there could be a strategy where we continuously stay in a
    // checkpoint the entire time when the synchronization is going one, this
    // seems detrimental to the mechanism, in that it introduces a high-stakes
    // operation towards the very end where after many minutes of back and
    // forth all data is being committed into the trie. So right now it seems
    // more robust if we hence open a checkpoint the first time new levels are
    // sent, and we close it by the time leaves are being received. While this
    // means that practically for every newly received leaf, the
    // synchronization starts over again, it sequentializes downloading the
    // leaves into many sub tasks which are more likely to succeed.
    await trie.commit();
    peerFab.set();
  });
}

export function handleConnection(evt) {
  log(`connected ${evt.detail.remotePeer.toString()}`);
}

export function handleDisconnection(evt) {
  log(`disconnected ${evt.detail.remotePeer.toString()}`);
}
