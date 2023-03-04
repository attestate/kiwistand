// @format
import log from "./logger.mjs";
import * as store from "./store.mjs";

export const TOPIC_PREFIX = "COPYCAT/v0.0.1";

const messageName = `${TOPIC_PREFIX}/messages`;
export const messages = {
  name: messageName,
  handlers: {
    message: async (evt) => {
      if (evt.detail.topic === messageName) {
        let message = new TextDecoder().decode(evt.detail.data);
        message = JSON.parse(message);
        const trie = await store.create();
        const distribute = false;
        await store.add(trie, message, distribute);
      }
    },
  },
};
export const all = [messages];
