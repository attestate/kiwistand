// @format
import { env } from "process";

import { Trie, BranchNode, ExtensionNode, LeafNode } from "@ethereumjs/trie";
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
    return Buffer.from(keccak256(rlp.encode(node.raw())));
  } else if (node instanceof ExtensionNode) {
    const raw = [nibblesToBuffer(node.encodedKey()), null];
    return Buffer.from(keccak256(rlp.encode(raw)));
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
      nodes.push({
        level: levelCopy,
        key: nibblesToBuffer(key),
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

// TODO: The indexing of level is off here. It'd be best if the tree's root was
// level=0 etc.
// One problem is that for the root, the proof property will be empty as well as
// the buffer. But the same is true for a potential first extension node.
export async function walk(trie, level) {
  if (level === 0) {
    return [
      {
        level: 0,
        key: Buffer.alloc(0),
        hash: trie.root(),
      },
    ];
  }

  const nodes = [];
  const set = new Set();
  const stream = trie.createReadStream();
  return new Promise((resolve, reject) => {
    stream
      .on("data", async (data) => {
        const slice = data.key.slice(0, level);
        if (!set.has(slice.toString("hex"))) {
          set.add(slice.toString("hex"));

          const path = await trie.findPath(slice);

          nodes.push({
            key: data.key,
          });
        }
      })
      .on("end", () => {
        stream.destroy();
        const sort = (a, b) => Buffer.compare(a.key, b.key);
        resolve(nodes.sort(sort));
      });
  });
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
  const id = `${message.timestamp.toString(16)}${digest}`;
  log(`Storing message with id "${id}"`);
  await trie.put(Buffer.from(id, "hex"), Buffer.from(canonical, "utf8"));

  if (libp2p) {
    libp2p.pubsub.publish(messages.name, new TextEncoder().encode(canonical));
  }
}
