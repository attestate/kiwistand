//@format
import { env } from "process";

import express from "express";

import log from "./logger.mjs";
import * as store from "./store.mjs";
import allowlist from "../allowlist.mjs";
import index from "./views/index.mjs";

const app = express();
app.use(express.static("src/public"));
app.use(express.json());

export function handleMessage(trie, libp2p) {
  return async (request, reply) => {
    const message = request.body;
    try {
      await store.add(trie, message, libp2p, allowlist);
    } catch (err) {
      log(
        `Error adding message upon POST /messages request: "${err.toString()}"`
      );
    }
  };
}

export async function launch(trie, libp2p) {
  app.get("/", async (request, reply) => {
    const content = await index(trie);
    return reply.status(200).type("text/html").send(content);
  });

  app.get("/stories", async (request, reply) => {
    const leaves = await store.leaves(trie);
    const stories = store.count(leaves);
    return reply.status(200).json(stories);
  });

  app.post("/messages", handleMessage(trie, libp2p));
  app.listen(env.HTTP_PORT, () =>
    log(`Launched HTTP server at port "${env.HTTP_PORT}"`)
  );
}
