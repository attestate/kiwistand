//@format
import { env } from "process";

import Fastify from "fastify";

import log from "./logger.mjs";
import * as store from "./store.mjs";

const fastify = Fastify({ logger: true });

let node;
fastify.post("/messages", async (request, reply) => {
  const message = request.body;
  const trie = await store.create();
  const distribute = true;
  await store.add(trie, message, distribute);
});

export async function launch() {
  try {
    await fastify.listen({ port: env.HTTP_PORT });
  } catch (err) {
    log(err.toString());
    process.exit(1);
  }
}
