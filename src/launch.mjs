// @format
import { env, exit } from "process";

import { boot as crawl } from "@attestate/crawler";
import { subWeeks } from "date-fns";

import { start, subscribe } from "./index.mjs";
import log from "./logger.mjs";
import config from "./config.mjs";
import * as messages from "./topics/messages.mjs";
import * as roots from "./topics/roots.mjs";
import { handlers } from "./index.mjs";
import * as api from "./api.mjs";
import * as http from "./http.mjs";
import * as store from "./store.mjs";
import * as cache from "./cache.mjs";
import mintCrawlPath from "./chainstate/mint.config.crawler.mjs";
import delegateCrawlPath from "./chainstate/delegate.config.crawler.mjs";
import * as registry from "./chainstate/registry.mjs";
import * as karma from "./karma.mjs";
import * as newest from "./views/new.mjs";
import * as feeds from "./feeds.mjs";
import * as moderation from "./views/moderation.mjs";

cache.initialize();
cache.initializeNotifications();

const reconcileMode = env.NODE_ENV === "reconcile";
const productionMode = env.NODE_ENV === "production";
if (reconcileMode) {
  log(`Running in reconciliation mode`);
  log(
    `In reconciliation mode, syncing with the chain and reconciling with the p2p network are enabled. The product backend/frontends are disabled.`,
  );
}

const trie = await store.create();

const node = await start(config);

await api.launch(trie, node);

if (!reconcileMode) {
  await http.launch(trie, node);
}

crawl(mintCrawlPath);
crawl(delegateCrawlPath);

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
  trie,
);

// NOTE: This request queries all messages in the database to enable caching
// when calling ecrecover on messages' signatures.
//
// NOTE: Yes, this does influence the startup duration of a node as it extracts
// and re-validates all messages from the DB. However, the store.cache function
// is necessary to be run as it generates the markers that prevent double
// upvoting from happening.
const from = null;
const amount = null;
const startDatetime = null;
const parser = JSON.parse;
const accounts = await registry.accounts();
const delegations = await registry.delegations();
const href = null;

let upvotes, comments;
await Promise.allSettled([
  store
    .posts(
      trie,
      from,
      amount,
      parser,
      startDatetime,
      accounts,
      delegations,
      href,
      "amplify",
    )
    .then((result) => (upvotes = result))
    .catch((error) => console.error("Amplify posts error:", error)),
  store
    .posts(
      trie,
      from,
      amount,
      parser,
      startDatetime,
      accounts,
      delegations,
      href,
      "comment",
    )
    .then((result) => (comments = result))
    .catch((error) => console.error("Comment posts error:", error)),
]);

store
  .cache(upvotes, comments)
  .then(() => log("store cached"))
  .catch((err) => {
    log(
      `launch: An irrecoverable error during upvote caching occurred. "${err.stack}`,
    );
    exit(1);
  });

if (!reconcileMode) {
  const urls = await moderation.getFeeds();
  Promise.all([feeds.recompute(urls), newest.recompute(trie)]).then(() =>
    log("Feeds computed"),
  );
  // TODO: Unclear if this is still necessary
  setInterval(async () => {
    await Promise.all([feeds.recompute(urls), newest.recompute(trie)]);
  }, 1800000);
  karma.count(upvotes);
}
