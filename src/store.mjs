// @format
import { env } from "process";

import {
  Trie,
  WalkController,
  BranchNode,
  ExtensionNode,
  LeafNode,
} from "@ethereumjs/trie";
import rlp from "@ethereumjs/rlp";
import { keccak256 } from "ethereum-cryptography/keccak.js";

import log from "./logger.mjs";
import LMDB from "./lmdb.mjs";
import { verify, toDigest } from "./id.mjs";
import * as messages from "./topics/messages.mjs";

export async function create() {
  return await Trie.create({
    db: new LMDB(env.DATA_DIR),
    useRootPersistence: true,
  });
}

export function hash(node) {
  if (node instanceof BranchNode || node instanceof LeafNode) {
    const encoded = rlp.encode(node.raw());
    if (encoded.length < 32) return node.raw();
    return Buffer.from(keccak256(encoded));
  } else if (node instanceof ExtensionNode) {
    const encoded = rlp.encode(node.raw());
    if (encoded.length < 32) return node.raw();
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

export async function subtrie(localTrie, hash) {
  let toggle = false;
  const onNode = (nodeRef, node, key, walkController) => {
    if (!toggle) {
      toggle = true;
      console.log(hash);
      walkController.pushNodeToQueue(hash);
    } else {
      walkController.allChildren(node, key);
    }
  };
  return await WalkController.newWalk(onNode, localTrie, localTrie.root());
}

export async function compare(localTrie, remote) {
  const missing = [];
  const mismatch = [];
  for (let remoteNode of remote) {
    // NOTE: In case the level:0 is being compared and we're having to deal
    // with the root node.
    if (
      remoteNode.level === 0 &&
      remoteNode.key.length === 0 &&
      Buffer.compare(localTrie.root(), remoteNode.hash) !== 0
    ) {
      mismatch.push(remoteNode);
      break;
    }

    // NOTE: There are several ways we can look for matches in the database.
    // But most important is that we differentiate between nodes that are
    // missing and nodes that are hash-mismatches. That is because in cases of
    // hash mismatches, we know that the local node has the same subtree
    // available and that we'll have to descend deeper into the tree until we
    // find missing nodes. Whereas for missing nodes, we're well-served by
    // requesting them from the paired node.
    let node;
    try {
      node = await localTrie.lookupNode(remoteNode.hash);
    } catch (err) {
      if (err.toString().includes("Missing node in DB")) {
        const path = await localTrie.findPath(remoteNode.key);
        node = path.node;
      } else {
        throw err;
      }
    }

    if (!node) {
      missing.push(remoteNode);
    } else {
      mismatch.push(remoteNode);
    }
  }
  return {
    missing,
    mismatch,
  };
}

export async function descend(trie, level) {
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
        hash: hash(node),
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
