// @format

import { decode } from "cbor-x";

import log from "../logger.mjs";
import * as store from "../store.mjs";
import { TOPIC_PREFIX } from "./index.mjs";
import * as registry from "../chainstate/registry.mjs";

export const name = `${TOPIC_PREFIX}/messages`;
export const handlers = {
  message: (trie) => {
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

      const libp2p = null;
      const allowlist = await registry.allowlist();
      try {
        await store.add(trie, message, libp2p, allowlist);
      } catch (err) {
        log(
          `message handler: Didn't add message to database because of error: "${err.toString()}"`
        );
      }
    };
  },
};
