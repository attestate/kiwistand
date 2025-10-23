//@format

// NOTE: Throughout this file we use Cloudflare-specific cache control headers:
// - s-maxage: Controls Cloudflare CDN caching duration
// - stale-while-revalidate: We implement a custom worker on news.kiwistand.com
//   to handle stale-while-revalidate since Cloudflare doesn't support this natively

import { env } from "process";
import path from "path";
import cluster from "cluster";
import Cloudflare from "cloudflare";
import { createClient as createQuickAuthClient, Errors } from "@farcaster/quick-auth";

import morgan from "morgan";
import express from "express";
import cookieParser from "cookie-parser";
import compression from "compression";
import cors from "cors";
import { utils } from "ethers";
import { handleFaucetRequest } from "./faucet.mjs";
import "express-async-errors";
import { sub } from "date-fns";
import DOMPurify from "isomorphic-dompurify";
import { getSlug } from "./utils.mjs";
import { extractDomain } from "./views/components/row.mjs";
import { createServer as createHttpServer } from "http";
import { FileSystemCache, getCacheKey } from "node-fetch-cache";

import * as registry from "./chainstate/registry.mjs";
import log from "./logger.mjs";
import theme from "./theme.mjs";
import feed, { index } from "./views/feed.mjs";

// Global error handlers to catch crashes and log them properly
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION (HTTP):", err.message);
  console.error(err.stack);
  // Give the process time to write logs before exiting
  setTimeout(() => process.exit(1), 100);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION (HTTP) at:", promise);
  console.error("Reason:", reason);
  // Log stack trace if available
  if (reason && reason.stack) {
    console.error(reason.stack);
  }
});
import story, { generateStory } from "./views/story.mjs";
import newest, * as newAPI from "./views/new.mjs";
import best, * as bestAPI from "./views/best.mjs";
import privacy from "./views/privacy.mjs";
import guidelines from "./views/guidelines.mjs";
import gateway from "./views/gateway.mjs";
import upvotes from "./views/upvotes.mjs";
import stats from "./views/stats.mjs";
import users from "./views/users.mjs";
import basics from "./views/basics.mjs";
import search from "./views/search.mjs";
import * as activity from "./views/activity.mjs";
import submit from "./views/submit.mjs";
import start from "./views/start.mjs";
import appTestflight from "./views/app-testflight.mjs";
import notifications from "./views/notifications.mjs";
import debug from "./views/debug.mjs";
import commentDebug from "./views/comment-debug.mjs";
import { parse, metadata } from "./parser.mjs";
import { toAddress, resolve, ENS_CACHE_PREFIX } from "./ens.mjs";
import * as ens from "./ens.mjs";
import * as karma from "./karma.mjs";
import * as subscriptions from "./subscriptions.mjs";
import * as email from "./email.mjs";
import * as moderation from "./views/moderation.mjs";
import {
  getSubmission,
  trackOutbound,
  trackImpression,
  trackShare,
  countOutbounds,
  countImpressions,
  storeMiniAppUpvote,
} from "./cache.mjs";
import normalizeUrl from "normalize-url";
import * as interactions from "./interactions.mjs";
import appCache from "./cache.mjs"; // For LRU cache used by ENS profiles
import frameSubscribe from "./views/frame-subscribe.mjs";
import { sendNotification } from "./neynar.mjs";
import { timingSafeEqual } from "crypto";
import { verify, ecrecover } from "./id.mjs";
import { EIP712_MESSAGE } from "./constants.mjs";
import { resolveIdentity } from "@attestate/delegator2";
import { invalidateActivityCaches } from "./cloudflarePurge.mjs";
import { getCastByHashAndConstructUrl } from "./parser.mjs";
import { sendToChannel } from "./telegram-bot.mjs";
import { 
  sendTweet, 
  sendCast, 
  formatSubmissionForTwitter, 
  formatSubmissionForFarcaster 
} from "./social-posting.mjs";
import { sendBroadcastNotification } from "./onesignal.mjs";

const app = express();

// Initialize Quick Auth client
const quickAuthClient = createQuickAuthClient();

// Resolve a Farcaster user's primary Ethereum address from FID using Farcaster API
async function resolvePrimaryEthAddressFromFid(fid) {
  try {
    const url = `https://api.farcaster.xyz/fc/primary-address?fid=${encodeURIComponent(
      fid,
    )}&protocol=ethereum`;
    const res = await fetch(url, { headers: { "User-Agent": "KiwiNews/1.0" } });
    if (!res.ok) return null;
    const json = await res.json();
    const addr = json?.result?.address?.address;
    if (addr) return utils.getAddress(addr);
  } catch (e) {
    // noop
  }
  return null;
}

// Derive expected domain for Quick Auth verification
function deriveDomainFromRequest(req) {
  let host;
  if (env.CUSTOM_HOST_NAME) host = env.CUSTOM_HOST_NAME;
  else if (env.NODE_ENV === "production") host = "news.kiwistand.com";
  else if (env.NODE_ENV === "staging") host = "staging.kiwistand.com";
  else host = req.headers.host || "news.kiwistand.com";
  return (host || "").split(":")[0];
}

// Validate Quick Auth JWT from request and optionally resolve primary address
async function getQuickAuthContextFromRequest(req, { require = false, resolveAddress = true } = {}) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    if (require) throw new Errors.InvalidTokenError("Missing token");
    return { tokenPresent: false };
  }

  const token = auth.split(" ")[1];
  const domain = deriveDomainFromRequest(req);
  const payload = await quickAuthClient.verifyJwt({ token, domain });
  const fid = payload?.sub;
  if (typeof fid !== "number") {
    throw new Errors.InvalidTokenError("Invalid token payload: missing fid");
  }

  let address = null;
  if (resolveAddress) {
    address = await resolvePrimaryEthAddressFromFid(fid);
  }

  return { tokenPresent: true, fid, address };
}

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

// Optimal CORS configuration with caching for both browsers and CDNs
const corsOptions = {
  // Cache preflight requests for 24 hours in browsers via CORS-specific header
  maxAge: 86400,
  // This ensures the preflight continuation so we can add our own headers
  preflightContinue: true,
};

// Use CORS with the options
app.use(cors(corsOptions));

// Add Cache-Control headers for CDN caching of preflight requests
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    // Enable caching at all levels:
    // - s-maxage for Cloudflare CDN
    // - max-age for browser HTTP cache
    // - stale-while-revalidate for background revalidation
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=86400, max-age=86400, stale-while-revalidate=604800",
    );
    // Ensure responses are varied by origin to prevent CORS issues
    res.setHeader("Vary", "Origin");
    res.end();
  } else {
    next();
  }
});

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
  const { target_url, tag } = req.body;
  
  if (!target_url || !tag) {
    return sendError(
      res,
      400,
      "Bad Request",
      "target_url and tag are required",
    );
  }
  
  let notificationTitle;
  let notificationBody;
  let submission;
  
  try {
    // Extract index from URL
    const indexMatch = target_url.match(/index=(0x[a-fA-F0-9]+)/);
    if (!indexMatch) {
      return sendError(res, 400, "Bad Request", "Invalid URL format - missing index parameter");
    }
    const index = indexMatch[1];
    
    // Fetch submission from cache
    submission = getSubmission(index);
    
    // Extract domain from submission href
    const domain = extractDomain(submission.href);
    
    // Construct notification title and body
    notificationTitle = `Kiwi News: ${tag}`;
    notificationBody = `${submission.title} - ${domain}`;
    
    log(`Sending notification for story: ${submission.title} (${domain}) with tag: ${tag}`);
  } catch (err) {
    log(`Error fetching submission: ${err.toString()}`);
    return sendError(res, 400, "Bad Request", `Failed to fetch story: ${err.message}`);
  }
  
  try {
    // Send Neynar notification
    const resp = await sendNotification(target_url, notificationBody, notificationTitle);
    
    // Also broadcast via OneSignal to all subscribed users
    try {
      await sendBroadcastNotification({
        title: notificationTitle,
        body: notificationBody,
        url: target_url,
      });
      log(`Successfully broadcasted OneSignal notification for tag: ${tag}`);
    } catch (osErr) {
      log(`Failed to broadcast OneSignal notification: ${osErr}`);
    }
    
    // Extract domain from submission href
    const domain = extractDomain(submission.href);
    
    // Also send to Telegram channel
    const telegramMessage = `${submission.title} - ${domain}\n\n${target_url}`;
    const tgResult = await sendToChannel(telegramMessage);
    
    if (!tgResult.success) {
      log(`Failed to send to Telegram: ${tgResult.error}`);
    } else {
      log(`Successfully sent to Telegram channel`);
    }
    
    // Post to Twitter
    const tweet = formatSubmissionForTwitter(submission, domain, target_url);
    const twitterResult = await sendTweet(tweet);
    
    if (!twitterResult.success) {
      log(`Failed to send tweet: ${twitterResult.error}`);
    } else {
      log(`Successfully posted to Twitter`);
    }
    
    // Post to Farcaster
    const { text: castText, embeds } = formatSubmissionForFarcaster(submission, domain, target_url);
    const farcasterResult = await sendCast(castText, embeds);
    
    if (!farcasterResult.success) {
      log(`Failed to send cast: ${farcasterResult.error}`);
    } else {
      log(`Successfully posted to Farcaster`);
    }
    
    return res.json(resp);
  } catch (err) {
    return sendError(res, 500, "Internal Server Error", err.toString());
  }
});

// Proxy endpoint for Buttondown newsletter subscriptions
// Accepts: { email } and optionally { newsletter } as a tag (ignored if absent)
app.post("/api/v1/newsletter/subscribe", async (req, res) => {
  const { email, newsletter } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  // Use BUTTON_DOWN_API_KEY (required)
  const apiKey = process.env.BUTTON_DOWN_API_KEY;
  if (!apiKey) {
    log("Buttondown API key missing: set env BUTTON_DOWN_API_KEY");
    return res.status(500).json({ error: "Server not configured for newsletter" });
  }

  try {
    const response = await fetch("https://api.buttondown.email/v1/subscribers", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "KiwiNews/1.0",
      },
      body: JSON.stringify(
        newsletter && typeof newsletter === "string" && newsletter.trim()
          ? { email_address: email, tags: [newsletter.trim()] }
          : { email_address: email }
      ),
    });

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return res.status(200).json({ status: "subscribed", data });
    }

    // Handle common "already subscribed" scenarios gracefully
    const errorText = await response.text();
    const lower = (errorText || "").toLowerCase();
    if (
      response.status === 400 ||
      response.status === 409 ||
      lower.includes("already") ||
      lower.includes("exists")
    ) {
      // Treat as idempotent success so UI can continue smoothly
      log(`Buttondown already-subscribed case for ${email}: ${response.status}`);
      return res.status(200).json({ status: "already_subscribed" });
    }

    log(`Buttondown subscription failed: ${response.status} - ${errorText}`);
    return res
      .status(response.status)
      .json({ error: "Newsletter subscription failed", details: errorText });
  } catch (error) {
    log(`Newsletter subscription error: ${error.message}`);
    return res.status(500).json({
      error: "Failed to subscribe to newsletter",
      details: error.message,
    });
  }
});

// NOTE: We use s-maxage for Cloudflare CDN caching, while max-age controls browser caching
// Helper to build the Apple App Site Association payload
function buildAppleAppSiteAssociation() {
  return {
    webcredentials: {
      apps: ["SKFAD6UPBF.attestate.Kiwi-News-iOS"],
    },
    applinks: {
      apps: [],
      // Use both components (newer iOS) and paths (older iOS) styles
      details: [
        {
          appIDs: ["SKFAD6UPBF.attestate.Kiwi-News-iOS"],
          components: [
            // Explicitly match actual existing routes
            { "/": "/stories/*" },
            { "/": "/submit*" },
            { "/": "/new*" },
            { "/": "/best*" },
            { "/": "/upvotes*" },
            { "/": "/activity*" },
            // Fallback – match everything under the domain
            { "/": "/*" },
          ],
          // Include legacy 'paths' for broader compatibility
          paths: [
            "/stories/*",
            "/submit*",
            "/new*",
            "/best*",
            "/upvotes*",
            "/activity*",
            "/*",
          ],
        },
      ],
    },
  };
}

// Serve AASA at both well-known and root paths to satisfy iOS fetch behavior
function serveAASA(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=86400, max-age=86400, stale-while-revalidate=600000",
  );
  // Use send instead of json to avoid Express overriding headers
  res.status(200).send(JSON.stringify(buildAppleAppSiteAssociation()));
}

app.get("/.well-known/apple-app-site-association", serveAASA);
app.get("/apple-app-site-association", serveAASA);

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
      castShareUrl: `${domain}/submit`,
    },
    baseBuilder: {
      allowedAddresses: ["0xbDA59D8e48ca664e82559a42DDE0Aef8C23ffd10"],
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

  // Simple 2-variant A/B test: control vs lobsters
  // 50/50 split for maximum statistical power
  const variants = ['control', 'lobsters'];
  let currentVariant = 'control';
  let variantCounter = 0; // Use counter for deterministic 50/50 split
  
  // Map variants to their functions (only 2 for simplified test)
  const feedFunctions = {
    control: feed,
    lobsters: feed  // Both use same feed function now, just with different params
  };
  
  // Map variant names to algorithm selection
  const variantConfigs = {
    control: { algorithm: 'control' },  // Original algorithm
    lobsters: { algorithm: 'lobsters' }  // Lobsters algorithm
  };
  
  // Start computing the feed in the background to avoid blocking server startup
  // The first request to / might be slower if the feed isn't ready yet
  setImmediate(async () => {
    try {
      console.time("initial-feed-computation");
      // Start with control variant
      currentVariant = 'control';
      const initialFeedFunction = feedFunctions[currentVariant];
      cachedFeed = await initialFeedFunction(trie, theme, 0, null, undefined, undefined, currentVariant);
      console.timeEnd("initial-feed-computation");
      log(`Initial cached feed ready (variant: ${currentVariant})`);
    } catch (err) {
      log("Failed to compute initial cached feed: " + err);
      cachedFeed = null;
    }
  });
  
  (function updateCachedFeed() {
    setTimeout(async () => {
      const startTime = Date.now();
      try {
        // Alternate between variants for 50/50 split
        variantCounter++;
        currentVariant = variants[variantCounter % 2];
        const feedFunction = feedFunctions[currentVariant];
        
        const newFeed = await feedFunction(trie, theme, 0, null, undefined, undefined, currentVariant);
        cachedFeed = newFeed;
        
        const elapsed = Date.now() - startTime;
        log(`Cached feed updated in ${elapsed}ms (variant: ${currentVariant})`);
      } catch (err) {
        log("Failed to update cached feed: " + err);
        log("Error stack: " + err.stack);
        // Retain existing cachedFeed to avoid response delays.
      } finally {
        updateCachedFeed();
      }
    }, 15000); // Changed to 15 seconds for faster variant switching
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
    trackOutbound(url, hash);
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
    trackImpression(url, hash);
    return reply.status(204).send();
  });

  app.post("/share", async (request, reply) => {
    reply.header("Cache-Control", "no-cache");
    const { url, type } = request.query;
    if (!url) {
      return reply.status(400).send("URL parameter is required");
    }
    if (!type) {
      return reply.status(400).send("Type parameter is required");
    }
    if (!fingerprint) {
      return reply.status(204).send();
    }

    const hash = fingerprint.generate(request);
    trackShare(url, hash, type);
    return reply.status(204).send();
  });
  // Disabled GET outbound tracking due to spam abuse - POST still works for sendBeacon
  app.get("/outbound", async (request, reply) => {
    reply.header("Cache-Control", "no-cache");
    return reply.status(404).send("GET outbound tracking disabled");
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

    // Add optional limit parameter to control response size
    let limit = parseInt(req.body.limit);
    if (!isNaN(limit) && limit > 0 && data && data.data && Array.isArray(data.data)) {
      data.data = data.data.slice(0, limit);
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
      ttl: 86400000 * 7, // 7 days
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
      ttl: 86400000 * 7, // 7 days
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
  app.get("/api/v1/parse", async (request, reply) => {
    const embed = await parse(request.query.url);
    reply.header("Cache-Control", "no-cache");
    return reply.status(200).type("text/html").send(embed.valueOf());
  });
  
  // IMPORTANT: This route must come BEFORE /api/v1/karma/:address to avoid route conflicts
  app.get("/api/v1/karma/top", async (request, reply) => {
    const limit = Math.min(parseInt(request.query.limit) || 10, 100);
    const offset = parseInt(request.query.offset) || 0;
    
    try {
      // Get the full karma ranking
      const allRankings = karma.ranking();
      
      // Slice based on offset and limit
      const topHolders = allRankings.slice(offset, offset + limit);
      
      // Add display names and ENS data for each user
      const enrichedHolders = await Promise.all(
        topHolders.map(async (holder, index) => {
          let displayName = holder.identity;
          let ensData = null;
          
          try {
            // Try to get ENS data using resolve
            const profileData = await ens.resolve(holder.identity);
            if (profileData?.ens) {
              displayName = profileData.ens;
              ensData = { 
                name: profileData.ens,
                avatar: profileData.safeAvatar || null
              };
            }
          } catch (err) {
            // Silently ignore ENS resolution errors
          }
          
          return {
            rank: offset + index + 1,
            identity: holder.identity,
            displayName,
            karma: holder.karma,
            ensData
          };
        })
      );
      
      const code = 200;
      const httpMessage = "OK";
      const details = "Top karma holders";
      
      // Cache for 5 minutes with longer stale-while-revalidate
      reply.header(
        "Cache-Control",
        "public, s-maxage=300, max-age=0, stale-while-revalidate=86400",
      );
      
      return sendStatus(reply, code, httpMessage, details, {
        total: allRankings.length,
        limit,
        offset,
        holders: enrichedHolders
      });
    } catch (err) {
      log(`Error in /api/v1/karma/top: ${err.toString()}`);
      const code = 500;
      const httpMessage = "Internal Server Error";
      const details = "Failed to fetch karma rankings";
      return sendError(reply, code, httpMessage, details);
    }
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
      const appCuration = request.query.curation === "true";
      
      // Use variant from query param for testing, otherwise use current rotation
      const variant = request.query.variant || currentVariant;
      const config = variantConfigs[variant] || variantConfigs.control;
      
      try {
        results = await index(
          trie,
          page,
          domain,
          lookback,
          paginate,
          appCuration,
          config.algorithm, // Pass algorithm selection
        );
      } catch (err) {
        log(`Error in api/v1/feeds/hot (variant: ${variant || 'control'}): ${err.stack}`);
        const code = 500;
        const httpMessage = "Internal Server Error";
        const details = "Error generating feed";
        return sendError(reply, code, httpMessage, details);
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
        stories = await bestAPI.getStories(page, period, request.query.domain);
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

    // Add optional limit parameter to control response size
    let limit = parseInt(request.query.limit);
    if (!isNaN(limit) && limit > 0) {
      stories = stories.slice(0, limit);
    }
    
    // Compact mode for reduced response size
    if (request.query.compact === "true") {
      const referenceTime = Date.now();
      stories = stories.map((story, idx) => {
        let age = 'unknown';
        if (story.timestamp) {
          const ageInHours = (referenceTime - new Date(story.timestamp * 1000)) / 3600000;
          if (ageInHours < 1) {
            age = Math.floor(ageInHours * 60) + 'm';
          } else if (ageInHours < 24) {
            age = Math.floor(ageInHours) + 'h';
          } else {
            age = Math.floor(ageInHours / 24) + 'd';
          }
        }
        return {
          rank: idx + 1,
          title: story.title,
          link: story.href,
          score: story.score || 0,
          upvotes: story.upvotes || 0,
          timestamp: story.timestamp,
          age: age
        };
      });
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
    const tokenMetadata = request.query.tokenMetadata === "true";
    
    try {
      // Get banned addresses from moderation config
      const policy = await moderation.getLists();
      const bannedAddresses = policy.addresses || [];
      submission = getSubmission(index, null, null, null, bannedAddresses);
    } catch (err) {
      log(`/api/v1/stories: Error in getSubmission: ${err.stack}`);
      const code = 404;
      const httpMessage = "Not Found";
      const details = "Couldn't find the submission";
      return sendError(reply, code, httpMessage, details);
    }

    // If tokenMetadata flag is set, return ERC-721 compliant metadata
    if (tokenMetadata) {
      let imageUrl = submission.href;
      
      // If href is not an imagedelivery domain, fetch the actual image from the page
      if (!submission.href.includes("imagedelivery.net")) {
        try {
          const result = await parse(submission.href, true); // forceFetch = true
          if (result.image) {
            imageUrl = result.image;
          }
        } catch (err) {
          log(`Failed to parse image from ${submission.href}: ${err.message}`);
          // Fall back to using the href as the image
        }
      }
      
      reply.header(
        "Cache-Control",
        "public, s-maxage=31536000, max-age=31536000, immutable",
      );
      return reply.status(200).type("application/json").send({
        name: submission.title,
        description: "",
        image: imageUrl
      });
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

  app.post("/api/v1/story-analytics", async (request, reply) => {
    const message = request.body;
    
    // Validate message format
    if (!message || message.type !== "analytics" || !message.href || !message.signature) {
      return sendError(reply, 400, "Bad Request", "Invalid message format");
    }
    
    let requesterAddress;
    try {
      // For analytics messages, we need to verify the signature directly
      // since the schema doesn't include "analytics" type
      // Use ecrecover directly to verify the signature
      requesterAddress = ecrecover(message, EIP712_MESSAGE);
      
      if (!requesterAddress) {
        throw new Error("Failed to recover address from signature");
      }
    } catch (err) {
      log(`Failed to verify analytics message signature: ${err.toString()}`);
      return sendError(reply, 401, "Unauthorized", "Invalid signature");
    }
    
    let submission;
    try {
      // Normalize the URL to match how it's stored in the database
      const normalizedHref = normalizeUrl(message.href, {
        stripWWW: false,
      });
      // Get the submission by href
      submission = getSubmission(null, normalizedHref);
    } catch (err) {
      log(`Story not found for analytics: ${message.href} - ${err.toString()}`);
      return sendError(reply, 404, "Not Found", "Story not found");
    }
    
    // Check if requester is authorized to view analytics
    const delegations = await registry.delegations();

    log(`Analytics request - Requester: ${requesterAddress}, Submitter: ${submission.identity}`);

    // Check if the requester can act as the submitter (either is the submitter or has delegation)
    const authorizedIdentity = resolveIdentity(delegations, requesterAddress);
    
    // The requester is authorized if:
    // 1. They ARE the submitter
    // 2. They can act on behalf of the submitter (have delegation from submitter)
    const isAuthorized = authorizedIdentity && 
                        (authorizedIdentity.toLowerCase() === submission.identity.toLowerCase() ||
                         requesterAddress.toLowerCase() === submission.identity.toLowerCase());
    
    if (!isAuthorized) {
      log(`Unauthorized analytics access attempt by ${requesterAddress} for story by ${submission.identity}`);
      return sendError(reply, 403, "Forbidden", "Not authorized to view analytics for this story");
    }
    
    // Get analytics data (use normalized URL to match stored data)
    const normalizedHref = normalizeUrl(message.href, {
      stripWWW: false,
    });
    const impressions = countImpressions(normalizedHref);
    const clicks = countOutbounds(normalizedHref);
    
    reply.header("Cache-Control", "no-cache");
    return sendStatus(reply, 200, "OK", "Analytics retrieved", {
      impressions,
      clicks,
      href: message.href,
      submitter: submission.identity
    });
  });

  app.get("/gateway", async (request, reply) => {
    let referral;
    try {
      referral = utils.getAddress(request.query.referral);
    } catch (err) {
      //noop
    }

    const content = await gateway(referral);
    reply.header(
      "Cache-Control",
      "public, s-maxage=86400, max-age=0, stale-while-revalidate=259200",
    );
    return reply.status(200).type("text/html").send(content.valueOf());
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
        // Use whichever variant is currently in rotation (no user-specific selection)
        const feedFunction = feedFunctions[currentVariant];
        
        content = await feedFunction(
          trie,
          reply.locals.theme,
          page,
          DOMPurify.sanitize(request.query.domain),
          identity,
          hash,
          currentVariant, // Pass variant as 7th parameter
        );
      }
    } catch (err) {
      log(`Error in /: ${err.stack}`);
      return reply.status(500).send("Internal Server Error");
    }
    reply.header(
      "Cache-Control",
      "public, s-maxage=20, max-age=0, stale-while-revalidate=86400",
    );
    return reply.status(200).type("text/html").send(content.valueOf());
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
    
    // Handle commentIndex if provided
    const commentIndex = request.query.commentIndex ? 
      DOMPurify.sanitize(request.query.commentIndex) : null;
    
    const content = await story(
      trie,
      reply.locals.theme,
      DOMPurify.sanitize(hexIndex),
      submission,
      referral,
      commentIndex,
    );
    reply.header(
      "Cache-Control",
      "public, s-maxage=86400, max-age=0, stale-while-revalidate=31536000",
    );
    return reply.status(200).type("text/html").send(content.valueOf());
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

    return reply.status(200).type("text/html").send(content.valueOf());
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
    return reply.status(200).type("text/html").send(content.valueOf());
  });
  app.get("/api/contest-stats", async (request, reply) => {
    const address = request.query.address;
    if (!address) {
      return reply.status(400).json({ error: "Address is required" });
    }
    
    try {
      const { getContestLeaderboard } = await import("./contest-leaderboard.mjs");
      const contestData = await getContestLeaderboard(address);
      const { leaderboard, userVoterInfo } = contestData;
      
      // Find user's rank
      let userRank = null;
      let userEarnings = null;
      const rankIndex = leaderboard.findIndex(
        (user) => user.identity.toLowerCase() === address.toLowerCase()
      );
      if (rankIndex !== -1) {
        userRank = rankIndex + 1;
        userEarnings = leaderboard[rankIndex].earnings;
      }
      
      return reply.status(200).json({
        karma: userVoterInfo?.karma || 0,
        votingPower: userVoterInfo?.votingPower || 0,
        earnings: userEarnings,
        rank: userRank
      });
    } catch (error) {
      console.error("Error fetching contest stats:", error);
      return reply.status(500).json({ error: "Internal server error" });
    }
  });
  app.get("/users", async (request, reply) => {
    const content = await users(trie, reply.locals.theme);
    reply.header(
      "Cache-Control",
      "public, max-age=0, no-transform, must-revalidate, stale-while-revalidate=120",
    );
    return reply.status(200).type("text/html").send(content.valueOf());
  });

  app.get("/basics", async (request, reply) => {
    const content = await basics(trie, reply.locals.theme);
    reply.header(
      "Cache-Control",
      "public, max-age=0, no-transform, must-revalidate, stale-while-revalidate=120",
    );
    return reply.status(200).type("text/html").send(content.valueOf());
  });
  app.get("/stats", async (request, reply) => {
    const content = await stats(trie, reply.locals.theme);
    reply.header(
      "Cache-Control",
      "public, max-age=0, no-transform, must-revalidate, stale-while-revalidate=120",
    );
    return reply.status(200).type("text/html").send(content.valueOf());
  });

  app.get("/debug", async (request, reply) => {
    const content = await debug(reply.locals.theme);
    reply.header("Cache-Control", "no-cache");
    return reply.status(200).type("text/html").send(content.valueOf());
  });

  app.get("/comment-debug", async (request, reply) => {
    const content = await commentDebug(reply.locals.theme);
    reply.header("Cache-Control", "no-cache");
    return reply.status(200).type("text/html").send(content.valueOf());
  });

  app.get("/app-testflight", async (request, reply) => {
    const content = await appTestflight(reply.locals.theme);

    reply.header(
      "Cache-Control",
      "public, s-maxage=86400, max-age=0, stale-while-revalidate=600000",
    );
    return reply.status(200).type("text/html").send(content.valueOf());
  });
  app.get("/notifications", async (request, reply) => {
    const content = await notifications(reply.locals.theme);

    reply.header("Cache-Control", "public, max-age=0");
    return reply.status(200).type("text/html").send(content.valueOf());
  });
  app.get("/start", async (request, reply) => {
    const content = await start(reply.locals.theme);

    reply.header(
      "Cache-Control",
      "public, s-maxage=86400, max-age=0, stale-while-revalidate=600000",
    );
    return reply.status(200).type("text/html").send(content.valueOf());
  });
  // Shared function for handling activity data retrieval
  async function handleActivityRequest(address, lastUpdate) {
    const skipDetails = true;
    const data = await activity.data(
      trie,
      DOMPurify.sanitize(address),
      parseInt(lastUpdate, 10),
      skipDetails,
    );
    return data;
  }

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
    try {
      data = await handleActivityRequest(
        request.query.address,
        request.query.lastUpdate
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

  // POST endpoint for sendBeacon (uses query params like GET)
  app.post("/api/v1/activity", async (request, reply) => {
    const { address, lastUpdate } = request.query;
    
    if (!address) {
      // sendBeacon can't read this anyway, just return 400
      return reply.status(400).send();
    }

    try {
      // Just call the function to update the server cache
      await handleActivityRequest(address, lastUpdate);
    } catch (err) {
      log(`Error in sendBeacon activity update: ${err.stack}`);
      // sendBeacon can't read this anyway, just return 400
      return reply.status(400).send();
    }
    
    // sendBeacon doesn't care about response, just return 200
    return reply.status(200).send();
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
      return reply.status(200).type("text/html").send(content.valueOf());
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
    return reply.status(200).type("text/html").send(content.valueOf());
  });
  app.get("/privacy-policy", async (request, reply) => {
    const content = await privacy(reply.locals.theme);
    reply.header(
      "Cache-Control",
      "public, s-maxage=86400, max-age=0, stale-while-revalidate=600000",
    );
    return reply.status(200).type("text/html").send(content.valueOf());
  });
  app.get("/guidelines", async (request, reply) => {
    const content = await guidelines(reply.locals.theme);
    reply.header(
      "Cache-Control",
      "public, s-maxage=86400, max-age=0, stale-while-revalidate=600000",
    );
    return reply.status(200).type("text/html").send(content.valueOf());
  });

  async function getProfile(
    trie,
    theme,
    address,
    enabledFrame = false,
    tab = "submissions",
  ) {
    const content = await upvotes(
      trie,
      theme,
      address,
      tab,
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

    const tab = request.query.tab || "submissions";
    const content = await upvotes(
      trie,
      reply.locals.theme,
      request.query.address,
      tab,
    );

    reply.header(
      "Cache-Control",
      "public, s-maxage=86400, max-age=0, stale-while-revalidate=259200",
    );

    return reply.status(200).type("text/html").send(content.valueOf());
  });

  app.get("/submit", async (request, reply) => {
    // Check if the 'identity' cookie exists and is a valid address
    // if (!utils.isAddress(request.cookies.identity)) {
    //   // If not, redirect to /gateway
    //   return reply.redirect(301, `/gateway`);
    // }

    let { url, title, castHash } = request.query;
    
    // Handle Farcaster share extension: convert castHash to Farcaster URL
    if (castHash && !url) {
      url = await getCastByHashAndConstructUrl(DOMPurify.sanitize(castHash));
    }

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

    return reply.status(200).type("text/html").send(content.valueOf());
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
    return reply.status(200).type("text/html").send(content.valueOf());
  });

  app.get("/search", async (request, reply) => {
    const query = request.query.q || "";
    const content = await search(reply.locals.theme, query);
    reply.header("Cache-Control", "no-cache");
    return reply.status(200).type("text/html").send(content.valueOf());
  });

  app.post("/api/v1/faucet", async (request, reply) => {
    reply.header("Cache-Control", "no-cache");
    return handleFaucetRequest(request, reply);
  });

  app.post("/api/v1/miniapp-upvote", async (request, reply) => {
    reply.header("Cache-Control", "no-cache");
    
    const message = request.body;
    
    // REQUIRE JWT authorization and resolve identity from FID
    let fid, identityAddress;
    try {
      const qa = await getQuickAuthContextFromRequest(request, { require: true, resolveAddress: true });
      fid = qa.fid;
      identityAddress = qa.address;
      if (!identityAddress) {
        return sendError(reply, 400, "Bad Request", "No primary Ethereum address found for Farcaster user");
      }
      log(`JWT verified for miniapp-upvote. FID=${fid}, address=${identityAddress}`);
    } catch (verifyError) {
      if (verifyError instanceof Errors.InvalidTokenError) {
        return sendError(reply, 401, "Invalid Token", "Invalid authentication token");
      }
      return sendError(reply, 401, "Authentication Failed", verifyError.message || String(verifyError));
    }
    
    // Validate message structure
    if (!message.title || !message.href || !message.timestamp) {
      return sendError(reply, 400, "Invalid Message", "Missing required message fields");
    }
    
    try {
      // Store mini app upvote with wallet address as identity
      await storeMiniAppUpvote({
        fid: parseInt(fid, 10),
        href: message.href,
        title: message.title,
        timestamp: message.timestamp,
        walletAddress: identityAddress,
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
      
      // Trigger upvote notification for mini app upvotes
      setImmediate(() => {
        subscriptions.triggerUpvoteNotification({
          type: "amplify",
          href: message.href,
          title: message.title,
          timestamp: message.timestamp,
          identity: message.walletAddress
        }).catch((err) => {
          log(`Failed to trigger mini app upvote notification: ${err}`);
        });
      });
      
      return sendStatus(reply, 200, "OK", "Mini app upvote recorded successfully");
    } catch (error) {
      log(`Mini app upvote error: ${error.message}`);
      return sendError(reply, 500, "Internal Server Error", error.message);
    }
  });

  // Record impressions and clicks for content
  app.post("/api/v1/interactions/batch", async (request, reply) => {
    reply.header("Cache-Control", "no-cache");
    
    const { impressions = [], clicks = [] } = request.body;

    // Optional Quick Auth JWT from Farcaster mini app
    let jwtIdentity = null;
    try {
      const qa = await getQuickAuthContextFromRequest(request, { require: false, resolveAddress: true });
      if (qa.tokenPresent && qa.address) {
        jwtIdentity = qa.address;
      }
    } catch (verifyError) {
      if (verifyError instanceof Errors.InvalidTokenError) {
        return sendError(reply, 401, "Invalid Token", "Invalid authentication token");
      }
      return sendError(reply, 401, "Authentication Failed", verifyError.message || String(verifyError));
    }

    // Validate input
    if (!Array.isArray(impressions) || !Array.isArray(clicks)) {
      return sendError(reply, 400, "Bad Request", "Impressions and clicks must be arrays");
    }
    
    // Validate each interaction has required fields
    for (const impression of impressions) {
      if (!impression.contentId || !impression.contentType || !impression.message) {
        return sendError(reply, 400, "Bad Request", "Invalid impression data");
      }
      // If no JWT identity, require signature as before
      if (!jwtIdentity && !impression.signature) {
        return sendError(reply, 400, "Bad Request", "Invalid impression data");
      }
      if (impression.contentType !== "submission" && impression.contentType !== "comment") {
        return sendError(reply, 400, "Bad Request", "contentType must be 'submission' or 'comment'");
      }
    }
    
    for (const click of clicks) {
      if (!click.contentId || !click.contentType || !click.message) {
        return sendError(reply, 400, "Bad Request", "Invalid click data");
      }
      // If no JWT identity, require signature as before
      if (!jwtIdentity && !click.signature) {
        return sendError(reply, 400, "Bad Request", "Invalid click data");
      }
      if (click.contentType !== "submission" && click.contentType !== "comment") {
        return sendError(reply, 400, "Bad Request", "contentType must be 'submission' or 'comment'");
      }
    }

    // Sanitize and inject server-validated identity into messages when JWT present
    if (jwtIdentity) {
      const scrub = (item) => {
        if (!item?.message || typeof item.message !== "object") return;
        // Remove any client-injected flags
        delete item.message.jwtIdentity;
        delete item.message.__jwtValidated;
        // Inject server-validated identity
        item.message.jwtIdentity = jwtIdentity;
        item.message.__jwtValidated = true;
      };
      impressions.forEach(scrub);
      clicks.forEach(scrub);
    }

    try {
      // Process the batch
      const result = await interactions.recordBatch(impressions, clicks);
      
      if (result.success) {
        const code = 200;
        const httpMessage = "OK";
        const details = `Recorded ${result.results.impressions.success} impressions and ${result.results.clicks.success} clicks`;
        return sendStatus(reply, code, httpMessage, details, result.results);
      } else {
        return sendError(reply, 500, "Internal Server Error", result.error);
      }
    } catch (err) {
      log(`Error recording interactions batch: ${err.toString()}`);
      return sendError(reply, 500, "Internal Server Error", err.toString());
    }
  });

  // Get user's interaction history for sync
  app.get("/api/v1/interactions/sync", async (request, reply) => {
    const { signature, message } = request.query;
    
    // Optional Quick Auth JWT from Farcaster mini app
    let jwtIdentity = null;
    try {
      const qa = await getQuickAuthContextFromRequest(request, { require: false, resolveAddress: true });
      if (qa.tokenPresent && qa.address) {
        jwtIdentity = qa.address;
      }
    } catch (verifyError) {
      if (verifyError instanceof Errors.InvalidTokenError) {
        return sendError(reply, 401, "Invalid Token", "Invalid authentication token");
      }
      return sendError(reply, 401, "Authentication Failed", verifyError.message || String(verifyError));
    }

    if (!signature && !jwtIdentity) {
      return sendError(reply, 400, "Bad Request", "Signature or Quick Auth token required");
    }
    if (!message) {
      return sendError(reply, 400, "Bad Request", "Message is required");
    }

    try {
      // Parse the message if it's a JSON string
      const parsedMessage = typeof message === 'string' ? JSON.parse(message) : message;
      
      if (jwtIdentity && parsedMessage && typeof parsedMessage === "object") {
        // Strip any client-provided flags and inject server-validated identity
        delete parsedMessage.jwtIdentity;
        delete parsedMessage.__jwtValidated;
        parsedMessage.jwtIdentity = jwtIdentity;
        parsedMessage.__jwtValidated = true;
      }
      
      // Verify the signature and get the user identity (custody address)
      const userIdentity = await interactions.verifyInteraction(parsedMessage, signature);
      
      if (!userIdentity) {
        return sendError(reply, 401, "Unauthorized", "Invalid signature or not eligible");
      }
      
      // Get user's interactions using their identity (custody address)
      const userInteractions = interactions.getUserInteractions(userIdentity);
      
      const code = 200;
      const httpMessage = "OK";
      const details = `Found ${userInteractions.totalImpressions} impressions and ${userInteractions.totalClicks} clicks`;
      
      // Cache for 1 minute to reduce database load
      reply.header(
        "Cache-Control",
        "private, max-age=60, must-revalidate",
      );
      
      return sendStatus(reply, code, httpMessage, details, userInteractions);
    } catch (err) {
      log(`Error syncing interactions: ${err.toString()}`);
      return sendError(reply, 500, "Internal Server Error", err.toString());
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
