//@format
import { env } from "process";
import { rm } from "fs/promises";

import test from "ava";
import { encode } from "cbor-x";

import { listMessages } from "../src/http.mjs";
import * as store from "../src/store.mjs";

test("listing messages with false pagination", async (t) => {
  env.DATA_DIR = "dbtestA";
  const trie = await store.create();

  const route = listMessages(trie);
  const request = {
    body: {},
  };
  t.plan(2);
  const reply = {
    status: (code) => {
      t.is(code, 400);

      return {
        send: (message) => {
          t.truthy(message);
        },
      };
    },
  };
  await route(request, reply);

  await rm("dbtestA", { recursive: true });
});

test("listing messages", async (t) => {
  env.DATA_DIR = "dbtestA";
  const trie = await store.create();
  const message = { hello: "world" };
  await trie.put(Buffer.from("0100", "hex"), encode(message));

  const route = listMessages(trie);
  const request = {
    body: {
      from: 0,
      amount: 40,
    },
  };
  t.plan(2);
  const reply = {
    status: (code) => {
      t.is(code, 200);

      return {
        send: () => {},
        json: (payload) => {
          t.deepEqual([message], payload);
        },
      };
    },
  };
  await route(request, reply);

  await rm("dbtestA", { recursive: true });
});
