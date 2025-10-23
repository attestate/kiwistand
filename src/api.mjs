//@format
import { env } from "process";
import fs from "fs";
import https from "https";

import express from "express";
import "express-async-errors";
import cors from "cors";
import compression from "compression";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import morgan from "morgan";
import { utils } from "ethers";

import log from "./logger.mjs";
import * as store from "./store.mjs";
import { SCHEMATA } from "./constants.mjs";
// Dynamic import for sendToCluster - only loaded when not in reconcile mode
let sendToCluster = null;
import * as registry from "./chainstate/registry.mjs";
import * as newest from "./views/new.mjs";
// Dynamic import for generatePreview - only loaded when not in reconcile mode
let generatePreview = null;
import { getSubmission, isReactionComment } from "./cache.mjs";
import { triggerUpvoteNotification } from "./subscriptions.mjs";

// Global error handlers to catch crashes and log them properly
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err.message);
  console.error(err.stack);
  // Give the process time to write logs before exiting
  setTimeout(() => process.exit(1), 100);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION at:", promise);
  console.error("Reason:", reason);
  // Log stack trace if available
  if (reason && reason.stack) {
    console.error(reason.stack);
  }
});

const ajv = new Ajv();
addFormats(ajv);
const api = express.Router();
api.use(express.json());

// Enable compression for all API responses
api.use(
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
api.use(cors(corsOptions));

// Add Cache-Control headers for CDN caching
api.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    // Enable caching at all levels:
    // - s-maxage for Cloudflare CDN
    // - max-age for browser HTTP cache
    // - stale-while-revalidate for background revalidation
    // - Access-Control-Max-Age (added by CORS middleware) for browser CORS cache
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

api.use(
  morgan(
    ':remote-addr - :remote-user ":method :url" :status ":referrer" ":user-agent"',
  ),
);

function getSSLOptions() {
  if (env.NODE_ENV === "production" && env.SSL_CERT_PATH && env.SSL_KEY_PATH) {
    return {
      key: fs.readFileSync(env.SSL_KEY_PATH, "utf8"),
      cert: fs.readFileSync(env.SSL_CERT_PATH, "utf8"),
    };
  }
  if (
    env.CUSTOM_PROTOCOL === "https://" &&
    env.CUSTOM_HOST_NAME === "staging.kiwistand.com:5173" &&
    fs.existsSync("staging.kiwistand.com/key.pem") &&
    fs.existsSync("staging.kiwistand.com/cert.pem")
  ) {
    return {
      key: fs.readFileSync("staging.kiwistand.com/key.pem", "utf8"),
      cert: fs.readFileSync("staging.kiwistand.com/cert.pem", "utf8"),
    };
  }
  if (
    env.CUSTOM_PROTOCOL === "https://" &&
    fs.existsSync("certificates/key.pem") &&
    fs.existsSync("certificates/cert.pem")
  ) {
    return {
      key: fs.readFileSync("certificates/key.pem", "utf8"),
      cert: fs.readFileSync("certificates/cert.pem", "utf8"),
    };
  }
  return null;
}

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

export function handleMessage(
  trie,
  libp2p,
  getDelegations,
) {
  return async (request, reply) => {
    const message = request.body;
    const delegationsResult = await Promise.allSettled([
        getDelegations(),
      ]);

    const delegations =
      delegationsResult[0].status === "fulfilled" ? delegationsResult[0].value : {};

    let index;
    try {
      index = await store.add(
        trie,
        message,
        libp2p,
        delegations,
      );
    } catch (err) {
      // NOTE: If the user has submitted this very link we're redirecting them
      // to their original submission
      if (
        err
          .toString()
          .includes("doesn't pass legitimacy criteria (duplicate)") &&
        message.type === "amplify"
      ) {
        try {
          const index = null;
          const submission = getSubmission(index, message.href);
          const code = 200;
          const httpMessage = "OK";
          const details = "Resubmission detected";
          const response = {
            index: `0x${submission.index}`,
          };
          return sendStatus(reply, code, httpMessage, details, response);
        } catch (err) {
          log(
            `Error handling resubmission in api after not passing legitimacy critera ${err.stack}`,
          );
        }
      } else {
        const code = 400;
        const httpMessage = "Bad Request";
        return sendError(reply, code, httpMessage, err.toString());
      }
    }

    // We're only checking if a supposed submission is an upvote here if the
    // wait parameter is set. We necessarily have to check this for an upvote
    // intentioned to be a submission as we'd otherwise lead to the single
    // story page indexed by the upvoting message, and not neccesary by the
    // submitting message.
    if (message.type === "amplify" && request?.query?.wait === "true") {
      let submission;
      try {
        const index = null;
        submission = getSubmission(index, message.href);
      } catch (err) {
        log(
          `Error handling resubmission in api after finding that submission request is just an upvote ${err.stack}`,
        );
      }
      if (submission && submission.upvotes > 1) {
        const code = 200;
        const httpMessage = "OK";
        const details = "Resubmission detected";
        const response = {
          index: `0x${submission.index}`,
        };
        return sendStatus(reply, code, httpMessage, details, response);
      }
    }

    // NOTE: We only want to recompute the new feed if:
    //
    // - The message is a submission. When a message of type amplify reaches
    // this point of the function execution, we're already sure that it's a
    // submission
    //
    // - The message is a comment, but not an emoji reaction.
    if (
      message.type === "amplify" ||
      (message.type === "comment" && !isReactionComment(message.title))
    ) {
      // Only send to cluster if not in reconcile mode (where there are no workers)
      if (sendToCluster && env.NODE_ENV !== "reconcile") {
        sendToCluster("recompute-new-feed");
      }
      // Use setImmediate to make recomputation truly asynchronous
      // This prevents blocking the API response while doing heavy computation
      setImmediate(() => {
        newest
          .recompute(trie)
          .catch((err) => log(`Recomputation of new feed failed`));
      });
    }

    // NOTE: It's ok to not generate a preview if we've previously detected a
    // resubmission. In this case the preview was already generated.
    if (message.type === "amplify") {
      // Use setImmediate to ensure all preview generation work is truly non-blocking
      setImmediate(() => {
        if (generatePreview) {
          generatePreview(`0x${index}`).catch((err) => {
            // NOTE: This can fail if the message is an upvote, not a submission.
          });
        }
      });
      
      // Trigger upvote notification for the story author
      setImmediate(() => {
        triggerUpvoteNotification(message).catch((err) => {
          log(`Failed to trigger upvote notification: ${err}`);
        });
      });
    }
    
    // Generate preview for comments (excluding emoji reactions)
    if (message.type === "comment" && !isReactionComment(message.title)) {
      // Use setImmediate to ensure preview generation is non-blocking
      setImmediate(() => {
        // For comments, we need to pass both the story index and comment index
        const storyIndex = message.href ? `0x${message.href.substring(7)}` : null;
        if (storyIndex && generatePreview) {
          generatePreview(storyIndex, index).catch((err) => {
            log(`Failed to generate comment preview: ${err.message}`);
          });
        }
      });
    }

    const code = 200;
    const httpMessage = "OK";
    const details = "Message included";
    const response = {
      index: `0x${index}`,
    };
    return sendStatus(reply, code, httpMessage, details, response);
  };
}


export function listDelegations(getDelegations) {
  return async (request, reply) => {
    if (request.query.cached === "true") {
      reply.header(
        "Cache-Control",
        "public, s-maxage=86400, stale-while-revalidate=604800",
      );
    }

    const code = 200;
    const httpMessage = "OK";
    const details = "Returning delegations list";
    return sendStatus(
      reply,
      code,
      httpMessage,
      details,
      await getDelegations(),
    );
  };
}

export function listMessages(trie, getDelegations) {
  const requestValidator = ajv.compile(SCHEMATA.listMessages);
  return async (request, reply) => {
    const result = requestValidator(request.body);
    if (!result) {
      const code = 400;
      const message = "Bad Request";
      const details = `Wrongly formatted message: ${JSON.stringify(
        requestValidator.errors,
      )}`;
      return sendError(reply, code, message, details);
    }

    const { from, amount } = request.body;
    const parser = JSON.parse;
    const startDatetime = null;
    const delegations = await getDelegations();
    const href = null;
    const type = request.body.type || "amplify";
    const leaves = await store.posts(
      trie,
      from,
      amount,
      parser,
      startDatetime,
      delegations,
      href,
      type,
    );
    const code = 200;
    const message = "OK";
    const details = `Extracted posts from "${from}" and amount "${amount}"`;
    return sendStatus(reply, code, message, details, leaves);
  };
}

export async function launch(trie, libp2p) {
  // Load sendToCluster and generatePreview only when not in reconcile mode
  if (env.NODE_ENV !== "reconcile") {
    try {
      const httpModule = await import("./http.mjs");
      sendToCluster = httpModule.sendToCluster;
    } catch (err) {
      log(`Warning: Could not load http module: ${err.message}`);
    }
    
    try {
      const storyModule = await import("./views/story.mjs");
      generatePreview = storyModule.generatePreview;
    } catch (err) {
      log(`Warning: Could not load story module: ${err.message}`);
    }
  }
  
  api.use((err, req, res, next) => {
    log(`Express error: "${err.message}", "${err.stack}"`);
    res.status(500).send("Internal Server Error");
  });

  api.post(
    "/list",
    listMessages(trie, registry.delegations),
  );
  api.get("/delegations", listDelegations(registry.delegations));
  api.post(
    "/messages",
    handleMessage(
      trie,
      libp2p,
      registry.delegations,
    ),
  );

  const app = express();
  app.use("/api/v1", api);
  const sslOptions = getSSLOptions();

  if (sslOptions) {
    const httpsServer = https.createServer(sslOptions, app);
    httpsServer.listen(env.API_PORT, () =>
      log(
        `Launched SSL-enabled API server in production at port "${env.API_PORT}"`,
      ),
    );
  } else {
    app.listen(env.API_PORT, () =>
      log(`Launched API server at port "${env.API_PORT}"`),
    );
  }
}
