//@format
import { env } from "process";

import express from "express";
import cors from "cors";
import Ajv from "ajv";
import addFormats from "ajv-formats";

import log from "./logger.mjs";
import * as store from "./store.mjs";
import { SCHEMATA } from "./constants.mjs";
import * as registry from "./chainstate/registry.mjs";

const ajv = new Ajv();
addFormats(ajv);
const api = express.Router();
api.use(express.json());
api.use(cors());

function getSSLOptions() {
  if (env.NODE_ENV === "production" && env.SSL_CERT_PATH && env.SSL_KEY_PATH) {
    return {
      key: fs.readFileSync(env.SSL_KEY_PATH, "utf8"),
      cert: fs.readFileSync(env.SSL_CERT_PATH, "utf8"),
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

export function handleMessage(trie, libp2p, getAllowlist) {
  return async (request, reply) => {
    const message = request.body;
    const allowlist = await getAllowlist();
    try {
      await store.add(trie, message, libp2p, allowlist);
    } catch (err) {
      const code = 400;
      const httpMessage = "Bad Request";
      return sendError(reply, code, httpMessage, err.toString());
    }

    const code = 200;
    const httpMessage = "OK";
    const details = "Message included";
    return sendStatus(reply, code, httpMessage, details);
  };
}

export function listAllowed(getAllowlist) {
  return async (request, reply) => {
    const code = 200;
    const httpMessage = "OK";
    const details = "Returning allow list";
    return sendStatus(reply, code, httpMessage, details, await getAllowlist());
  };
}

export function listMessages(trie) {
  const requestValidator = ajv.compile(SCHEMATA.pagination);
  return async (request, reply) => {
    const result = requestValidator(request.body);
    if (!result) {
      const code = 400;
      const message = "Bad Request";
      const details = `Wrongly formatted message: ${JSON.stringify(
        requestValidator.errors
      )}`;
      return sendError(reply, code, message, details);
    }

    const { from, amount } = request.body;
    const parser = JSON.parse;
    const leaves = await store.leaves(trie, from, amount, parser);
    const code = 200;
    const message = "OK";
    const details = `Extracted leaves from "${from}" and amount "${amount}"`;
    return sendStatus(reply, code, message, details, leaves);
  };
}

export function launch(trie, libp2p) {
  api.post("/list", listMessages(trie));
  api.get("/allowlist", listAllowed(registry.allowlist));
  api.post("/messages", handleMessage(trie, libp2p, registry.allowlist));

  const app = express();
  app.use("/api/v1", api);
  const sslOptions = getSSLOptions();

  if (sslOptions) {
    const httpsServer = https.createServer(sslOptions, app);
    httpsServer.listen(env.API_PORT, () =>
      log(
        `Launched SSL-enabled API server in production at port "${env.API_PORT}"`
      )
    );
  } else {
    app.listen(env.API_PORT, () =>
      log(`Launched API server at port "${env.API_PORT}"`)
    );
  }
}
