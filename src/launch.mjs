// @format
import { env, exit } from "process";
import cluster from "cluster";
import os from "os";

import { boot as crawl } from "@attestate/crawler";
import { subWeeks } from "date-fns";
//import blockedAt from "blocked-at"; // Import blocked-at

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
import * as email from "./email.mjs";
import * as moderation from "./views/moderation.mjs";
import diskcheck from "./diskcheck.mjs";

// Initialize blocked-at monitoring
// Adjust threshold (milliseconds) as needed. Start higher (e.g., 100ms)
// and lower it if needed, considering the performance overhead.
// Set debug: true for more verbose output if necessary.
//blockedAt(
//  (time, stack, { type, resource } = {}) => {
//    log(`Event loop blocked for ${time}ms. Originating stack trace:`);
//    const stackString = stack.join("\n");
//    log(stackString);
//    if (time > 1000 && !stackString.includes("launch")) process.exit();
//  },
//  { threshold: 50, debug: false },
//); // 50ms threshold

const reconcileMode = env.NODE_ENV === "reconcile";
const productionMode = env.NODE_ENV === "production";
const numWorkers = Number(env.WORKER_COUNT) || os.cpus().length;

const trie = await store.create();

if (cluster.isPrimary) {
  log(`Primary process ${process.pid} is running`);

  // NOTE: Initializing the lifetime cache as a first order is important as it
  // is widely used throughout the application.
  cache.initializeLtCache();
  cache.initializeImpressions();
  cache.initializeShares();

  if (reconcileMode) {
    log(`Running in reconciliation mode`);
    log(
      `In reconciliation mode, syncing with the chain and reconciling with the p2p network are enabled. The product backend/frontends are disabled.`,
    );
  }

  // NOTE: This will crash the program intentionally when disk space is lower
  // than some percentage necessary for it to work well.
  if (productionMode) {
    diskcheck();
  }

  const node = await start(config);

  await api.launch(trie, node);

  if (!reconcileMode) {
    await http.launch(trie, node, true); // true indicates primary process
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

  // Fork workers
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    log(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  log(`Worker ${process.pid} started`);

  // Initialize lifetime cache in worker too
  cache.initializeLtCache();

  const trie = await store.create();

  if (!reconcileMode) {
    await http.launch(trie, null, false); // false indicates worker process
  }
}

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

let upvotes = [], comments = [];
if (cluster.isPrimary) {
  // Primary needs both upvotes and comments
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
} else {
  // Workers only need comments for counts
  await store
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
    .catch((error) => console.error("Comment posts error:", error));
}

cache.initialize([...upvotes, ...comments]);
cache.initializeNotifications();
cache.initializeReactions();
cache.addCompoundIndexes();

// Make upvote caching non-blocking to improve startup time
setImmediate(() => {
  if (cluster.isPrimary) {
    // Primary builds full validation sets
    store
      .cache(upvotes, comments)
      .then(() => log("store cached"))
      .catch((err) => {
        log(
          `launch: An irrecoverable error during upvote caching occurred. "${err.stack}`,
        );
        exit(1);
      });
  } else {
    // Workers only need comment counts
    for (const comment of comments) {
      const sync = false;
      store.addComment(comment.href, sync);
    }
    log("Worker comment counts cached");
  }
});

if (!reconcileMode) {
  // Make feed computation during startup non-blocking
  setImmediate(() => {
    newest.recompute(trie).then(() => log("/new computed"));
  });
  // TODO: Unclear if this is still necessary
  setInterval(async () => {
    await Promise.all([newest.recompute(trie)]);
  }, 1800000);
}

// These operations should only run in the primary process
if (cluster.isPrimary && productionMode && env.POSTMARK_API_KEY) {
  email
    .syncSuppressions()
    .then(() => {
      log("Postmark suppressions synced successfully.");
    })
    .catch((error) => {
      log(`Error syncing Postmark suppressions: ${error.toString()}`);
    });
}
