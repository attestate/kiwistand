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

export async function fromWire(source) {
  return await pipe(source, lp.decode(), async (_source) => {
    const results = await map(_source, (message) => {
      if (!message) return;
      const buf = Buffer.from(message.subarray());
      return decode(buf);
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
      `Advertising new root to peers: "${roots.name}" and message: "${rootMsg}"`
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
  trie, // must be checkpointed
  peerId,
  exclude = [],
  level = 0,
  innerSend,
  peerFab
) {
  const { result, syncPeer, newPeer } = peerFab.isValid(peerId);
  if (!result) {
    log(
      `initiate: Currently syncing with "${syncPeer}" but tried initiating with "${newPeer}". Aborting`
    );
    // NOTE: We are NOT unsetting the peerFab syncPeer here as that'd overwrite
    // the current peer (which crucially must not be overwritten for the
    // on-going sync to continue taking place).
    return;
  }

  log(
    `Initiating sync for peerId: "${peerId}" and level "${level}" and root "${trie
      .root()
      .toString("hex")}"`
  );
  const remotes = await store.descend(trie, level, exclude);

  if (remotes.length === 0) {
    log(
      `Ending initiate on level: "${level}" with root: "${trie
        .root()
        .toString("hex")}"`
    );
    peerFab.set();
    return;
  }
  const response = await innerSend(
    peerId,
    `/${levels.id}/${levels.version}`,
    serialize(remotes)
  );
  if (!comparisonValidator(response)) {
    log(
      `Wrongly formatted comparison message: ${JSON.stringify(
        comparisonValidator.errors
      )}. Instead got "${JSON.stringify(response)}". Aborting initiate.`
    );
    peerFab.set();
    return;
  }

  const missing = deserialize(response.missing).filter(
    ({ node }) => node instanceof LeafNode
  );
  if (missing.length > 0) {
    log("Sending missing leaves to peer node");
    try {
      await innerSend(
        peerId,
        `/${leaves.id}/${leaves.version}`,
        serialize(missing)
      );
    } catch (err) {
      log("Error sending leaves to peer");
      peerFab.set();
      throw err;
    }
  }

  const matches = deserialize(response.match).map((node) => node.hash);
  return await initiate(trie, peerId, matches, level + 1, innerSend, peerFab);
}

export async function put(trie, message) {
  const missing = deserialize(message);
  for await (let { node, key } of missing) {
    const value = decode(node.value());
    let obj;
    try {
      obj = JSON.parse(value);
    } catch (err) {
      log(
        `put: Couldn't JSON-parse message "${value}" to in trie: ${err.toString()}`
      );
      return;
    }

    const libp2p = null;
    const allowlist = await registry.allowlist();
    const synching = true;
    try {
      await store.add(trie, obj, libp2p, allowlist, true);
      log(`Adding to database value (as JSON) "${value}"`);
    } catch (err) {
      log(
        `put: Didn't add message to database because of error: "${err.toString()}"`
      );
    }
  }
}

// TODO: We must validate the incoming remotes using a JSON schema.
// TODO: It's very easy to confused this method with the one at store (it
// happened to me). We must rename it.
export async function compare(trie, message) {
  const { missing, mismatch, match } = await store.compare(
    trie,
    deserialize(message)
  );
  return {
    missing: serialize(missing),
    mismatch: serialize(mismatch),
    match: serialize(match),
  };
}

export function receive(handler) {
  return async ({ connection, stream }) => {
    const [message] = await fromWire(stream.source);
    log(`receiving message: "${JSON.stringify(message)}"`);
    const response = await handler(message, connection.remotePeer);

    if (!response) {
      log("Closing stream as response is missing");
      return stream.close();
    }
    log(`sending response: "${JSON.stringify(response)}"`);
    await toWire(response, stream.sink);
  };
}

export function handleLevels(trie, peerFab) {
  return receive(async (message, peer) => {
    const { result, syncPeer, newPeer } = peerFab.isValid(peer);
    if (!result) {
      log(
        `handle levels: Currently syncing with "${syncPeer}" but received levels from "${newPeer}". Aborting`
      );
      return;
    }

    log("Received levels and comparing them");
    return await compare(trie, message);
  });
}

export function handleLeaves(trie, peerFab) {
  return receive(async (message, peer) => {
    const { result, syncPeer, newPeer } = peerFab.isValid(peer);
    if (!result) {
      log(
        `handle leaves: Currently syncing with "${syncPeer}" but received leaves from "${newPeer}". Aborting`
      );
      return;
    }

    log("Received leaves and storing them in db");
    trie.checkpoint();
    await put(trie, message);
    await trie.commit();
  });
}

export function handleConnection(evt) {
  log(`connected ${evt.detail.remotePeer.toString()}`);
}

export function handleDisconnection(evt) {
  log(`disconnected ${evt.detail.remotePeer.toString()}`);
}
