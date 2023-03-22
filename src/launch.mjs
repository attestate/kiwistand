// @format
import { start } from "./index.mjs";
import log from "./logger.mjs";
import config from "./config.mjs";
import * as messages from "./topics/messages.mjs";
import { handlers } from "./index.mjs";
import * as server from "./http.mjs";
import * as store from "./store.mjs";

(async () => {
  const trie = await store.create();
  // NOTE: We're passing in the trie here as we don't want to make it globally
  // available to run more than one node in the tests
  messages.handlers.message = messages.handlers.message(trie);
  const node = await start(
    config,
    handlers.node,
    handlers.connection,
    handlers.protocol,
    [messages],
    trie
  );
  await server.launch(trie, node);
})();
