// @format
import log from "../logger.mjs";
import * as store from "../store.mjs";
import allowlist from "../../allowlist.mjs";
import { TOPIC_PREFIX } from "./index.mjs";

export const name = `${TOPIC_PREFIX}/messages`;
export const handlers = {
  message: async (evt) => {
    if (evt.detail.topic !== name) {
      log(`Topic name "${evt.detail.topic}" didn't match`);
      return;
    }

    const text = new TextDecoder().decode(evt.detail.data);

    let message;
    try {
      message = JSON.parse(text);
    } catch (err) {
      log(`Couldn't parse message: "${err.toString()}`);
      return;
    }
    const trie = await store.create();
    const libp2p = null;
    await store.add(trie, message, libp2p, allowlist);
  },
};
