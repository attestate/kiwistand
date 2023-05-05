// @format
import { env } from "process";
import { rm } from "fs/promises";

import test from "ava";
import { Wallet } from "ethers";

import * as id from "../../src/id.mjs";
import * as store from "../../src/store.mjs";
import * as migration0 from "../../src/migrations/0.mjs";

async function removeTestFolders() {
  try {
    await rm("dbtestA", { recursive: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  try {
    await rm("dbtestB", { recursive: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

test.afterEach.always(async () => {
  await removeTestFolders();
});

test("if necessity for migration is recognized on entire trie with an entirely non-migrated trie", async (t) => {
  const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
  const privateKey =
    "0xad54bdeade5537fb0a553190159783e45d02d316a992db05cbed606d3ca36b39";
  const signer = new Wallet(privateKey);
  t.is(signer.address, address);

  const title = "hello world";
  const href = "https://example.com";
  const type = "amplify";
  const timestamp = 1676559616;
  const message = id.create(title, href, type, timestamp);
  const signedMessage = await id.sign(signer, message);
  t.deepEqual(signedMessage, {
    ...message,
    signature:
      "0x1df128dfe1f86df4e20ecc6ebbd586e0ab56e3fc8d0db9210422c3c765633ad8793af68aa232cf39cc3f75ea18f03260258f7276c2e0d555f98e1cf16672dd201c",
  });

  env.DATA_DIR = "dbtestA";
  const trieA = await store.create();

  const outcome0 = migration0.oldToDigest(signedMessage);
  await trieA.put(Buffer.from(outcome0.index, "hex"), outcome0.canonical);

  const outcome1 = migration0.oldToDigest(signedMessage);
  await trieA.put(Buffer.from(outcome1.index, "hex"), outcome1.canonical);

  t.true(await migration0.examine(trieA, signedMessage));
});

test("if necessity for migration is recognized on entire trie with a migrated leaf", async (t) => {
  const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
  const privateKey =
    "0xad54bdeade5537fb0a553190159783e45d02d316a992db05cbed606d3ca36b39";
  const signer = new Wallet(privateKey);
  t.is(signer.address, address);

  const title = "hello world";
  const href = "https://example.com";
  const type = "amplify";
  const timestamp = 1676559616;
  const message = id.create(title, href, type, timestamp);
  const signedMessage = await id.sign(signer, message);
  t.deepEqual(signedMessage, {
    ...message,
    signature:
      "0x1df128dfe1f86df4e20ecc6ebbd586e0ab56e3fc8d0db9210422c3c765633ad8793af68aa232cf39cc3f75ea18f03260258f7276c2e0d555f98e1cf16672dd201c",
  });

  env.DATA_DIR = "dbtestA";
  const trieA = await store.create();

  const outcome0 = migration0.oldToDigest(signedMessage);
  await trieA.put(Buffer.from(outcome0.index, "hex"), outcome0.canonical);

  const outcome1 = id.toDigest(signedMessage);
  await trieA.put(Buffer.from(outcome1.index, "hex"), outcome1.canonical);

  t.false(await migration0.examine(trieA, signedMessage));
});

test("if necessity for migration is recognized upon simple leaf", async (t) => {
  const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
  const privateKey =
    "0xad54bdeade5537fb0a553190159783e45d02d316a992db05cbed606d3ca36b39";
  const signer = new Wallet(privateKey);
  t.is(signer.address, address);

  const title = "hello world";
  const href = "https://example.com";
  const type = "amplify";
  const timestamp = 1676559616;
  const message = id.create(title, href, type, timestamp);
  const signedMessage = await id.sign(signer, message);
  t.deepEqual(signedMessage, {
    ...message,
    signature:
      "0x1df128dfe1f86df4e20ecc6ebbd586e0ab56e3fc8d0db9210422c3c765633ad8793af68aa232cf39cc3f75ea18f03260258f7276c2e0d555f98e1cf16672dd201c",
  });

  env.DATA_DIR = "dbtestA";
  const trieA = await store.create();
  const { canonical, index } = migration0.oldToDigest(signedMessage);
  await trieA.put(Buffer.from(index, "hex"), canonical);
  t.true(await migration0.examine(trieA, signedMessage));
});
