// @format
import log from "./logger.mjs";
import * as store from "./store.mjs";
import allowlist from "../allowlist.mjs";

export const TOPIC_PREFIX = "COPYCAT/v0.0.1";

const messageName = `${TOPIC_PREFIX}/messages`;
export const messages = {
  name: messageName,
  handlers: {
    // TODO: Needs testing
    // also needs more robustness (can easily fail from user input)
    message: async (evt) => {
      if (evt.detail.topic === messageName) {
        let message = new TextDecoder().decode(evt.detail.data);
        message = JSON.parse(message);
        const trie = await store.create();
        const libp2p = null;
        await store.add(trie, message, libp2p, allowlist);
      }
    },
  },
};
export const all = [messages];
