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
  const emptyRoot = trie.root();
  await handlers.message(trie)(evt);
  // NOTE: The message must not end up as a leaf in the trie and so if the trie
  // still has the empty root as a root, then that means the message was
  // dropped.
  t.deepEqual(emptyRoot, trie.root());
});

test("return upon unparsable json", async (t) => {
  const evt = {
    detail: {
      topic: name,
      data: encode("unparsable json"),
    },
  };
  const trie = await store.create();
  const emptyRoot = trie.root();
  await handlers.message(trie)(evt);
  // NOTE: The message must not end up as a leaf in the trie and so if the trie
  // still has the empty root as a root, then that means the message was
  // dropped.
  t.deepEqual(emptyRoot, trie.root());
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
  const trie = await store.create();
  const emptyRoot = trie.root();
  await handlers.message(trie)(evt);
  // NOTE: The message must not end up as a leaf in the trie and so if the trie
  // still has the empty root as a root, then that means the message was
  // dropped.
  t.deepEqual(emptyRoot, trie.root());
});
