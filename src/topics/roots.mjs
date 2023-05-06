// @format
import { env } from "process";
import { strict as assert } from "assert";

import { decode } from "cbor-x";

import log from "../logger.mjs";
import { initiate } from "../sync.mjs";
import { PROTOCOL } from "../constants.mjs";

const { prefix } = PROTOCOL.pubsub;
const { version, id } = PROTOCOL.pubsub.topics.roots;
assert.ok(prefix);
assert.ok(version);
assert.ok(id);
export const name = `${prefix}/${version}/${id}`;

export const handlers = {
  message: (trie, node) => {
    return async (evt) => {
      if (evt.detail.topic !== name) {
        log(`Topic name "${evt.detail.topic}" didn't match`);
        return;
      }

      let message;
      try {
        message = decode(evt.detail.data);
      } catch (err) {
        log(`Couldn't parse event data from cbor to object`);
        return;
      }

      const remoteRoot = Buffer.from(message.root, "hex");
      if (Buffer.compare(trie.root(), remoteRoot) === 0) {
        log("Received remote root that is equal to local root");
        return;
      }

      if (env.AUTO_SYNC === "false") {
        log(`AUTO_SYNC is set to "false". Aborting "initiate" sync attempt.`);
        return;
      }
      await node.goblin.initiate(evt.detail.from);
    };
  },
};
