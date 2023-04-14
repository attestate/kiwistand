// @format
import { boot as crawl } from "@attestate/crawler";

import { start, subscribe } from "./index.mjs";
import log from "./logger.mjs";
import config from "./config.mjs";
import * as messages from "./topics/messages.mjs";
import * as roots from "./topics/roots.mjs";
import { handlers } from "./index.mjs";
import * as server from "./http.mjs";
import * as store from "./store.mjs";
import crawlPath from "./chainstate/config.crawler.mjs";

(async () => {
  crawl(crawlPath);
  const trie = await store.create();
  const node = await start(config);

  // NOTE: We're passing in the trie here as we don't want to make it globally
  // available to run more than one node in the tests
  messages.handlers.message = messages.handlers.message(trie);
  roots.handlers.message = roots.handlers.message(trie, node);

  await subscribe(
    node,
    handlers.node,
    handlers.connection,
    handlers.protocol,
    [messages, roots],
    trie
  );
  await server.launch(trie, node);
})();
