// @format
import { env } from "process";

import { Trie } from "@ethereumjs/trie";

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

export async function nodesByLevel(trie, level) {
  if (level <= 0) {
    throw new Error("'level' parameter must be greater than 0");
  }
  const nodes = [];
  const set = new Set();
  const stream = trie.createReadStream();
  return new Promise((resolve, reject) => {
    // NOTE: This isn't the most efficient implementation of a breadth first
    // walk as it's going over the entire tree before ending. A much more
    // efficient implementation would go only breadth first.
    stream
      .on("data", (node) => {
        const slice = node.key.slice(0, level).toString("hex");
        // NOTE: Technically, if we have all same-length keys then this check
        // isn't necessary. But I was neither sure of that for now, nor do I
        // encode this information into the tests.
        if (slice.length < level * 2) return;
        if (!set.has(slice)) {
          set.add(slice);
          nodes.push(node);
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
  // TODO: This won't work as the hex will be interpreted by one big hex and not
  // a combination of timestamp and digest.
  const id = `${message.timestamp.toString(16)}${digest}`;
  log(`Storing message with id "${id}"`);
  await trie.put(Buffer.from(id, "hex"), Buffer.from(canonical, "utf8"));

  if (libp2p) {
    libp2p.pubsub.publish(messages.name, new TextEncoder().encode(canonical));
  }
}
