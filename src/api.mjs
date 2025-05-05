//@format
import { env } from "process";
import fs from "fs";
import https from "https";

import express from "express";
import "express-async-errors";
import cors from "cors";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import morgan from "morgan";
import { utils } from "ethers";

import log from "./logger.mjs";
import * as store from "./store.mjs";
import { SCHEMATA } from "./constants.mjs";
import { sendToCluster } from "./http.mjs";
import * as registry from "./chainstate/registry.mjs";
import * as newest from "./views/new.mjs";
import { generatePreview } from "./views/story.mjs";
import { getSubmission, isReactionComment } from "./cache.mjs";

const ajv = new Ajv();
addFormats(ajv);
const api = express.Router();
api.use(express.json());

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
  getAllowlist,
  getDelegations,
  getAccounts,
) {
  return async (request, reply) => {
    const message = request.body;
    const [allowlistResult, delegationsResult, accountsResult] =
      await Promise.allSettled([
        getAllowlist(),
        getDelegations(),
        getAccounts(),
      ]);

    const allowlist =
      allowlistResult.status === "fulfilled" ? allowlistResult.value : {};
    const delegations =
      delegationsResult.status === "fulfilled" ? delegationsResult.value : {};
    const accounts =
      accountsResult.status === "fulfilled" ? accountsResult.value : {};

    let index;
    try {
      index = await store.add(
        trie,
        message,
        libp2p,
        allowlist,
        delegations,
        accounts,
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
      sendToCluster("recompute-new-feed");
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
        generatePreview(`0x${index}`).catch((err) => {
          // NOTE: This can fail if the message is an upvote, not a submission.
        });
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

export function listAllowed(getAllowlist) {
  return async (request, reply) => {
    let result = Array.from(await getAllowlist());
    if (request.query.address) {
      let address;
      try {
        address = utils.getAddress(request.query.address);
      } catch (err) {
        const code = 400;
        const message = "Bad Request";
        const details = "address query string must be an Ethereum address";
        return sendError(reply, code, message, details);
      }

      const find = result.find((element) => element === address);

      if (find) {
        reply.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        result = [find];
      } else {
        result = [];
      }
    }

    if (request.query.cached === "true") {
      reply.header(
        "Cache-Control",
        "public, s-maxage=86400, stale-while-revalidate=604800",
      );
    }

    const code = 200;
    const httpMessage = "OK";
    const details = "Returning allow list";
    return sendStatus(reply, code, httpMessage, details, result);
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

export function listMessages(trie, getAccounts, getDelegations) {
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
    const accounts = await getAccounts();
    const delegations = await getDelegations();
    const href = null;
    const type = request.body.type || "amplify";
    const leaves = await store.posts(
      trie,
      from,
      amount,
      parser,
      startDatetime,
      accounts,
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

export function launch(trie, libp2p) {
  api.use((err, req, res, next) => {
    log(`Express error: "${err.message}", "${err.stack}"`);
    res.status(500).send("Internal Server Error");
  });

  api.post(
    "/list",
    listMessages(trie, registry.accounts, registry.delegations),
  );
  api.get("/allowlist", listAllowed(registry.allowlist));
  api.get("/delegations", listDelegations(registry.delegations));
  api.post(
    "/messages",
    handleMessage(
      trie,
      libp2p,
      registry.allowlist,
      registry.delegations,
      registry.accounts,
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
