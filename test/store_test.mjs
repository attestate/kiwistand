// @format
import { env } from "process";
import { rm } from "fs/promises";

import test from "ava";
import { Wallet, utils } from "ethers";

import * as id from "../src/id.mjs";
import config from "../src/config.mjs";
import * as store from "../src/store.mjs";

test("try getting level zero", async (t) => {
  await t.throwsAsync(async () => await store.nodesByLevel(null, 0), {
    instanceOf: Error,
    message: "'level' parameter must be greater than 0",
  });
});

test("get trie nodes and make sure they're sorted", async (t) => {
  env.DATA_DIR = "dbtest";
  const trie = await store.create();
  await trie.put(Buffer.from("00", "hex"), Buffer.from("A", "utf8"));
  await trie.put(Buffer.from("01", "hex"), Buffer.from("B", "utf8"));
  await trie.put(Buffer.from("02", "hex"), Buffer.from("C", "utf8"));
  await trie.put(Buffer.from("03", "hex"), Buffer.from("D", "utf8"));
  await trie.put(Buffer.from("0001", "hex"), Buffer.from("E", "utf8"));
  await trie.put(Buffer.from("00010203", "hex"), Buffer.from("F", "utf8"));
  const nodes = await store.nodesByLevel(trie, 1);
  t.deepEqual(nodes, [
    { key: Buffer.from("00", "hex"), value: Buffer.from("A", "utf8") },
    { key: Buffer.from("01", "hex"), value: Buffer.from("B", "utf8") },
    { key: Buffer.from("02", "hex"), value: Buffer.from("C", "utf8") },
    { key: Buffer.from("03", "hex"), value: Buffer.from("D", "utf8") },
  ]);
  await rm(env.DATA_DIR, { recursive: true });
});

test("get trie nodes by level", async (t) => {
  env.DATA_DIR = "dbtest";
  const trie = await store.create();
  await trie.put(Buffer.from("00", "hex"), Buffer.from("A", "utf8"));
  await trie.put(Buffer.from("01", "hex"), Buffer.from("B", "utf8"));
  await trie.put(Buffer.from("02", "hex"), Buffer.from("C", "utf8"));
  await trie.put(Buffer.from("03", "hex"), Buffer.from("D", "utf8"));
  await trie.put(Buffer.from("0001", "hex"), Buffer.from("E", "utf8"));
  await trie.put(Buffer.from("00010203", "hex"), Buffer.from("F", "utf8"));
  const nodes = await store.nodesByLevel(trie, 2);
  t.deepEqual(nodes, [
    { key: Buffer.from("0001", "hex"), value: Buffer.from("E", "utf8") },
  ]);
  await rm(env.DATA_DIR, { recursive: true });
});

test("try to add invalidly formatted message to store", async (t) => {
  const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
  const privateKey =
    "0xad54bdeade5537fb0a553190159783e45d02d316a992db05cbed606d3ca36b39";
  const signer = new Wallet(privateKey);
  t.is(signer.address, address);

  const text = "hello world";
  const timestamp = 1676559616;
  const message = id.create(text, timestamp);
  message.extra = "bla";
  const signedMessage = await id.sign(signer, message);

  const trie = {
    put: (key, value) => {
      t.fail();
    },
  };
  const libp2p = {
    pubsub: {
      publish: (name, message) => {
        t.fail();
      },
    },
  };
  const allowlist = [address];
  await t.throwsAsync(
    async () => await store.add(trie, signedMessage, libp2p, allowlist),
    {
      instanceOf: Error,
      message: "Wrongly formatted message",
    }
  );
});

test("try to add invalidly signed message to store", async (t) => {
  const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
  const privateKey =
    "0xad54bdeade5537fb0a553190159783e45d02d316a992db05cbed606d3ca36b39";
  const signer = new Wallet(privateKey);
  t.is(signer.address, address);

  const text = "hello world";
  const timestamp = 1676559616;
  const message = id.create(text, timestamp);
  message.signature = "0xbeef";

  const trie = {
    put: (key, value) => {
      t.fail();
    },
  };
  const libp2p = {
    pubsub: {
      publish: (name, message) => {
        t.fail();
      },
    },
  };
  const allowlist = [address];
  await t.throwsAsync(
    async () => await store.add(trie, message, libp2p, allowlist),
    {
      instanceOf: Error,
      message:
        'invalid signature string (argument="signature", value="0xbeef", code=INVALID_ARGUMENT, version=bytes/5.7.0)',
    }
  );
});

test("trying to add message to store that isn't on allowlist", async (t) => {
  const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
  const privateKey =
    "0xad54bdeade5537fb0a553190159783e45d02d316a992db05cbed606d3ca36b39";
  const signer = new Wallet(privateKey);
  t.is(signer.address, address);

  const text = "hello world";
  const timestamp = 1676559616;
  const message = id.create(text, timestamp);
  const signedMessage = await id.sign(signer, message);

  const trie = {
    put: (key, value) => {
      t.fail();
    },
  };
  const libp2p = {
    pubsub: {
      publish: (name, message) => {
        t.fail();
      },
    },
  };
  const allowlist = [];
  await t.throwsAsync(
    async () => await store.add(trie, signedMessage, libp2p, allowlist),
    {
      instanceOf: Error,
      message: "Signing address wasn't found in allow list",
    }
  );
});

test("adding message to the store", async (t) => {
  t.plan(5);
  const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
  const privateKey =
    "0xad54bdeade5537fb0a553190159783e45d02d316a992db05cbed606d3ca36b39";
  const signer = new Wallet(privateKey);
  t.is(signer.address, address);

  const text = "hello world";
  const timestamp = 1676559616;
  const message = id.create(text, timestamp);
  const signedMessage = await id.sign(signer, message);

  const trie = {
    put: (key, value) => {
      t.truthy(key);
      t.truthy(value);
    },
  };
  const libp2p = {
    pubsub: {
      publish: (name, message) => {
        t.truthy(name);
        t.truthy(message);
      },
    },
  };
  const allowlist = [address];
  await store.add(trie, signedMessage, libp2p, allowlist);
});
