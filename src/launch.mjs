// @format
import { env, exit } from "process";
import cluster from "cluster";
import os from "os";
import { fork } from "child_process";

import { boot as crawl } from "@attestate/crawler";
import { subWeeks } from "date-fns";
import blockedAt from "blocked-at";

import { start, subscribe } from "./index.mjs";
import log from "./logger.mjs";

import config from "./config.mjs";
import * as messages from "./topics/messages.mjs";
import * as roots from "./topics/roots.mjs";
import { handlers } from "./index.mjs";
import * as api from "./api.mjs";
// Dynamic import for http module - only loaded when not in reconcile mode
import * as store from "./store.mjs";
import * as cache from "./cache.mjs";
import delegateCrawlPath from "./chainstate/delegate.config.crawler.mjs";
import * as registry from "./chainstate/registry.mjs";
import * as karma from "./karma.mjs";
import * as newest from "./views/new.mjs";
import * as email from "./email.mjs";
import * as moderation from "./views/moderation.mjs";
import diskcheck from "./diskcheck.mjs";
import { purgeCache } from "./cloudflarePurge.mjs";
import { generateDigestData } from "./digest.mjs";

// Monitor event loop blocking - grep logs for "Event loop blocked" to find offenders
// Using 200ms threshold to reduce noise; 50ms fires too often during normal I/O
blockedAt(
  (time, stack) => {
    log(`Event loop blocked for ${time}ms. Stack:\n${stack.join("\n")}`);
  },
  { threshold: 200 },
);

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
  cache.initializeListens();

  // Run cache cleanup in background (non-blocking)
  const cleanupProcess = fork("./scripts/cleanup-cache.mjs", [], {
    stdio: "inherit",
    detached: false,
  });
  cleanupProcess.on("exit", (code) => {
    if (code === 0) {
      log("Cache cleanup completed successfully");
    } else {
      log(`Cache cleanup exited with code ${code}`);
    }
  });

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
    const http = await import("./http.mjs");
    await http.launch(trie, node, true); // true indicates primary process
    // Purge homepage cache on server restart in production
    if (productionMode) {
      purgeCache("https://news.kiwistand.com/")
        .then(() => log("Homepage cache purged on startup"))
        .catch((err) =>
          log(`Failed to purge homepage cache on startup: ${err}`),
        );

      // Purge again after 15 seconds to catch feed recomputation
      setTimeout(() => {
        purgeCache("https://news.kiwistand.com/")
          .then(() => log("Homepage cache purged again after 15 seconds"))
          .catch((err) =>
            log(`Failed to purge homepage cache after 15 seconds: ${err}`),
          );
      }, 25000);
    }
  }

  // NOTE: The crawl functions return promises that resolve only when the
  // WebSocket coordinators are stopped (e.g., via SIGINT). We intentionally
  // don't await them so the server can continue starting up while the
  // crawlers run in the background with their persistent WebSocket connections.
  crawl(delegateCrawlPath).catch((err) =>
    log(`Delegate crawler error: ${err.message}`),
  );

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

  // Fork workers (skip in reconcile mode - no HTTP workers needed)
  if (!reconcileMode) {
    for (let i = 0; i < numWorkers; i++) {
      cluster.fork();
    }

    cluster.on("exit", (worker, code, signal) => {
      log(`Worker ${worker.process.pid} died. Restarting...`);
      cluster.fork();
    });
  }
} else {
  log(`Worker ${process.pid} started`);

  // Initialize lifetime cache in worker too
  cache.initializeLtCache();

  const trie = await store.create();

  if (!reconcileMode) {
    const http = await import("./http.mjs");
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
// Schedule newest.recompute early - before the slow store.posts() call
// The SQLite tables persist between runs, so listNewest() has data
if (!reconcileMode) {
  setImmediate(() => {
    newest
      .recompute(trie)
      .then(() => log("/new computed"))
      .catch((err) => log(`/new recompute failed: ${err.stack || err}`));
  });
  // Periodic refresh
  setInterval(async () => {
    await Promise.all([newest.recompute(trie)]);
  }, 1800000);
}

const from = null;
const amount = null;
const startDatetime = null;
const parser = JSON.parse;
const delegations = await registry.delegations();
const href = null;

let upvotes = [],
  comments = [];
// Both primary and workers load posts for cache bootstrapping (SQLite + reaction markers)
await Promise.allSettled([
  store
    .posts(
      trie,
      from,
      amount,
      parser,
      startDatetime,
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
      delegations,
      href,
      "comment",
    )
    .then((result) => (comments = result))
    .catch((error) => console.error("Comment posts error:", error)),
]);

cache.initialize([...upvotes, ...comments]);
cache.initializeNotifications();
cache.initializeReactions();
cache.addCompoundIndexes();

// Make upvote/reaction marker caching non-blocking to improve startup time
setImmediate(() => {
  store
    .cache(upvotes, comments)
    .then(() => {
      log("store cached");
      // Clear arrays to free memory after caching is complete
      upvotes = null;
      comments = null;
    })
    .catch((err) => {
      log(
        `launch: An irrecoverable error during cache bootstrap occurred. "${err.stack}`,
      );
      exit(1);
    });
});

// NOTE: newest.recompute() is now scheduled earlier in the file, before store.posts()

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
