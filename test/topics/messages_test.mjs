// @format
import test from "ava";

import { handlers, name } from "../../src/topics/messages.mjs";

test("return upon false topic name", async (t) => {
  const evt = {
    detail: {
      topic: "false topic",
    },
  };
  await handlers.message(evt);
  t.pass();
});

test("return upon unparsable uint8 array", async (t) => {
  const evt = {
    detail: {
      topic: name,
      data: "unparsable uint8",
    },
  };
  await handlers.message(evt);
  t.pass();
});

test("return upon unparsable json", async (t) => {
  const evt = {
    detail: {
      topic: name,
      data: new TextEncoder().encode("unparsable json"),
    },
  };
  await handlers.message(evt);
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
  await t.throwsAsync(async () => await handlers.message(evt), {
    instanceOf: Error,
    message: "Wrongly formatted message",
  });
});
