//@format
import { env } from "process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import Fastify from "fastify";
import fastifyStatic from "@fastify/static";

import log from "./logger.mjs";
import * as store from "./store.mjs";
import allowlist from "../allowlist.mjs";
import index from "./views/index.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fastify = Fastify({ logger: true });

fastify.register(fastifyStatic, {
  root: join(__dirname, "public"),
  prefix: "/public/",
});

export function handleMessage(trie, libp2p) {
  return async (request, reply) => {
    const message = request.body;
    await store.add(trie, message, libp2p, allowlist);
  };
}

export async function launch(trie, libp2p) {
  fastify.get("/", async (request, reply) => {
    const content = await index(trie);
    return reply.code(200).type("text/html").send(content);
  });

  fastify.get("/stories", async (request, reply) => {
    const leaves = await store.leaves(trie);
    const stories = store.count(leaves);
    return reply.code(200).send(stories);
  });

  fastify.post("/messages", handleMessage(trie, libp2p));
  try {
    await fastify.listen({ port: env.HTTP_PORT });
  } catch (err) {
    log(`Fastify ${err.toString()}`);
    process.exit(1);
  }
}
