// @format
import { env } from "process";
import { resolve } from "path";

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
import { encode, decode } from "cbor-x";
import { open } from "lmdb";

import log from "./logger.mjs";
import LMDB from "./lmdb.mjs";
import { verify, toDigest } from "./id.mjs";
import * as messages from "./topics/messages.mjs";

export async function create() {
  log(`Creating trie with DATA_DIR: "${env.DATA_DIR}"`);
  return await Trie.create({
    // TODO: Understand if this should this use "resolve"?
    db: new LMDB(env.DATA_DIR),
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
      log(`Throwing error for looking up: "${hash.toString()}"`);
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

export async function descend(trie, level, exclude = []) {
  const emptyRoot = Buffer.from(
    "56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421",
    "hex"
  );
  if (level === 0 && isEqual(emptyRoot, trie.root())) {
    return [
      {
        level: 0,
        key: Buffer.alloc(0),
        hash: trie.root(),
        node: null,
      },
    ];
  }

  const levelCopy = level;
  let nodes = [];
  const onFound = (nodeRef, node, key, walkController) => {
    // NOTE: The idea of the "exclue" array is that it contains nodes that have
    // matched on the remote trie, and so we don't have to send them along in a
    // future comparison. Hence, if we have a match, we simply return.
    const nodeHash = hash(node);
    const match = exclude.find((markedNode) => isEqual(markedNode, nodeHash));
    if (match) return;

    if (level === 0) {
      if (levelCopy !== 0 && node instanceof LeafNode) {
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
  try {
    await trie.walkTrie(trie.root(), onFound);
  } catch (err) {
    if (err.toString().includes("Missing node in DB")) {
      log("descend: Didn't find any nodes");
      return nodes;
    } else {
      throw err;
    }
  }
  return nodes;
}

export async function passes(message, address) {
  const db = open({
    compression: true,
    name: "constraints",
    encoding: "cbor",
    path: resolve(env.DATA_DIR),
  });
  const key = `${address}:${message.href}:${message.type}`;
  const seenBefore = await db.doesExist(key);
  await db.put(key);
  return !seenBefore;
}

export async function add(trie, message, libp2p, allowlist) {
  const address = verify(message);
  const included = allowlist.includes(address);
  if (!included) {
    const err = `Address "${address}" wasn't found in the allow list. Dropping message.`;
    log(err);
    throw new Error(err);
  }

  const minTimestampSecs = parseInt(env.MIN_TIMESTAMP_SECS, 10);
  if (message.timestamp < minTimestampSecs) {
    const err = `Message timestamp is from before the year 2023 and so message is dropped: "${message.timestamp}"`;
    log(err);
    throw new Error(err);
  }

  const nowSecs = Date.now() / 1000;
  const toleranceSecs = parseInt(env.MAX_TIMESTAMP_DELTA_SECS, 10);
  const maxTimestampSecs = nowSecs + toleranceSecs;
  if (message.timestamp >= maxTimestampSecs) {
    const err = `Message timestamp is more than "${toleranceSecs}" seconds in the future and so message is dropped: "${message.timestamp}"`;
    log(err);
    throw new Error(err);
  }

  const legit = await passes(message, address);
  if (!legit) {
    const err = `Message doesn't pass legitimacy criteria (duplicate). It was probably submitted and accepted before.`;
    log(err);
    throw new Error(err);
  }

  const { digest, canonical } = toDigest(message);
  // TODO: This won't work as the hex will be interpreted by one big hex and
  // not a combination of timestamp and digest.
  // NOTE: Upon another examination, this could still work. We, technically,
  // don't need to extract either the hash or the timestamp from the id itself.
  // The timestamp is in the message itself and the hash can be generated. So we
  // might be fine!
  // TODO: We must extract the timestamp and hash from the ID again.
  const id = `${message.timestamp.toString(16)}${digest}`;
  log(`Storing message with id "${id}"`);
  // TODO: We should check if checkpointing is off here.
  await trie.put(Buffer.from(id, "hex"), canonical);
  log(`New root: "${trie.root().toString("hex")}"`);

  if (!libp2p) {
    log(
      "Didn't distribute message after ingestion because libp2p instance isn't defined"
    );
    return;
  }

  log(
    `Sending message to peers: "${messages.name}" and message: "${canonical}"`
  );
  libp2p.pubsub.publish(messages.name, canonical);
}

export function count(leaves) {
  const stories = {};

  for (const leaf of leaves) {
    const key = `${leaf.href}`;
    let story = stories[key];

    if (!story) {
      story = {
        title: leaf.title,
        timestamp: leaf.timestamp,
        href: leaf.href,
        points: 1,
      };
      stories[key] = story;
    } else {
      if (leaf.type === "amplify") {
        story.points += 1;
        if (!story.title && leaf.title) story.title = leaf.title;
      }
    }
  }

  const currentTime = Date.now() / 1000; // Convert current time to seconds
  const decayFactor = 4;
  const newStoryBoost = 1.5; // Boost factor for newer stories

  const sortedStories = Object.values(stories).sort((a, b) => {
    const timeDifferenceA = (currentTime - a.timestamp) / (60 * 60); // Calculate the time difference in hours
    const timeDifferenceB = (currentTime - b.timestamp) / (60 * 60); // Calculate the time difference in hours

    const isNewStoryA = timeDifferenceA <= 12; // Consider a story new if it is less than or equal to 12 hours old
    const isNewStoryB = timeDifferenceB <= 12; // Consider a story new if it is less than or equal to 12 hours old

    const decayedPointsA = a.points / Math.pow(decayFactor, timeDifferenceA);
    const decayedPointsB = b.points / Math.pow(decayFactor, timeDifferenceB);

    const boostedDecayedPointsA = isNewStoryA
      ? decayedPointsA * newStoryBoost
      : decayedPointsA;
    const boostedDecayedPointsB = isNewStoryB
      ? decayedPointsB * newStoryBoost
      : decayedPointsB;

    return boostedDecayedPointsB - boostedDecayedPointsA;
  });

  return sortedStories;
}

export async function leaves(trie, from, amount) {
  let pointer = 0;
  const nodes = [];
  const onFound = (nodeRef, node, key, walkController) => {
    if (Number.isInteger(amount) && nodes.length >= amount) return;

    if (node instanceof LeafNode) {
      pointer += 1;

      const fragments = [key, node.key()].map(nibblesToBuffer);
      key = Buffer.concat(fragments);
      const value = decode(node.value());

      if (Number.isInteger(from) && pointer <= from) return;
      nodes.push(value);
    } else if (node instanceof BranchNode || node instanceof ExtensionNode) {
      walkController.allChildren(node, key);
    }
  };

  try {
    await trie.walkTrie(trie.root(), onFound);
  } catch (err) {
    if (err.toString().includes("Missing node in DB")) {
      log("descend: Didn't find any nodes");
      return nodes;
    } else {
      throw err;
    }
  }
  return nodes;
}
