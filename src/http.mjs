//@format
import { env } from "process";

import Fastify from "fastify";

import log from "./logger.mjs";
import * as store from "./store.mjs";
import allowlist from "../allowlist.mjs";

const fastify = Fastify({ logger: true });

export function handleMessage(trie, libp2p) {
  return async (request, reply) => {
    const message = request.body;
    await store.add(trie, message, libp2p, allowlist);
  };
}

export async function launch(trie, libp2p) {
  fastify.post("/messages", handleMessage(trie, libp2p));
  try {
    await fastify.listen({ port: env.HTTP_PORT });
  } catch (err) {
    log(err.toString());
    process.exit(1);
  }
}
