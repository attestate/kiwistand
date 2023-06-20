// @format
import { strict as assert } from "assert";

import { decode } from "cbor-x";

import log from "../logger.mjs";
import * as store from "../store.mjs";
import * as registry from "../chainstate/registry.mjs";
import { PROTOCOL } from "../constants.mjs";

const { prefix } = PROTOCOL.pubsub;
const { version, id } = PROTOCOL.pubsub.topics.messages;
assert.ok(prefix);
assert.ok(version);
assert.ok(id);
export const name = `${prefix}/${version}/${id}`;

export const handlers = {
  message: (trie, allowlistFn = registry.allowlist) => {
    return async (evt) => {
      if (evt.detail.topic !== name) {
        log(`message handler: Topic name "${evt.detail.topic}" didn't match`);
        return false;
      }

      let message;
      try {
        message = decode(evt.detail.data);
      } catch (err) {
        log(`message handler: Couldn't parse event data from cbor to object`);
        return false;
      }

      let obj;
      try {
        obj = JSON.parse(message);
      } catch (err) {
        log(
          `message handler: Couldn't JSON-parse message "${message}" to in trie: ${err.toString()}`
        );
        return false;
      }

      const libp2p = null;
      const allowlist = await allowlistFn();
      try {
        await store.add(trie, obj, libp2p, allowlist);
        return true;
      } catch (err) {
        log(
          `message handler: Didn't add message to database because of error: "${err.toString()}"`
        );
        return false;
      }
    };
  },
};
