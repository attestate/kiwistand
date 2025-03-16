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
import * as registry from "./chainstate/registry.mjs";
import * as newest from "./views/new.mjs";
import { generateStory } from "./views/story.mjs";
import { getSubmission } from "./cache.mjs";

const ajv = new Ajv();
addFormats(ajv);
const api = express.Router();
api.use(express.json());
api.use(cors());
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
    const allowlist = await getAllowlist();
    const delegations = await getDelegations();
    const accounts = await getAccounts();

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
      const code = 400;
      const httpMessage = "Bad Request";
      return sendError(reply, code, httpMessage, err.toString());
    }

    if (request.query && request.query.wait && request.query.wait === "true") {
      await newest.recompute(trie);
    } else {
      newest.recompute(trie);
    }

    let submission;
    if (message.type === "amplify") {
      try {
        const wait = true;
        await generateStory(`0x${index}`, wait);
      } catch (err) {
        // NOTE: This can fail if the message is an upvote, not a submission.
      }

      try {
        const index = null;
        submission = getSubmission(index, message.href);
      } catch (err) {
        // NOTE: We can ignore the error here if it's being thrown
      }
    }

    const code = 200;
    const httpMessage = "OK";
    const details = "Message included";

    let response;
    if (submission && submission.upvotes > 1) {
      response = {
        index: `0x${submission.index}`,
        isResubmission: true,
      };
    } else {
      response = {
        index: `0x${index}`,
        isResubmission: false,
      };
    }
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
        "public, s-maxage=1, max-age=1, stale-while-revalidate=1",
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
        "public, s-maxage=1, max-age=1, stale-while-revalidate=1",
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
