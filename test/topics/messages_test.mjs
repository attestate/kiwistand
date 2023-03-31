// @format
import test from "ava";
import { encode, decode } from "cbor-x";

import { handlers, name } from "../../src/topics/messages.mjs";
import * as store from "../../src/store.mjs";

test("return upon false topic name", async (t) => {
  const evt = {
    detail: {
      topic: "false topic",
    },
  };
  const trie = await store.create();
  await handlers.message(trie)(evt);
  t.pass();
});

test("return upon unparsable uint8 array", async (t) => {
  const evt = {
    detail: {
      topic: name,
      data: "unparsable uint8",
    },
  };
  const trie = await store.create();
  await handlers.message(trie)(evt);
  t.pass();
});

test("return upon unparsable json", async (t) => {
  const evt = {
    detail: {
      topic: name,
      data: encode("unparsable json"),
    },
  };
  const trie = await store.create();
  await t.throwsAsync(async () => await handlers.message(trie)(evt), {
    message: "Wrongly formatted message",
  });
});

test("adding message to trie", async (t) => {
  const obj = { hello: "world" };
  const text = JSON.stringify(obj);
  const evt = {
    detail: {
      topic: name,
      data: encode(text),
    },
  };
  // NOTE: handlers.message will fail within store.add with is where we wanted
  // to reach
  const trie = await store.create();
  // TODO: This test must not throw but actually receive a valid message and
  // then call the right trie method to insert the message into the trie.
  await t.throwsAsync(async () => await handlers.message(trie)(evt), {
    instanceOf: Error,
    message: "Wrongly formatted message",
  });
});
