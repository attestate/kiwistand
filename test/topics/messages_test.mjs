// @format
import test from "ava";

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
      data: new TextEncoder().encode("unparsable json"),
    },
  };
  const trie = await store.create();
  await handlers.message(trie)(evt);
  t.pass();
});

test("adding message to trie", async (t) => {
  const obj = { hello: "world" };
  const text = JSON.stringify(obj);
  const evt = {
    detail: {
      topic: name,
      data: new TextEncoder().encode(text),
    },
  };
  // NOTE: handlers.message will fail within store.add with is where we wanted
  // to reach
  const trie = await store.create();
  await t.throwsAsync(async () => await handlers.message(trie)(evt), {
    instanceOf: Error,
    message: "Wrongly formatted message",
  });
});
