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
    if (node.node) node.node = node.node.serialize();
  }
  return nodes;
}

export function deserialize(nodes) {
  for (let node of nodes) {
    node.key = Buffer.from(node.key, "hex");
    node.hash = Buffer.from(node.hash, "hex");
    if (node.node) node.node = decodeNode(node.node);
  }
  return nodes;
}

export async function send(peerId, protocol, message) {
  const { sink, source } = await libp2pnode.dialProtocol(peerId, protocol);
  await toWire(message, sink);
  const [results] = await fromWire(source);
  return results;
}

export async function initiate(
  trie, // must be checkpointed
  peerId,
  exclude = [],
  level = 0,
  innerSend = send
) {
  log(`Initiating sync for peerId: "${peerId}"`);
  const remotes = await store.descend(trie, level, exclude);

  if (remotes.length === 0) {
    log(`Ending initiate on level: "${level}"`);
    return;
  }
  // TODO: The levels magic constant here should somehow be externally defined
  // as a constant.
  const results = await innerSend(peerId, "/levels/1.0.0", serialize(remotes));
  const missing = deserialize(results.missing).filter(
    ({ node }) => node instanceof LeafNode
  );
  if (missing.length > 0)
    await innerSend(peerId, "/leaves/1.0.0", serialize(missing));

  const matches = deserialize(results.match).map((node) => node.hash);
  return await initiate(trie, peerId, matches, level + 1, innerSend);
}

// TODO: We must validate the incoming remotes using a JSON schema.
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
    const response = await handler(message);

    await toWire(response, stream.sink);
  };
}

export async function handleConnection(evt) {
  log(`connected ${evt.detail.remotePeer.toString()}`);
  const trie = await store.create();
  const level = 0;
  return await initiate(trie, evt.detail.remotePeer, level);
}

export function handleDisconnection(evt) {
  log(`disconnected ${evt.detail.remotePeer.toString()}`);
}
