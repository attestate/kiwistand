//@format
import { env } from "process";

import express from "express";
import Ajv from "ajv";
import addFormats from "ajv-formats";

import log from "./logger.mjs";
import * as store from "./store.mjs";
import { SCHEMATA } from "./constants.mjs";
import index from "./views/index.mjs";
import * as registry from "./chainstate/registry.mjs";

const ajv = new Ajv();
addFormats(ajv);
const app = express();
app.use(express.static("src/public"));
app.use(express.json());

export function handleMessage(trie, libp2p) {
  return async (request, reply) => {
    const message = request.body;
    const allowlist = await registry.allowlist();
    try {
      await store.add(trie, message, libp2p, allowlist);
    } catch (err) {
      log(
        `Error adding message upon POST /messages request: "${err.toString()}"`
      );
      return reply.status(400).send();
    }
    return reply.status(200).send();
  };
}

// TODO: We should return information about the total amount of leaves
// somewhere potentially.
export function listMessages(trie) {
  const requestValidator = ajv.compile(SCHEMATA.pagination);
  return async (request, reply) => {
    const result = requestValidator(request.body);
    if (!result) {
      const errMessage = `Wrongly formatted message: ${JSON.stringify(
        requestValidator.errors
      )}`;
      log(errMessage);
      return reply.status(400).send(errMessage);
    }

    const { from, amount } = request.body;
    const leaves = await store.leaves(trie, from, amount);
    return reply.status(200).json(leaves);
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
  app.post("/messages", handleMessage(trie, libp2p));
  app.listen(env.HTTP_PORT, () =>
    log(`Launched HTTP server at port "${env.HTTP_PORT}"`)
  );
}
