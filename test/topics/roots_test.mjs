// @format
import { env } from "process";
import { rm } from "fs/promises";

import test from "ava";
import { encode, decode } from "cbor-x";

import { handlers, name } from "../../src/topics/roots.mjs";
import * as store from "../../src/store.mjs";

test.serial("return upon false topic name", async (t) => {
  env.DATA_DIR = "dbtestA";
  const evt = {
    detail: {
      topic: "false topic",
    },
  };
  const trie = await store.create();
  const node = {
    goblin: {
      initiate: () => {
        t.fail();
      },
    },
  };
  await handlers.message(trie, node)(evt);
  t.pass();
  await rm("dbtestA", { recursive: true });
});

test.serial("return upon unparsable cbor", async (t) => {
  env.DATA_DIR = "dbtestA";
  const evt = {
    detail: {
      topic: name,
      data: "unparsable cbor",
    },
  };
  const trie = await store.create();
  const node = {
    goblin: {
      initiate: () => {
        t.fail();
      },
    },
  };
  await handlers.message(trie, node)(evt);
  t.pass();
  await rm("dbtestA", { recursive: true });
});

test.serial(
  "that it should abort sync when AUTO_SYNC flag is off",
  async (t) => {
    env.DATA_DIR = "dbtestA";
    env.AUTO_SYNC = "false";
    const trie = await store.create();
    const evt = {
      detail: {
        topic: name,
        from: "from",
        data: encode({
          root: "deadbeef",
        }),
      },
    };
    t.plan(1);
    let initiateCalled = false;
    const node = {
      goblin: {
        initiate: () => {
          initiateCalled = true;
        },
      },
    };
    await handlers.message(trie, node)(evt);
    t.false(initiateCalled);

    await rm("dbtestA", { recursive: true });
  }
);

test.serial("if it returns when trie roots are equal", async (t) => {
  env.DATA_DIR = "dbtestA";
  const trie = await store.create();
  const evt = {
    detail: {
      topic: name,
      from: "from",
      data: encode({
        root: trie.root().toString("hex"),
      }),
    },
  };
  t.plan(1);
  let initiateCalled = false;
  const node = {
    goblin: {
      initiate: () => {
        initiateCalled = true;
      },
    },
  };
  await handlers.message(trie, node)(evt);
  t.false(initiateCalled);

  await rm("dbtestA", { recursive: true });
});

test.serial("receiving message and starting initiate", async (t) => {
  env.DATA_DIR = "dbtestA";
  env.AUTO_SYNC = "true";
  const evt = {
    detail: {
      topic: name,
      from: "from",
      data: encode({
        root: "abc",
      }),
    },
  };
  t.plan(1);
  let initiateCalled = false;
  const node = {
    goblin: {
      initiate: () => {
        initiateCalled = true;
      },
    },
  };
  const trie = await store.create();
  await handlers.message(trie, node)(evt);
  t.true(initiateCalled);

  await rm("dbtestA", { recursive: true });
});
