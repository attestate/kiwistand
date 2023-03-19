// @format
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { toString } from "uint8arrays/to-string";
import { fromString } from "uint8arrays/from-string";
import map from "it-map";
import all from "it-all";
import { LeafNode, decodeNode } from "@ethereumjs/trie";

import log from "./logger.mjs";
import * as store from "./store.mjs";
import allowlist from "../allowlist.mjs";

export async function toWire(message, sink) {
  const sMessage = JSON.stringify(message);
  const buf = fromString(sMessage);
  return await pipe([buf], lp.encode(), sink);
}

export async function fromWire(source) {
  return await pipe(source, lp.decode(), async (_source) => {
    const results = await map(_source, (message) => {
      if (!message) return;
      const sMessage = toString(message.subarray());
      return JSON.parse(sMessage);
    });
    return await all(results);
  });
}

export function handleDiscovery(evt) {
  log(`discovered ${evt.detail.id.toString()}`);
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
  innerSend
) {
  log(
    `Initiating sync for peerId: "${peerId}" and level "${level}" and root "${trie
      .root()
      .toString("hex")}"`
  );
  const remotes = await store.descend(trie, level, exclude);
  // TODO: Remove
  console.log(remotes);

  if (remotes.length === 0) {
    log(
      `Ending initiate on level: "${level}" with root: "${trie
        .root()
        .toString("hex")}"`
    );
    return;
  }
  // TODO: The levels magic constant here should somehow be externally defined
  // as a constant.
  const results = await innerSend(peerId, "/levels/1.0.0", serialize(remotes));
  const missing = deserialize(results.missing).filter(
    ({ node }) => node instanceof LeafNode
  );
  if (missing.length > 0) {
    log("Sending missing leaves to peer node");
    try {
      await innerSend(peerId, "/leaves/1.0.0", serialize(missing));
    } catch (err) {
      log("Error sending leaves to peer");
      throw err;
    }
  }

  const matches = deserialize(results.match).map((node) => node.hash);
  return await initiate(trie, peerId, matches, level + 1, innerSend);
}

export async function put(trie, message) {
  const missing = deserialize(message);
  for await (let { node, key } of missing) {
    const value = node.value();
    const libp2p = null;
    log(`Adding to database value "${value}"`);
    await store.add(trie, value, libp2p, allowlist);
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
  return async ({ stream }) => {
    const [message] = await fromWire(stream.source);
    log(`receiving message: "${JSON.stringify(message)}"`);
    const response = await handler(message);

    if (!response) {
      log("Closing stream as response is missing");
      return stream.close();
    }
    log(`sending response: "${JSON.stringify(response)}"`);
    await toWire(response, stream.sink);
  };
}

export function handleLevels(trie) {
  return receive(async (message) => {
    log("Received levels and comparing them");
    const result = await compare(trie, message);
    // TODO: On the second iteration, this isn't returning.
    return result;
  });
}

export function handleLeaves(trie) {
  return receive(async (message) => {
    log("Received leaves and storing them in db");
    trie.checkpoint();
    // TODO: Ideally, this uses a version of add message as to validate other
    // properties
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
