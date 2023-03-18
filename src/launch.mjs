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
