// @format

import { decode } from "cbor-x";

import log from "../logger.mjs";
import * as store from "../store.mjs";
import allowlist from "../../allowlist.mjs";
import { TOPIC_PREFIX } from "./index.mjs";

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
      await store.add(trie, message, libp2p, allowlist);
    };
  },
};
