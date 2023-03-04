// @format
import { env } from "process";

import { Trie } from "@ethereumjs/trie";

import log from "./logger.mjs";
import LMDB from "./lmdb.mjs";
import { verify, toDigest } from "./id.mjs";
import { messages } from "./topics.mjs";

export async function create() {
  return await Trie.create({
    db: new LMDB(env.DATA_DIR),
    useRootPersistence: true,
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
  const id = `${message.timestamp}-${digest}`;
  log(`Storing message with digest "${digest}"`);
  await trie.put(Buffer.from(id), Buffer.from(canonical));

  if (libp2p) {
    libp2p.pubsub.publish(messages.name, new TextEncoder().encode(canonical));
  }
}
