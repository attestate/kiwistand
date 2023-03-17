// @format
import { env } from "process";
import assert from "assert/strict";

import {
  Trie,
  WalkController,
  BranchNode,
  ExtensionNode,
  LeafNode,
  decodeNode,
} from "@ethereumjs/trie";
import rlp from "@ethereumjs/rlp";
import { keccak256 } from "ethereum-cryptography/keccak.js";

import log from "./logger.mjs";
import LMDB from "./lmdb.mjs";
import { verify, toDigest } from "./id.mjs";
import * as messages from "./topics/messages.mjs";

export async function create() {
  let dir = env.DATA_DIR;
  if (env.TEST_DB_OVERWRITE === "true") {
    dir = `${env.DATA_DIR}-${libp2pnode.peerId.toString()}`;
    log(`Found test environment for db, using name: "${dir}"`);
  }
  return await Trie.create({
    db: new LMDB(dir),
    useRootPersistence: true,
  });
}

// NOTE: https://ethereum.github.io/execution-specs/diffs/frontier_homestead/trie/index.html#ethereum.frontier.trie.encode_internal_node
export function hash(node) {
  if (
    node instanceof BranchNode ||
    node instanceof LeafNode ||
    node instanceof ExtensionNode
  ) {
    const encoded = rlp.encode(node.raw());
    if (encoded.length < 32) return node.serialize();
    return Buffer.from(keccak256(encoded));
  } else {
    throw new Error("Must be BranchNode, LeafNode or ExtensionNode");
  }
}

// NOTE: Function not tested because we took it from the ethereumjs/trie code
// base.
export function nibblesToBuffer(arr) {
  const buf = Buffer.alloc(arr.length / 2);
  for (let i = 0; i < buf.length; i++) {
    let q = i * 2;
    buf[i] = (arr[q] << 4) + arr[++q];
  }
  return buf;
}

export async function subtrie(localTrie, root) {
  let toggle = false;
  const nodes = [];
  const onNode = (nodeRef, node, key, walkController) => {
    if (!toggle) {
      toggle = true;
      walkController.pushNodeToQueue(root);
    } else {
      nodes.push({
        key,
        hash: hash(node),
        node,
      });
      walkController.allChildren(node, key);
    }
  };
  await WalkController.newWalk(onNode, localTrie, localTrie.root());
  return nodes;
}

// NOTE:
//
// At last: there should be a function that can send and receive nodes within
// the tree synchronization. E.g. it accepts the collected nodes, or it asks
// for a comparison on a level basis.
//
// I think it probably makes most sense to frame this type of API a stateless,
// similar to rest, where nodes can access the resources of other nodes to
// build their own local state.

export async function collect(localTrie, hashes) {
  const nodes = [];
  for await (let root of missing) {
    nodes.push(await subtrie(localTrie, root));
  }
  return nodes;
}

export function isEqual(buf1, buf2) {
  // NOTE: Ethereum doesn't hash nodes that are smaller than 32 bytes encoded,
  // so it formats them into an array of buffers. And in this case, it could be
  // that those data structures get compared to hashes. But we want to avoid
  // that at all costs and so we're throwing if we're ever coming across such.
  if (Array.isArray(buf1) || Array.isArray(buf2)) {
    throw new Error("Can only compare buffers");
  }
  if (Buffer.isBuffer(buf1) && Buffer.isBuffer(buf2)) {
    return Buffer.compare(buf1, buf2) === 0;
  }
  return false;
}

export async function lookup(trie, hash, key) {
  const result = {
    node: null,
    type: null,
  };
  // NOTE: We're serializing nodes smaller than 32 bytes as Ethereum does.
  // And so, we have to decode them here to do a proper database lookup.
  try {
    result.node = decodeNode(hash);
    // NOTE: We report every < 32 bytes long hash as "missing" because any node
    // will always be able to decode them straight from the hash.
    result.type = "missing";
    return result;
  } catch (err) {
    // noop, we'll just continue below.
  }

  // NOTE: There are several ways we can look for matches in the database.
  // But most important is that we differentiate between nodes that are
  // missing and nodes that are hash-mismatches. That is because in cases of
  // hash mismatches, we know that the local node has the same subtree
  // available and that we'll have to descend deeper into the tree until we
  // find missing nodes. Whereas for missing nodes, we're well-served by
  // requesting them from the paired node.
  try {
    result.node = await trie.lookupNode(hash);
    result.type = "match";
  } catch (err) {
    if (err.toString().includes("Missing node in DB")) {
      // TODO: The empty buffer as a key is not recognized or leads to results.
      const path = await trie.findPath(key);
      result.node = path.node;
      result.type = "mismatch";
    } else {
      throw err;
    }
  }
  return result;
}

export async function compare(localTrie, remotes) {
  const match = [];
  const missing = [];
  const mismatch = [];
  for (let remoteNode of remotes) {
    // NOTE: In case the level:0 is being compared and we're having to deal
    // with the root node.
    if (remoteNode.level === 0 && isEqual(localTrie.root(), remoteNode.hash)) {
      match.push(remoteNode);
      break;
    } else if (remoteNode.level === 0 && remoteNode.key.length === 0) {
      mismatch.push(remoteNode);
      break;
    }

    const { node, type } = await lookup(
      localTrie,
      remoteNode.hash,
      remoteNode.key
    );
    if (type === "match" && node) {
      match.push(remoteNode);
    } else if (type === "mismatch" && node) {
      mismatch.push(remoteNode);
    } else {
      missing.push(remoteNode);
    }
  }
  return {
    missing,
    mismatch,
    match,
  };
}

// TODO: It's probably better to have an inclusion marking, but it then needs
// to be based on the children. We should adjust the compare method too to
// include matches.
export async function descend(trie, level, marked = []) {
  if (level === 0) {
    return [
      {
        level: 0,
        key: Buffer.alloc(0),
        hash: trie.root(),
      },
    ];
  }

  const levelCopy = level;
  let nodes = [];
  const onFound = (nodeRef, node, key, walkController) => {
    // NOTE: The idea of the marked array is that it contains nodes that have
    // matched on the remote trie, and so we don't have to send them along in a
    // future comparison. Hence, if we have a match, we simply return.
    const nodeHash = hash(node);
    const match = marked.find((markedNode) => isEqual(markedNode, nodeHash));
    if (match) return;

    if (level === 0) {
      if (node instanceof LeafNode) {
        const fragments = [key, node.key()].map(nibblesToBuffer);
        key = Buffer.concat(fragments);
      } else {
        key = nibblesToBuffer(key);
      }

      nodes.push({
        level: levelCopy,
        key,
        hash: nodeHash,
        node,
      });
    } else if (node instanceof BranchNode || node instanceof ExtensionNode) {
      level -= 1;
      walkController.allChildren(node, key);
    }
  };
  await trie.walkTrie(trie.root(), onFound);
  return nodes;
}

export async function add(trie, message, libp2p, allowlist) {
  const address = verify(message);
  const included = allowlist.includes(address);
  if (!included) {
    log(
      `Address "${address}" wasn't found in the allow list. Dropping message`
    );
    throw new Error("Signing address wasn't found in allow list");
  }

  const { digest, canonical } = toDigest(message);
  // TODO: This won't work as the hex will be interpreted by one big hex and
  // not a combination of timestamp and digest.
  // NOTE: Upon another examination, this could still work. We, technically,
  // don't need to extract either the hash or the timestamp from the id itself.
  // The timestamp is in the message itself and the hash can be generated. So we
  // might be fine!
  // TODO2: We must extract the timestamp and hash from the ID again.
  const id = `${message.timestamp.toString(16)}${digest}`;
  log(`Storing message with id "${id}"`);
  await trie.put(Buffer.from(id, "hex"), Buffer.from(canonical, "utf8"));

  if (libp2p) {
    libp2p.pubsub.publish(messages.name, new TextEncoder().encode(canonical));
  }
}
