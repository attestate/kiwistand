//@format

// NOTE: Throughout this file we use Cloudflare-specific cache control headers:
// - s-maxage: Controls Cloudflare CDN caching duration
// - stale-while-revalidate: We implement a custom worker on news.kiwistand.com
//   to handle stale-while-revalidate since Cloudflare doesn't support this natively

import { env } from "process";
import path from "path";
import cluster from "cluster";
import Cloudflare from "cloudflare";

import morgan from "morgan";
import express from "express";
import cookieParser from "cookie-parser";
import compression from "compression";
import { utils } from "ethers";
import { handleFaucetRequest } from "./faucet.mjs";
import "express-async-errors";
import { sub } from "date-fns";
import DOMPurify from "isomorphic-dompurify";
import { getSlug } from "./utils.mjs";
import { createServer as createHttpServer } from "http";
import { FileSystemCache, getCacheKey } from "node-fetch-cache";

import * as registry from "./chainstate/registry.mjs";
import log from "./logger.mjs";
import theme from "./theme.mjs";
import feed, { index } from "./views/feed.mjs";
import story, { generateStory } from "./views/story.mjs";
import newest, * as newAPI from "./views/new.mjs";
import best, * as bestAPI from "./views/best.mjs";
import privacy from "./views/privacy.mjs";
import guidelines from "./views/guidelines.mjs";
import onboarding from "./views/onboarding.mjs";
import referral from "./views/referral.mjs";
import gateway from "./views/gateway.mjs";
import kiwipassmint from "./views/kiwipass-mint.mjs";
import whattosubmit from "./views/whattosubmit.mjs";
import onboardingReader from "./views/onboarding-reader.mjs";
import onboardingCurator from "./views/onboarding-curator.mjs";
import onboardingSubmitter from "./views/onboarding-submitter.mjs";
import shortcut from "./views/shortcut.mjs";
import upvotes from "./views/upvotes.mjs";
import community from "./views/community.mjs";
import stats from "./views/stats.mjs";
import users from "./views/users.mjs";
import basics from "./views/basics.mjs";
import search from "./views/search.mjs";
import * as activity from "./views/activity.mjs";
import submit from "./views/submit.mjs";
import start from "./views/start.mjs";
import indexing from "./views/indexing.mjs";
import invite from "./views/invite.mjs";
import appOnboarding from "./views/app-onboarding.mjs";
import appTestflight from "./views/app-testflight.mjs";
import demonstration from "./views/demonstration.mjs";
import notifications from "./views/notifications.mjs";
import emailNotifications from "./views/email-notifications.mjs";
import { parse, metadata } from "./parser.mjs";
import { toAddress, resolve, ENS_CACHE_PREFIX } from "./ens.mjs";
import * as ens from "./ens.mjs";
import * as karma from "./karma.mjs";
import * as subscriptions from "./subscriptions.mjs";
import * as telegram from "./telegram.mjs";
import * as email from "./email.mjs";
import * as price from "./price.mjs";
import {
  getSubmission,
  trackOutbound,
  trackImpression,
  countOutbounds,
  storeMiniAppUpvote,
} from "./cache.mjs";
import appCache from "./cache.mjs"; // For LRU cache used by ENS profiles
import frameSubscribe from "./views/frame-subscribe.mjs";
import { sendNotification } from "./neynar.mjs";
import { timingSafeEqual } from "crypto";
import { invalidateActivityCaches } from "./cloudflarePurge.mjs";

const app = express();

//
// Always use HTTP for internal servers since SSL is terminated at the load balancer
const server = createHttpServer(app);

let cachedFeed = null;

// Enable compression for all responses
app.use(
  compression({
    // Set compression level (0-9, where 9 is maximum compression)
    level: 6,
    // Only compress responses larger than 10 KB
    threshold: 10 * 1024,
    // Don't compress responses that have the no-transform header
    filter: (req, res) => {
      if (res.getHeader("Content-Type")?.includes("image/")) {
        return false;
      }
      return compression.filter(req, res);
    },
  }),
);

app.set("etag", false);
app.use((req, res, next) => {
  res.setHeader("Last-Modified", new Date().toUTCString());
  next();
});

app.use(
  morgan(
    ':remote-addr - :remote-user ":method :url" :status ":referrer" ":user-agent"',
  ),
);
app.use(
  "/assets",
  express.static("src/public/assets", {
    setHeaders: (res, pathName) => {
      if (env.NODE_ENV === "production") {
        res.setHeader(
          "Cache-Control",
          "public, max-age=604800, s-maxage=604800, immutable, stale-while-revalidate=2592000",
        );
      }
    },
  }),
);

app.use(
  express.static("src/public", {
    setHeaders: (res, pathName) => {
      if (env.NODE_ENV !== "production") return;
      if (!/\/assets\//.test(pathName)) {
        res.setHeader(
          "Cache-Control",
          "public, max-age=86400, s-maxage=604800, immutable, stale-while-revalidate=2592000",
        );
      }
    },
  }),
);
app.use(express.json());
app.use(cookieParser());

// Route for Neynar notifications
app.post("/api/v1/neynar/notify", async (req, res) => {
  const apiKey = req.header("x-admin-key") || "";
  const adminKey = process.env.ADMIN_KEY || "";
  const apiKeyBuf = Buffer.from(apiKey);
  const adminKeyBuf = Buffer.from(adminKey);
  if (
    apiKeyBuf.length !== adminKeyBuf.length ||
    !timingSafeEqual(apiKeyBuf, adminKeyBuf)
  ) {
    return res.status(401).json({ status: "error", message: "Unauthorized" });
  }
  const { target_url, body, title } = req.body;
  if (!target_url || !body || !title) {
    return sendError(
      res,
      400,
      "Bad Request",
      "target_url and body, title required",
    );
  }
  try {
    const resp = await sendNotification(target_url, body, title);
    return res.json(resp);
  } catch (err) {
    return sendError(res, 500, "Internal Server Error", err.toString());
  }
});

// NOTE: We use s-maxage for Cloudflare CDN caching, while max-age controls browser caching
app.get("/.well-known/apple-app-site-association", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=86400, max-age=86400, stale-while-revalidate=600000",
  );
  res.json({
    webcredentials: {
      apps: ["SKFAD6UPBF.attestate.Kiwi-News-iOS"],
    },
    applinks: {
      apps: [],
      details: [
        {
          appIDs: ["SKFAD6UPBF.attestate.Kiwi-News-iOS"],
          components: [
            {
              "/": "/*",
              comment: "Matches all URLs",
            },
          ],
        },
      ],
    },
  });
});

let domain = "https://news.kiwistand.com";
let hostname, port;
if (env.CUSTOM_PROTOCOL && env.CUSTOM_HOST_NAME) {
  const [a, b] = env.CUSTOM_HOST_NAME.split(":");
  hostname = a;
  port = b;
  domain = `${env.CUSTOM_PROTOCOL}${hostname}`;
}
console.log(domain);
const accountAssociation = {
  "https://news.kiwistand.com": {
    header:
      "eyJmaWQiOjU3MDgsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHg5OTg5Y0ExMmVmRWY5ZjljRGE5NjQ1RTU0NDMyMzE4OTFDRjRGYjdhIn0",
    payload: "eyJkb21haW4iOiJuZXdzLmtpd2lzdGFuZC5jb20ifQ",
    signature:
      "MHhlYzA1NGU1NmE4Mjg2MTQ1NmI1M2RlN2VhNDM5MGM0NDQzMjQxN2U1OTcyNDc3NzNjYWQ2MzE4YmZhYzQwYzU2NmRhNTJjOWYyYmM1YzRiMTYxNDViMTk3MDVjZTY1Y2I2NzM5MTdlMGUxMjE1YWMwNWUzZmEzYThjNjdlOTZiNTFj",
  },
  "https://staging.kiwistand.com": {
    header:
      "eyJmaWQiOjU3MDgsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHg5OTg5Y0ExMmVmRWY5ZjljRGE5NjQ1RTU0NDMyMzE4OTFDRjRGYjdhIn0",
    payload: "eyJkb21haW4iOiJzdGFnaW5nLmtpd2lzdGFuZC5jb20ifQ",
    signature:
      "MHhhY2NjYWMwM2Y1YWQxN2ZiZDI3MjEzNmFjN2E1YzFkZWM0MmIzZjAwNjNkYjdhZDU0ZGY0NDhkNjMzMjNlNGM3MTNkZTg1MGM3ODA2YjNiMTlhY2U5MDdiMGFhNTZhNzE5NzkwZThlMWFhNDhlZjE2MzE4ZGM2NzlhM2IyN2QwZDFj",
  },
};

const frameName = {
  "https://news.kiwistand.com": "Kiwi News",
  "https://staging.kiwistand.com": "125135986987",
};

// Serve Farcaster Mini App manifest
app.get("/.well-known/farcaster.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.json({
    accountAssociation: accountAssociation[domain],
    frame: {
      version: "1",
      name: frameName[domain],
      iconUrl: `${domain}/pwa_icon.png`,
      homeUrl: `${domain}/?miniapp=true`,
      imageUrl: `${domain}/kiwi_top_feed_page.png`,
      buttonTitle: "🥝 Start",
      splashImageUrl: `${domain}/fc-splash.png`,
      splashBackgroundColor: "#0F3106",
      webhookUrl: env.NEYNAR_NOTIFICATIONS_WEBHOOK,
      primaryCategory: "news-media",
    },
  });
});

// Mini App landing page
app.get("/miniapp", async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=0");
  res
    .status(200)
    .type("text/html")
    .send(await frameSubscribe(theme));
});

function loadTheme(req, res, next) {
  res.locals.theme = theme;
  next();
}

app.use(loadTheme);

// NOTE: sendError and sendStatus are duplicated here (compare with
// /src/api.mjs) because eventually we wanna rip apart the Kiwi News website
// from the node software.
export function sendError(reply, code, message, details) {
  log(`http error: "${code}", "${message}", "${details}"`);
  return reply.status(code).json({
    status: "error",
    code,
    message,
    details,
  });
}

export function sendStatus(reply, code, message, details, data) {
  const obj = {
    status: "success",
    code,
    message,
    details,
  };
  if (data) obj.data = data;
  return reply.status(code).json(obj);
}

// Send an IPC message to all worker processes
export function sendToCluster(message) {
  if (!cluster.isPrimary) {
    // Workers can't send to other workers directly
    return;
  }

  log(`Sending IPC message to workers: ${message}`);

  // Send to all workers
  for (const id in cluster.workers) {
    cluster.workers[id].send(message);
  }
}

// Handle IPC messages from the primary process
export function handleClusterMessage(trie, recompute) {
  return (message) => {
    if (message === "recompute-new-feed") {
      log(`Worker ${process.pid} received recompute-new-feed message`);
      recompute(trie).catch((err) => {
        log(
          `Error in worker ${
            process.pid
          } recomputing new feed: ${err.toString()}`,
        );
      });
    }
  };
}

export async function launch(trie, libp2p, isPrimary = true) {
  // Store the original HTTP_PORT value to use as the base for all port calculations
  const originalPort = parseInt(env.HTTP_PORT);

  // Set up IPC message handling for worker processes
  if (!isPrimary && cluster.worker) {
    // Initialize registry at worker startup
    log(`Worker ${process.pid} initializing registry data...`);
    await registry.initialize();
    log(`Worker ${process.pid} registry initialized`);

    // Listen for messages from the primary process
    process.on("message", handleClusterMessage(trie, newAPI.recompute));
    log(`Worker ${process.pid} ready to receive IPC messages`);
  }

  try {
    cachedFeed = await feed(trie, theme, 0, null, undefined, undefined);
    log("Cached feed updated");
  } catch (err) {
    log("Failed to update cached feed: " + err);
    cachedFeed = null;
  }
  (function updateCachedFeed() {
    setTimeout(async () => {
      const startTime = Date.now();
      try {
        const newFeed = await feed(trie, theme, 0, null, undefined, undefined);
        cachedFeed = newFeed;
        const elapsed = Date.now() - startTime;
        log(`Cached feed updated in ${elapsed}ms`);
      } catch (err) {
        log("Failed to update cached feed: " + err);
        // Retain existing cachedFeed to avoid response delays.
      } finally {
        updateCachedFeed();
      }
    }, 30000);
  })();

  app.use((err, req, res, next) => {
    log(`Express error: "${err.message}", "${err.stack}"`);
    res.status(500).send("Internal Server Error");
  });

  // Initialize registry in primary process
  if (isPrimary && cluster.isPrimary) {
    log(`Primary process ${process.pid} initializing registry data...`);
    await registry.initialize();

    // Set port for primary process (originalPort + 1)
    const primaryPort = originalPort + 1;
    env.HTTP_PORT = primaryPort;

    log(`Primary launching on port ${env.HTTP_PORT}`);
    log(`Primary process ${process.pid} registry initialized`);
  }
  // If we're a worker, adjust the port
  else if (!isPrimary) {
    // Calculate worker's port offset based on original port
    const workerIndex = cluster.worker.id - 1;
    const workerPort = originalPort + 1 + workerIndex;

    // Override HTTP_PORT for this worker
    env.HTTP_PORT = workerPort;
    log(`Worker ${process.pid} using port ${workerPort}`);
  }

  // NOTE: If you're reading this as an external contributor, yes the
  // fingerprint.mjs file isn't distributed along with the other code because
  // we must not allow people to understand what the criteria are that cast a
  // requester a unique user. Users can control all aspects of a request, so if
  // we'd open source this functionality, users could game the request to
  // increase their ranking on the site.
  let fingerprint;
  try {
    fingerprint = await import("./fingerprint.mjs");
  } catch (err) {
    fingerprint = await import("./fingerprint_example.mjs");
  }
  function removeReferrerParams(link) {
    const url = new URL(link);
    if (url.hostname.endsWith("mirror.xyz")) {
      url.searchParams.delete("referrerAddress");
    } else if (
      url.hostname.endsWith("paragraph.xyz") ||
      url.hostname.endsWith("zora.co") ||
      url.hostname.endsWith("manifold.xyz")
    ) {
      url.searchParams.delete("referrer");
    } else if (url.hostname.endsWith("foundation.app")) {
      url.searchParams.delete("ref");
    }
    return url.toString();
  }

  app.get("/redirect/:index", (req, res) => {
    let sub;
    try {
      sub = getSubmission(req.params.index);
    } catch {
      return res.status(404).send("Not found");
    }
    // record outbound fingerprint
    const hash = fingerprint.generate(req);
    trackOutbound(sub.href, hash);
    // immediate redirect
    res.redirect(302, sub.href);
  });
  app.post("/outbound", async (request, reply) => {
    reply.header("Cache-Control", "no-cache");
    const { url } = request.query;
    if (!url) {
      return reply.status(400).send("URL parameter is required");
    }
    if (!fingerprint) {
      return reply.redirect(url);
    }

    const hash = fingerprint.generate(request);
    const cleanUrl = removeReferrerParams(url);
    trackOutbound(cleanUrl, hash);
    return reply.status(204).send();
  });

  app.post("/impression", async (request, reply) => {
    reply.header("Cache-Control", "no-cache");
    const { url } = request.query;
    if (!url) {
      return reply.status(400).send("URL parameter is required");
    }
    if (!fingerprint) {
      return reply.status(204).send();
    }

    const hash = fingerprint.generate(request);
    const cleanUrl = removeReferrerParams(url);
    trackImpression(cleanUrl, hash);
    return reply.status(204).send();
  });
  // Disabled GET outbound tracking due to spam abuse - POST still works for sendBeacon
  app.get("/outbound", async (request, reply) => {
    reply.header("Cache-Control", "no-cache");
    return reply.status(404).send("GET outbound tracking disabled");
  });
  app.get("/kiwipass-mint", async (request, reply) => {
    reply.header(
      "Cache-Control",
      "public, s-maxage=86400, max-age=0, stale-while-revalidate=604800",
    );
    return reply
      .status(200)
      .type("text/html")
      .send(await kiwipassmint(reply.locals.theme));
  });
  app.post("/api/v1/search", async (req, reply) => {
    let response;
    try {
      const apiUrl = "https://knsearch.x4901.xyz/api/v1/search";
      const requestOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "X-API-Key": process.env.KN_SEARCH_API_KEY,
        },
        body: JSON.stringify({
          query: req.body.query,
          sort: "popularity",
        }),
      };
      response = await fetch(apiUrl, requestOptions);
    } catch (error) {
      const code = 500;
      const httpMessage = "Internal Server Error";
      const details = "Failed to connect to search service";
      return sendError(reply, code, httpMessage, details);
    }

    if (!response.ok) {
      const code = response.status;
      const httpMessage = "Search Request Failed";
      const details = `Search service responded with status ${response.status}`;
      return sendError(reply, code, httpMessage, details);
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      const code = 500;
      const httpMessage = "Internal Server Error";
      const details = "Failed to parse search results";
      return sendError(reply, code, httpMessage, details);
    }

    const code = 200;
    const httpMessage = "OK";
    const details = "Search completed successfully";
    return sendStatus(reply, code, httpMessage, details, data);
  });

  // Endpoint for clearing profile-specific caches
  app.get("/api/v1/cache/profile", async (req, res) => {
    const { address: rawAddress } = req.query;

    if (!rawAddress) {
      return sendError(
        res,
        400,
        "Bad Request",
        "Address query parameter is required.",
      );
    }

    let address;
    try {
      address = utils.getAddress(rawAddress); // Validates and normalizes
    } catch (err) {
      return sendError(
        res,
        400,
        "Bad Request",
        `Invalid Ethereum address provided: ${rawAddress}`,
      );
    }

    let lruProfileHandled = false; // Tracks if the LRU operation was attempted without throwing an error
    let lruProfileExistedAndCleared = false; // Tracks if the item was actually found and deleted

    let fsCacheEntriesProcessed = 0;
    let fsCacheErrors = [];

    // 1. Clear processed ENS profile from LRU Cache
    const ensProfileLruKey = `${ENS_CACHE_PREFIX}${address.toLowerCase()}`;
    try {
      if (appCache.has(ensProfileLruKey)) {
        appCache.delete(ensProfileLruKey);
        log(`Cleared ENS profile from LRU cache for key: ${ensProfileLruKey}`);
        lruProfileExistedAndCleared = true;
      } else {
        log(
          `ENS profile key not found in LRU cache (no action needed): ${ensProfileLruKey}`,
        );
      }
      lruProfileHandled = true;
    } catch (err) {
      log(
        `Error during ENS profile LRU cache operation for key ${ensProfileLruKey}: ${err.toString()}`,
      );
      // lruProfileHandled remains false
    }

    // 2. Clear related raw data from FileSystemCache
    const fsHttpCache = new FileSystemCache({
      cacheDirectory: path.resolve(env.CACHE_DIR),
    });

    const potentialEnsDataUrls = [];
    potentialEnsDataUrls.push(`https://ensdata.net/${address}?farcaster=true`);
    if (env.ENSDATA_KEY) {
      potentialEnsDataUrls.push(
        `https://ensdata.net/${env.ENSDATA_KEY}/${address}?farcaster=true`,
      );
    }

    for (const urlToClear of potentialEnsDataUrls) {
      try {
        const fsCacheKey = getCacheKey(urlToClear);
        await fsHttpCache.remove(fsCacheKey);
        log(
          `Processed removal from FileSystemCache for URL: ${urlToClear} (key: ${fsCacheKey})`,
        );
        fsCacheEntriesProcessed++;
      } catch (err) {
        const errorMsg = `Failed to process FileSystemCache removal for URL ${urlToClear}: ${err.toString()}`;
        log(errorMsg);
        fsCacheErrors.push(errorMsg);
      }
    }

    let responseStatus = 200;
    let responseMessage = "Profile cache clearing process completed.";
    let responseDetails = `LRU Profile Cache for ${address}: `;

    if (lruProfileHandled) {
      responseDetails += lruProfileExistedAndCleared
        ? "Cleared. "
        : "Was not present. ";
    } else {
      responseDetails += "Error during operation. ";
      responseStatus = 500;
      responseMessage =
        "Profile cache clearing encountered critical issues with LRU cache.";
    }

    responseDetails += `FileSystemCache for ${address}-related URLs: ${fsCacheEntriesProcessed} entries processed.`;
    if (fsCacheErrors.length > 0) {
      responseDetails += ` FS Cache Issues: ${fsCacheErrors.join("; ")}`;
      // If LRU was fine but FS had errors, status remains 200 but with error details.
    }

    if (responseStatus === 200) {
      return sendStatus(
        res,
        responseStatus,
        responseMessage,
        responseDetails.trim(),
      );
    } else {
      return sendError(
        res,
        responseStatus,
        responseMessage,
        responseDetails.trim(),
      );
    }
  });

  app.delete("/api/v1/cache", async (req, res) => {
    const { url } = req.body;

    if (!url) {
      const code = 400;
      const message = "Invalid request";
      const details = "URL required";
      return sendError(res, code, message, details);
    }

    const cache = new FileSystemCache({
      cacheDirectory: path.resolve(env.CACHE_DIR),
    });

    try {
      const key = getCacheKey(url);
      await cache.remove(key);

      const code = 200;
      const message = "Cache entry removed";
      const details = "Successfully removed cache entry";
      return sendStatus(res, code, message, details);
    } catch (err) {
      const code = 500;
      const message = "Cache removal failed";
      return sendError(res, code, message);
    }
  });
  app.get("/unsubscribe/:secret", async (req, res) => {
    const { secret } = req.params;

    try {
      const success = await email.unsubscribe(secret);
      if (!success) {
        return res.status(404).send("Invalid or expired unsubscribe link");
      }

      res.send(`
       <html>
         <body>
           <h1>Unsubscribed</h1>
           <p>You have been successfully unsubscribed from notifications.</p>
         </body>
       </html>
     `);
    } catch (err) {
      console.error("Unsubscribe error:", err);
      res.status(500).send("Error processing unsubscribe request");
    }
  });

  app.post("/api/v1/email-notifications", async (request, reply) => {
    const message = request.body;
    const testExpr = /.+@.+\..+/;

    if (!message || message.type !== "EMAILAUTH") {
      return sendError(reply, 400, "Bad Request", "Invalid message type");
    }

    if (message.title === message.href && !testExpr.test(message.title)) {
      return sendError(
        reply,
        400,
        "Bad Request",
        "Title and href must be emails and the same",
      );
    }
    const userEmail = message.title;

    try {
      const identity = await email.validate(message);
      await email.addSubscription(identity, userEmail);

      const code = 200;
      const httpMessage = "OK";
      const details = "Successfully subscribed to email notifications";
      return sendStatus(reply, code, httpMessage, details);
    } catch (err) {
      const code = 500;
      const httpMessage = "Internal Server Error";
      const details = err.toString();
      return sendError(reply, code, httpMessage, details);
    }
  });

  app.post("/api/v1/telegram", async (request, reply) => {
    const message = request.body;
    // NOTE: The message here is ALMOST a compliant Kiwi News amplify or
    // comment message just to not having to implement an entirely new
    // validation flow for signing and validating a message. However, we
    // wouldn't want this message to be circulated on the protocol and so we
    // intentionally set all properties to TGAUTH.
    if (
      !message ||
      message.title !== "TGAUTH" ||
      message.href !== "TGAUTH" ||
      message.type !== "TGAUTH"
    ) {
      const code = 400;
      const httpMessage = "Bad Request";
      const details = "Body must include title and href with value 'TGAUTH'.";
      return sendError(reply, code, httpMessage, details);
    }
    let inviteLink;
    try {
      inviteLink = await telegram.generateLink(message);
    } catch (err) {
      const code = 400;
      const httpMessage = "Bad Request";
      const details = err.toString();
      return sendError(reply, code, httpMessage, details);
    }
    const code = 200;
    const httpMessage = "OK";
    const details = "Successfully generated Telegram link.";
    return sendStatus(reply, code, httpMessage, details, { link: inviteLink });
  });
  app.post("/api/v1/subscriptions/:address", async (request, reply) => {
    function isValidWebPushSubscription(subscription) {
      if (!subscription || typeof subscription !== "object") {
        return false;
      }

      const { endpoint, keys } = subscription;

      if (!endpoint || typeof endpoint !== "string") {
        return false;
      }

      if (!keys || typeof keys !== "object" || !keys.p256dh || !keys.auth) {
        return false;
      }

      return true;
    }
    reply.header("Cache-Control", "no-cache");

    let address;
    try {
      address = utils.getAddress(request.params.address);
    } catch (err) {
      const code = 400;
      const httpMessage = "Bad Request";
      const details =
        "Please only submit subscription along with a valid Ethereum addresses.";
      reply.header("Cache-Control", "public, max-age=0,  must-revalidate");
      return sendError(reply, code, httpMessage, details);
    }

    if (!isValidWebPushSubscription(request.body)) {
      const code = 400;
      const httpMessage = "Bad Request";
      const details = "Error storing subscription";
      reply.header("Cache-Control", "public, max-age=0, must-revalidate");
      return sendError(reply, code, httpMessage, details);
    }

    try {
      subscriptions.store(address, request.body);
    } catch (err) {
      const code = 500;
      const httpMessage = "Internal Server Error";
      const details = "Error storing subscription";
      reply.header("Cache-Control", "public, max-age=0, must-revalidate");
      return sendError(reply, code, httpMessage, details);
    }

    const code = 200;
    const httpMessage = "OK";
    const details = "Successfully subscribed via push notifications";
    return sendStatus(reply, code, httpMessage, details);
  });
  app.get("/api/v1/metadata", async (request, reply) => {
    reply.header("Cache-Control", "no-cache");

    let data;
    try {
      data = await metadata(
        request.query.url,
        request.query.generateTitle === "true",
      );
    } catch (err) {
      log(`parser.metadata failure: ${err.stack}`);
      const code = 500;
      const httpMessage = "Internal Server Error";
      const details = "Failed to parse link metadata";
      return sendError(reply, code, httpMessage, details);
    }
    const code = 200;
    const httpMessage = "OK";
    const details = "Downloaded and parsed URL's metadata";
    return sendStatus(reply, code, httpMessage, details, data);
  });
  app.get("/api/v1/price", async (request, reply) => {
    reply.header("Cache-Control", "no-cache");
    const mints = await registry.mints();
    const value = await price.getPrice(mints);
    const code = 200;
    const httpMessage = "OK";
    const details = "Calculated current price";
    return sendStatus(reply, code, httpMessage, details, {
      price: value.price.toString(),
    });
  });
  app.get("/api/v1/parse", async (request, reply) => {
    const embed = await parse(request.query.url);
    reply.header("Cache-Control", "no-cache");
    return reply.status(200).type("text/html").send(embed);
  });
  app.get("/api/v1/karma/:address", async (request, reply) => {
    let address;
    try {
      address = utils.getAddress(request.params.address);
    } catch (err) {
      const code = 400;
      const httpMessage = "Bad Request";
      const details = "Please only submit valid Ethereum addresses.";
      reply.header("Cache-Control", "public, max-age=0, must-revalidate");
      return sendError(reply, code, httpMessage, details);
    }

    const points = karma.resolve(address);
    const code = 200;
    const httpMessage = "OK";
    const details = `Karma`;
    // Keep cache time low but allow longer stale-while-revalidate for better performance
    reply.header(
      "Cache-Control",
      "public, s-maxage=300, max-age=0, stale-while-revalidate=86400",
    );
    return sendStatus(reply, code, httpMessage, details, {
      address,
      karma: points,
    });
  });
  app.get("/api/v1/feeds/:name", async (request, reply) => {
    let stories = [];
    if (request.params.name === "hot") {
      let page = parseInt(request.query.page);
      if (isNaN(page) || page < 1) {
        page = 0;
      }

      let results;
      const domain = undefined;
      const lookback = sub(new Date(), {
        weeks: 3,
      });
      const paginate = false;
      const showAd = false;
      const showContest = false;
      const appCuration = request.query.curation === "true";
      try {
        results = await index(
          trie,
          page,
          domain,
          lookback,
          paginate,
          showAd,
          showContest,
          appCuration,
        );
      } catch (err) {
        log(`Error in api/v1/feeds/hot: ${err.stack}`);
      }
      reply.header(
        "Cache-Control",
        "public, s-maxage=20, max-age=0,  must-revalidate, stale-while-revalidate=86400",
      );
      stories = results.stories;
    } else if (request.params.name === "new") {
      reply.header("Cache-Control", "no-cache");

      try {
        stories = newAPI.getStories();
      } catch (err) {
        log(`Error in api/v1/feeds/new: ${err.stack}`);
      }
    } else if (request.params.name === "best") {
      reply.header(
        "Cache-Control",
        "public, s-maxage=3600, max-age=0, must-revalidate, stale-while-revalidate=86400",
      );

      let page = parseInt(request.query.page);
      if (isNaN(page) || page < 1) {
        page = 0;
      }

      const periodValues = ["all", "year", "month", "week", "day"];
      let { period } = request.query;
      if (!period || !periodValues.includes(period)) {
        period = "week";
      }

      try {
        stories = await bestAPI.getStories(
          trie,
          page,
          period,
          request.query.domain,
        );
      } catch (err) {
        log(`error in /api/v1/feeds/best: ${err.stack}`);
      }
    } else {
      const code = 501;
      const httpMessage = "Not Implemented";
      const details =
        "We currently don't implement any other endpoint but 'hot' and 'new'";
      reply.header("Cache-Control", "public, max-age=0, must-revalidate");
      return sendError(reply, code, httpMessage, details);
    }

    const code = 200;
    const httpMessage = "OK";
    const details = `${request.params.name} feed`;
    return sendStatus(reply, code, httpMessage, details, { stories });
  });

  app.get("/api/v1/profile/:address", async (request, reply) => {
    let address;
    try {
      address = utils.getAddress(request.params.address);
    } catch (err) {
      return sendError(
        reply,
        400,
        "Bad Request",
        "Invalid Ethereum address provided.",
      );
    }

    try {
      // Use the existing ens.resolve function from src/ens.mjs
      const profile = await ens.resolve(address);

      // ens.resolve returns a minimal profile immediately and fetches
      // full data in the background. The minimal profile is sufficient
      // for optimistic updates. If it had an error structure, handle it.
      if (profile && profile.error) {
        // Use 404 for consistency with how ens.resolve handles errors internally
        return sendError(
          reply,
          404,
          "Not Found",
          profile.message || "Failed to resolve profile.",
        );
      }

      // Set long caching headers:
      // s-maxage=86400 (1 day) for CDN
      // max-age=3600 (1 hour) for browser
      // stale-while-revalidate=604800 (7 days) allows serving stale while revalidating
      reply.header(
        "Cache-Control",
        "public, s-maxage=86400, max-age=3600, stale-while-revalidate=604800",
      );
      return sendStatus(
        reply,
        200,
        "OK",
        "Profile resolved successfully",
        profile,
      );
    } catch (err) {
      // Catch unexpected errors during the resolution process
      log(`Error resolving profile for ${address}: ${err}`);
      return sendError(
        reply,
        500,
        "Internal Server Error",
        "Failed to resolve profile data.",
      );
    }
  });

  app.get("/api/v1/stories", async (request, reply) => {
    let submission;

    const index = request.query.index;
    try {
      submission = getSubmission(index);
    } catch (e) {
      log(`/api/v1/stories: Error in getSubmission: ${err.stack}`);
      const code = 404;
      const httpMessage = "Not Found";
      const details = "Couldn't find the submission";
      return sendError(reply, code, httpMessage, details);
    }

    const identities = new Set();
    submission.comments.forEach((comment) => {
      identities.add(comment.identity);
      comment.reactions.forEach((reaction) => {
        reaction.reactors.forEach((reactor) => identities.add(reactor));
      });
    });

    const profileResults = await Promise.allSettled(
      Array.from(identities).map((id) => resolve(id)),
    );

    const profiles = Object.fromEntries(
      Array.from(identities).map((id, i) => [
        id,
        profileResults[i].status === "fulfilled"
          ? profileResults[i].value
          : null,
      ]),
    );

    const enrichedComments = submission.comments.map((comment) => ({
      ...comment,
      identity: profiles[comment.identity],
      reactions: comment.reactions.map((reaction) => ({
        ...reaction,
        reactorProfiles: reaction.reactors
          .map((reactor) => profiles[reactor])
          .filter(Boolean),
      })),
    }));

    reply.header(
      "Cache-Control",
      "public, s-maxage=86400, max-age=0, stale-while-revalidate=31536000",
    );
    const code = 200;
    const httpMessage = "OK";
    const details = "Responding with story queried by index";
    return sendStatus(reply, code, httpMessage, details, {
      ...submission,
      comments: enrichedComments,
    });
  });

  app.get("/gateway", async (request, reply) => {
    let referral;
    try {
      referral = utils.getAddress(request.query.referral);
    } catch (err) {
      //noop
    }

    reply.header(
      "Cache-Control",
      "public, s-maxage=86400, max-age=0, stale-while-revalidate=259200",
    );
    return reply
      .status(200)
      .type("text/html")
      .send(await gateway(referral));
  });

  app.get("/", async (request, reply) => {
    let identity, hash;
    if (request.query.custom === "true") {
      hash = fingerprint.generate(request);
    }

    try {
      identity = utils.getAddress(request.query.identity);
      hash = fingerprint.generate(request);
    } catch (err) {}

    let page = parseInt(request.query.page);
    if (isNaN(page) || page < 1) {
      page = 0;
    }

    let content;
    try {
      if (
        !request.query.page &&
        !request.query.domain &&
        !request.query.identity &&
        !request.query.hash &&
        request.query.custom !== "true" &&
        cachedFeed
      ) {
        content = cachedFeed;
      } else {
        content = await feed(
          trie,
          reply.locals.theme,
          page,
          DOMPurify.sanitize(request.query.domain),
          identity,
          hash,
        );
        cachedFeed = content;
      }
    } catch (err) {
      log(`Error in /: ${err.stack}`);
      return reply.status(500).send("Internal Server Error");
    }
    reply.header(
      "Cache-Control",
      "public, s-maxage=20, max-age=0, stale-while-revalidate=86400",
    );
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/stories/:slug?", async (request, reply) => {
    let referral;
    try {
      referral = utils.getAddress(request.query.referral);
    } catch (err) {}

    let submission;
    try {
      submission = await generateStory(request.query.index);
    } catch (err) {
      return reply.status(404).type("text/plain").send(err.message);
    }

    const expectedSlug = getSlug(submission.title);
    if (request.params.slug !== expectedSlug) {
      const qp = new URLSearchParams(request.query);
      qp.delete("t");
      const queryParams = qp.toString();
      return reply.redirect(308, `/stories/${expectedSlug}?${queryParams}`);
    }

    const hexIndex = request.query.index.substring(2);
    const content = await story(
      trie,
      reply.locals.theme,
      DOMPurify.sanitize(hexIndex),
      submission,
      referral,
    );
    reply.header(
      "Cache-Control",
      "public, s-maxage=86400, max-age=0, stale-while-revalidate=31536000",
    );
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/new", async (request, reply) => {
    const content = await newest(trie, reply.locals.theme);
    let timestamp;

    // NOTE: Especially for international customers /new got embarassingly slow
    // taking up to 2s to load as the page had to served previously from
    // Germany and not via Cloudflare. Now when the `cached` QS is present
    // we'll allow this page to be cached. We'll only use this configuration
    // when the user visits the new page looking for new content, not right
    // after submission.
    if (request.query.cached) {
      reply.header(
        "Cache-Control",
        "public, s-maxage=3600, max-age=0, stale-while-revalidate=86400",
      );
    } else {
      reply.header("Cache-Control", "no-cache");
    }

    return reply.status(200).type("text/html").send(content);
  });
  app.get("/best", async (request, reply) => {
    let page = parseInt(request.query.page);
    if (isNaN(page) || page < 1) {
      page = 0;
    }

    const periodValues = ["all", "year", "month", "week", "day"];
    let { period } = request.query;
    if (!period || !periodValues.includes(period)) {
      period = "week";
    }

    let content;
    try {
      content = await best(
        trie,
        reply.locals.theme,
        page,
        period,
        DOMPurify.sanitize(request.query.domain),
      );
    } catch (err) {
      log(`Error rendering /best ${err.stack}`);
      return reply.status(500).send("Internal Server Error");
    }

    reply.header(
      "Cache-Control",
      "public, s-maxage=3600, max-age=0, stale-while-revalidate=2592000",
    );
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/community", async (request, reply) => {
    const content = await community(trie, reply.locals.theme, request.query);

    reply.header(
      "Cache-Control",
      "public, s-maxage=86400, max-age=0, stale-while-revalidate=604800",
    );
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/price", async (request, reply) => {
    const content = await price.chart(reply.locals.theme);
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/users", async (request, reply) => {
    const content = await users(trie, reply.locals.theme);
    reply.header(
      "Cache-Control",
      "public, max-age=0, no-transform, must-revalidate, stale-while-revalidate=120",
    );
    return reply.status(200).type("text/html").send(content);
  });

  app.get("/basics", async (request, reply) => {
    const content = await basics(trie, reply.locals.theme);
    reply.header(
      "Cache-Control",
      "public, max-age=0, no-transform, must-revalidate, stale-while-revalidate=120",
    );
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/stats", async (request, reply) => {
    const content = await stats(trie, reply.locals.theme);
    reply.header(
      "Cache-Control",
      "public, max-age=0, no-transform, must-revalidate, stale-while-revalidate=120",
    );
    return reply.status(200).type("text/html").send(content);
  });

  app.get("/app-onboarding", async (request, reply) => {
    const content = await appOnboarding(reply.locals.theme);

    reply.header(
      "Cache-Control",
      "public, s-maxage=86400, max-age=0, stale-while-revalidate=600000",
    );
    return reply.status(200).type("text/html").send(content);
  });

  app.get("/app-testflight", async (request, reply) => {
    const content = await appTestflight(reply.locals.theme);

    reply.header(
      "Cache-Control",
      "public, s-maxage=86400, max-age=0, stale-while-revalidate=600000",
    );
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/notifications", async (request, reply) => {
    const content = await notifications(reply.locals.theme);

    reply.header("Cache-Control", "public, max-age=0");
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/demonstration", async (request, reply) => {
    const content = await demonstration(reply.locals.theme);

    reply.header(
      "Cache-Control",
      "public, s-maxage=86400, max-age=0, stale-while-revalidate=600000",
    );
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/email-notifications", async (request, reply) => {
    reply.header(
      "Cache-Control",
      "public, s-maxage=86400, max-age=0, stale-while-revalidate=600000",
    );
    return reply
      .status(200)
      .type("text/html")
      .send(await emailNotifications(reply.locals.theme));
  });
  app.get("/invite", async (request, reply) => {
    const content = await invite(reply.locals.theme);

    reply.header(
      "Cache-Control",
      "public, s-maxage=86400, max-age=0, stale-while-revalidate=600000",
    );
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/indexing", async (request, reply) => {
    const content = await indexing(reply.locals.theme);

    reply.header(
      "Cache-Control",
      "public, s-maxage=86400, max-age=0, stale-while-revalidate=600000",
    );
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/start", async (request, reply) => {
    const content = await start(reply.locals.theme);

    reply.header(
      "Cache-Control",
      "public, s-maxage=86400, max-age=0, stale-while-revalidate=600000",
    );
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/api/v1/activity", async (request, reply) => {
    if (!request.query.address) {
      const code = 400;
      const httpMessage = "Bad Request";
      return sendError(
        reply,
        code,
        httpMessage,
        "Address query parameter required",
      );
    }

    let data;
    const skipDetails = true;
    try {
      data = await activity.data(
        trie,
        DOMPurify.sanitize(request.query.address),
        parseInt(request.query.lastUpdate, 10),
        skipDetails,
      );
    } catch (err) {
      log(`Error getting activity data: ${err.stack}`);
      const code = 400;
      const httpMessage = "Bad Request";
      return sendError(reply, code, httpMessage, "Invalid query parameters");
    }
    const code = 200;
    const httpMessage = "OK";
    const details = "Notifications feed";

    reply.header(
      "Cache-Control",
      "public, s-maxage=86400, max-age=0, stale-while-revalidate=604800",
    );
    return sendStatus(reply, code, httpMessage, details, {
      notifications: data.notifications,
      lastServerValue: data.latestValue,
    });
  });

  app.get("/activity", async (request, reply) => {
    // Query param version - cacheable, no cookies
    if (request.query.address) {
      let data;
      try {
        data = await activity.data(
          trie,
          DOMPurify.sanitize(request.query.address),
          parseInt(request.query.lastUpdate, 10),
        );
      } catch (err) {
        return reply.status(400).type("text/plain").send(err.toString());
      }

      const content = await activity.page(
        reply.locals.theme,
        DOMPurify.sanitize(request.query.address),
        data.notifications,
        parseInt(request.query.lastUpdate, 10),
        true, // isQueryParamVersion
      );

      reply.header(
        "Cache-Control",
        "public, s-maxage=86400, max-age=0, stale-while-revalidate=604800",
      );
      return reply.status(200).type("text/html").send(content);
    }

    // Cookie version - not cacheable
    const address = request.cookies.identity;
    if (!address) {
      return reply.redirect(301, `/gateway`);
    }

    let data;
    try {
      data = await activity.data(
        trie,
        DOMPurify.sanitize(address),
        parseInt(request.cookies.lastUpdate, 10),
      );
    } catch (err) {
      return reply.status(400).type("text/plain").send(err.toString());
    }

    const content = await activity.page(
      reply.locals.theme,
      DOMPurify.sanitize(address),
      data.notifications,
      parseInt(request.cookies.lastUpdate, 10),
      false,
    );

    if (data && data.lastUpdate) {
      reply.cookie("lastUpdate", data.lastUpdate, {
        maxAge: 60 * 60 * 24 * 7 * 1000,
      });
    }
    reply.header("Cache-Control", "no-cache");
    return reply.status(200).type("text/html").send(content);
  });
  app.get("/privacy-policy", async (request, reply) => {
    reply.header(
      "Cache-Control",
      "public, s-maxage=86400, max-age=0, stale-while-revalidate=600000",
    );
    return reply
      .status(200)
      .type("text/html")
      .send(await privacy(reply.locals.theme));
  });
  app.get("/guidelines", async (request, reply) => {
    reply.header(
      "Cache-Control",
      "public, s-maxage=86400, max-age=0, stale-while-revalidate=600000",
    );
    return reply
      .status(200)
      .type("text/html")
      .send(await guidelines(reply.locals.theme));
  });
  app.get("/onboarding", async (request, reply) => {
    reply.header(
      "Cache-Control",
      "public, s-maxage=3600, max-age=0, stale-while-revalidate=864000",
    );
    return reply
      .status(200)
      .type("text/html")
      .send(
        await onboarding(
          reply.locals.theme,
          DOMPurify.sanitize(request.cookies.identity),
        ),
      );
  });
  app.get("/whattosubmit", async (request, reply) => {
    reply.header(
      "Cache-Control",
      "public, s-maxage=86400, max-age=0, stale-while-revalidate=600000",
    );
    return reply
      .status(200)
      .type("text/html")
      .send(await whattosubmit(reply.locals.theme));
  });
  app.get("/referral", async (request, reply) => {
    reply.header(
      "Cache-Control",
      "public, s-maxage=3600, max-age=0, stale-while-revalidate=864000",
    );
    return reply
      .status(200)
      .type("text/html")
      .send(await referral(reply.locals.theme));
  });
  app.get("/onboarding-reader", async (request, reply) => {
    reply.header(
      "Cache-Control",
      "public, s-maxage=3600, max-age=0, stale-while-revalidate=864000",
    );
    return reply
      .status(200)
      .type("text/html")
      .send(
        await onboardingReader(
          reply.locals.theme,
          DOMPurify.sanitize(request.cookies.identity),
        ),
      );
  });
  app.get("/onboarding-curator", async (request, reply) => {
    reply.header(
      "Cache-Control",
      "public, s-maxage=3600, max-age=0, stale-while-revalidate=864000",
    );
    return reply
      .status(200)
      .type("text/html")
      .send(
        await onboardingCurator(
          reply.locals.theme,
          DOMPurify.sanitize(request.cookies.identity),
        ),
      );
  });
  app.get("/onboarding-submitter", async (request, reply) => {
    reply.header(
      "Cache-Control",
      "public, s-maxage=3600, max-age=0, stale-while-revalidate=864000",
    );
    return reply
      .status(200)
      .type("text/html")
      .send(
        await onboardingSubmitter(
          reply.locals.theme,
          DOMPurify.sanitize(request.cookies.identity),
        ),
      );
  });
  app.get("/shortcut", async (request, reply) => {
    reply.header(
      "Cache-Control",
      "public, s-maxage=86400, max-age=0, stale-while-revalidate=600000",
    );
    return reply
      .status(200)
      .type("text/html")
      .send(await shortcut(reply.locals.theme));
  });

  async function getProfile(
    trie,
    theme,
    address,
    enabledFrame = false,
  ) {
    const content = await upvotes(
      trie,
      theme,
      address,
    );
    return content;
  }
  app.get("/profile", async (request, reply) => {
    if (!utils.isAddress(request.cookies.identity)) {
      // NOTE: We redirect to community in case the user isn't logged in
      return reply.redirect(301, `/gateway`);
    }
    return reply.redirect(301, `/upvotes?address=${request.cookies.identity}`);
  });
  app.get("/upvotes", async (request, reply) => {
    if (!utils.isAddress(request.query.address)) {
      return reply
        .status(404)
        .type("text/plain")
        .send("No valid Ethereum address");
    }

    const content = await getProfile(
      trie,
      reply.locals.theme,
      request.query.address,
    );

    reply.header(
      "Cache-Control",
      "public, s-maxage=86400, max-age=0, stale-while-revalidate=259200",
    );

    return reply.status(200).type("text/html").send(content);
  });

  app.get("/submit", async (request, reply) => {
    // Check if the 'identity' cookie exists and is a valid address
    // if (!utils.isAddress(request.cookies.identity)) {
    //   // If not, redirect to /gateway
    //   return reply.redirect(301, `/gateway`);
    // }

    const { url, title } = request.query;
    const content = await submit(
      reply.locals.theme,
      DOMPurify.sanitize(url),
      DOMPurify.sanitize(title),
    );

    if (url || title) {
      reply.header(
        "Cache-Control",
        "public, s-maxage=18000, max-age=0, must-revalidate",
      );
    } else {
      // NOTE: If url and title aren't present
      reply.header(
        "Cache-Control",
        "public, s-maxage=86400, max-age=0, stale-while-revalidate=600000",
      );
    }

    return reply.status(200).type("text/html").send(content);
  });
  app.get("/*", async (request, reply, next) => {
    const name = request.params[0];
    if (!name.endsWith(".eth")) {
      return next();
    }
    let address;
    try {
      address = await toAddress(name);
    } catch (err) {
      if (err.toString().includes("Couldn't convert to address")) {
        return reply
          .status(404)
          .type("text/plain")
          .send("ENS address wasn't found.");
      }
      log(err.toString());
      return next(err);
    }
    let content;
    try {
      content = await getProfile(
        trie,
        reply.locals.theme,
        address,
        request.query.frame === "true",
      );
    } catch (err) {
      return next(err);
    }

    // For ENS profiles, use simplified caching strategy
    reply.header(
      "Cache-Control",
      "public, s-maxage=43200, max-age=0, stale-while-revalidate=432000",
    );
    return reply.status(200).type("text/html").send(content);
  });

  app.get("/search", async (request, reply) => {
    const query = request.query.q || "";
    const content = await search(reply.locals.theme, query);
    reply.header("Cache-Control", "no-cache");
    return reply.status(200).type("text/html").send(content);
  });

  app.post("/api/v1/faucet", async (request, reply) => {
    reply.header("Cache-Control", "no-cache");
    return handleFaucetRequest(request, reply);
  });

  app.post("/api/v1/miniapp-upvote", async (request, reply) => {
    reply.header("Cache-Control", "no-cache");
    
    const message = request.body;
    
    // Validate mini app signature format
    if (!message.signature || !message.signature.startsWith("miniapp:")) {
      return sendError(reply, 400, "Invalid Signature", "Invalid mini app signature format");
    }
    
    const fid = message.signature.replace("miniapp:", "");
    if (!/^\d+$/.test(fid)) {
      return sendError(reply, 400, "Invalid FID", "Invalid FID in signature");
    }
    
    // Validate message structure
    if (!message.title || !message.href || !message.timestamp || !message.walletAddress) {
      return sendError(reply, 400, "Invalid Message", "Missing required message fields");
    }
    
    // Validate wallet address format
    if (!message.walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return sendError(reply, 400, "Invalid Wallet", "Invalid Ethereum wallet address format");
    }
    
    try {
      // Store mini app upvote with wallet address as identity
      await storeMiniAppUpvote({
        fid: parseInt(fid, 10),
        href: message.href,
        title: message.title,
        timestamp: message.timestamp,
        walletAddress: message.walletAddress,
      });
      
      // Trigger feed recomputation (same as protocol upvotes)
      sendToCluster("recompute-new-feed");
      setImmediate(() => {
        newAPI
          .recompute()
          .catch((err) => log(`Recomputation of new feed failed after mini app upvote`));
      });
      
      // Invalidate activity caches for story author (same as protocol upvotes)
      invalidateActivityCaches({
        type: "amplify",
        href: message.href,
        title: message.title,
        timestamp: message.timestamp,
        identity: message.walletAddress
      });
      
      return sendStatus(reply, 200, "OK", "Mini app upvote recorded successfully");
    } catch (error) {
      log(`Mini app upvote error: ${error.message}`);
      return sendError(reply, 500, "Internal Server Error", error.message);
    }
  });

  app.get("/api/v1/image-upload-token", async (request, reply) => {
    reply.header("Cache-Control", "no-cache");

    // Check if we have the required environment variables
    if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
      log(
        `Missing required environment variables: CF_API_TOKEN or CF_ACCOUNT_ID`,
      );
      const code = 500;
      const httpMessage = "Internal Server Error";
      const details = "Missing Cloudflare API credentials";
      return sendError(reply, code, httpMessage, details);
    }

    // Create Cloudflare client
    let client;
    try {
      client = new Cloudflare({
        apiToken: env.CF_API_TOKEN,
      });
      log(
        `Successfully created Cloudflare client for account ID: ${env.CF_ACCOUNT_ID}`,
      );
    } catch (err) {
      log(`Error creating Cloudflare client: ${err.toString()}`);
      const code = 500;
      const httpMessage = "Internal Server Error";
      const details = "Failed to initialize Cloudflare client";
      return sendError(reply, code, httpMessage, details);
    }

    // Request a direct upload URL
    let directUpload;
    try {
      directUpload = await client.images.v2.directUploads.create({
        account_id: env.CF_ACCOUNT_ID,
      });
      log(`Successfully requested direct upload URL from Cloudflare`);
    } catch (err) {
      log(`Error requesting direct upload URL: ${err.toString()}`);
      const code = 500;
      const httpMessage = "Internal Server Error";
      const details = "Failed to request upload URL from Cloudflare";
      return sendError(reply, code, httpMessage, details);
    }

    // Validate the response
    if (!directUpload || !directUpload.uploadURL) {
      log(`Invalid response from Cloudflare - missing uploadURL`);
      const code = 500;
      const httpMessage = "Internal Server Error";
      const details = "Received invalid response from Cloudflare";
      return sendError(reply, code, httpMessage, details);
    }

    // Return successful response
    const code = 200;
    const httpMessage = "OK";
    const details = "Generated upload URL";
    return sendStatus(reply, code, httpMessage, details, {
      uploadURL: directUpload.uploadURL,
      id: directUpload.id,
    });
  });

  server.listen(env.HTTP_PORT, () =>
    log(`Launched HTTPS server at PORT: ${env.HTTP_PORT}`),
  );
}
