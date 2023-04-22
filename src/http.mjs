//@format
import { env } from "process";

import express from "express";
import Ajv from "ajv";
import addFormats from "ajv-formats";

import log from "./logger.mjs";
import * as store from "./store.mjs";
import { SCHEMATA } from "./constants.mjs";
import * as registry from "./chainstate/registry.mjs";

import index from "./views/index.mjs";

const ajv = new Ajv();
addFormats(ajv);
const app = express();
app.use(express.static("src/public"));
app.use(express.json());

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

// TODO: We should return information about the total amount of leaves
// somewhere potentially.
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
    const leaves = await store.leaves(trie, from, amount);
    const code = 200;
    const message = "OK";
    const details = `Extracted leaves from "${from}" and amount "${amount}"`;
    return sendStatus(reply, code, message, details, leaves);
  };
}

export async function launch(trie, libp2p) {
  // NOTE: This endpoint is only supposed to be enabled for as long as we need
  // to demo the front end.
  app.get("/", async (request, reply) => {
    const content = await index(trie);
    return reply.status(200).type("text/html").send(content);
  });

  app.post("/list", listMessages(trie));
  app.post("/messages", handleMessage(trie, libp2p, registry.allowlist));
  app.listen(env.HTTP_PORT, () =>
    log(`Launched HTTP server at port "${env.HTTP_PORT}"`)
  );
}
