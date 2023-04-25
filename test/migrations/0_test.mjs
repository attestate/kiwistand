// @format
import { env } from "process";
import { rm } from "fs/promises";

import test from "ava";
import { Wallet } from "ethers";

import * as id from "../../src/id.mjs";
import * as store from "../../src/store.mjs";
import * as migration0 from "../../src/migrations/0.mjs";
import { EIP712_MESSAGE } from "../../src/constants.mjs";

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

test.serial("entire migration flow on empty trie", async (t) => {
  env.DATA_DIR = "dbtestA";
  const trieA = await store.create();
  await migration0.run(trieA);
  t.pass();
});

test.serial("entire migration flow", async (t) => {
  const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
  const privateKey =
    "0xad54bdeade5537fb0a553190159783e45d02d316a992db05cbed606d3ca36b39";
  const signer = new Wallet(privateKey);
  t.is(signer.address, address);

  const title0 = "different headline";
  const href0 = "https://somethingelse.example.com";
  const type0 = "amplify";
  const timestamp0 = 1676559617;
  const message0 = id.create(title0, href0, type0, timestamp0);
  const signedMessage0 = await id.sign(signer, message0, EIP712_MESSAGE);
  t.deepEqual(signedMessage0, {
    ...message0,
    signature:
      "0x687d383975fee5f00d753fd54c8d4fcca922c124dda6901e636128b5ef359b34507f29592d677bacdd724a4034b1d2bbcda8928619990a1d744ea5a2887effba1c",
  });

  const title1 = "hello world";
  const href1 = "https://example.com";
  const type1 = "amplify";
  const timestamp1 = 1676559616;
  const message1 = id.create(title1, href1, type1, timestamp1);
  const signedMessage1 = await id.sign(signer, message1, EIP712_MESSAGE);
  t.deepEqual(signedMessage1, {
    ...message1,
    signature:
      "0x1df128dfe1f86df4e20ecc6ebbd586e0ab56e3fc8d0db9210422c3c765633ad8793af68aa232cf39cc3f75ea18f03260258f7276c2e0d555f98e1cf16672dd201c",
  });

  env.DATA_DIR = "dbtestA";
  const trieA = await store.create();

  const outcome0 = migration0.oldToDigest(signedMessage0);
  await trieA.put(Buffer.from(outcome0.index, "hex"), outcome0.canonical);

  const outcome1 = migration0.oldToDigest(signedMessage1);
  await trieA.put(Buffer.from(outcome1.index, "hex"), outcome1.canonical);
  t.not(outcome0.index, outcome1.index);

  await migration0.run(trieA);
});

test.serial(
  "if migration necessity is NOT found on entirely migrated trie",
  async (t) => {
    const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
    const privateKey =
      "0xad54bdeade5537fb0a553190159783e45d02d316a992db05cbed606d3ca36b39";
    const signer = new Wallet(privateKey);
    t.is(signer.address, address);

    const title0 = "different headline";
    const href0 = "https://somethingelse.example.com";
    const type0 = "amplify";
    const timestamp0 = 1676559617;
    const message0 = id.create(title0, href0, type0, timestamp0);
    const signedMessage0 = await id.sign(signer, message0, EIP712_MESSAGE);
    t.deepEqual(signedMessage0, {
      ...message0,
      signature:
        "0x687d383975fee5f00d753fd54c8d4fcca922c124dda6901e636128b5ef359b34507f29592d677bacdd724a4034b1d2bbcda8928619990a1d744ea5a2887effba1c",
    });

    const title1 = "hello world";
    const href1 = "https://example.com";
    const type1 = "amplify";
    const timestamp1 = 1676559616;
    const message1 = id.create(title1, href1, type1, timestamp1);
    const signedMessage1 = await id.sign(signer, message1, EIP712_MESSAGE);
    t.deepEqual(signedMessage1, {
      ...message1,
      signature:
        "0x1df128dfe1f86df4e20ecc6ebbd586e0ab56e3fc8d0db9210422c3c765633ad8793af68aa232cf39cc3f75ea18f03260258f7276c2e0d555f98e1cf16672dd201c",
    });

    env.DATA_DIR = "dbtestA";
    const trieA = await store.create();

    const outcome0 = id.toDigest(signedMessage0);
    await trieA.put(Buffer.from(outcome0.index, "hex"), outcome0.canonical);

    const outcome1 = id.toDigest(signedMessage1);
    await trieA.put(Buffer.from(outcome1.index, "hex"), outcome1.canonical);
    t.not(outcome0.index, outcome1.index);

    const leaves = await store.leaves(trieA);
    t.is(leaves.length, 2);
    t.false(await migration0.necessary(trieA, leaves));
  }
);

test.serial(
  "if migration necessity is found on entirely non-migrated trie",
  async (t) => {
    const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
    const privateKey =
      "0xad54bdeade5537fb0a553190159783e45d02d316a992db05cbed606d3ca36b39";
    const signer = new Wallet(privateKey);
    t.is(signer.address, address);

    const title0 = "different headline";
    const href0 = "https://somethingelse.example.com";
    const type0 = "amplify";
    const timestamp0 = 1676559617;
    const message0 = id.create(title0, href0, type0, timestamp0);
    const signedMessage0 = await id.sign(signer, message0, EIP712_MESSAGE);
    t.deepEqual(signedMessage0, {
      ...message0,
      signature:
        "0x687d383975fee5f00d753fd54c8d4fcca922c124dda6901e636128b5ef359b34507f29592d677bacdd724a4034b1d2bbcda8928619990a1d744ea5a2887effba1c",
    });

    const title1 = "hello world";
    const href1 = "https://example.com";
    const type1 = "amplify";
    const timestamp1 = 1676559616;
    const message1 = id.create(title1, href1, type1, timestamp1);
    const signedMessage1 = await id.sign(signer, message1, EIP712_MESSAGE);
    t.deepEqual(signedMessage1, {
      ...message1,
      signature:
        "0x1df128dfe1f86df4e20ecc6ebbd586e0ab56e3fc8d0db9210422c3c765633ad8793af68aa232cf39cc3f75ea18f03260258f7276c2e0d555f98e1cf16672dd201c",
    });

    env.DATA_DIR = "dbtestA";
    const trieA = await store.create();

    const outcome0 = migration0.oldToDigest(signedMessage0);
    await trieA.put(Buffer.from(outcome0.index, "hex"), outcome0.canonical);

    const outcome1 = migration0.oldToDigest(signedMessage1);
    await trieA.put(Buffer.from(outcome1.index, "hex"), outcome1.canonical);
    t.not(outcome0.index, outcome1.index);

    const leaves = await store.leaves(trieA);
    t.is(leaves.length, 2);
    t.true(await migration0.necessary(trieA, leaves));
  }
);

test.serial("if migration aborts on partially migrated trie", async (t) => {
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
  const signedMessage = await id.sign(signer, message, EIP712_MESSAGE);
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
  t.not(outcome0.index, outcome1.index);

  const leaves = await store.leaves(trieA);
  t.is(leaves.length, 2);
  await t.throwsAsync(async () => await migration0.necessary(trieA, leaves));
});

test.serial(
  "if necessity for migration is recognized upon simple leaf",
  async (t) => {
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
    const signedMessage = await id.sign(signer, message, EIP712_MESSAGE);
    t.deepEqual(signedMessage, {
      ...message,
      signature:
        "0x1df128dfe1f86df4e20ecc6ebbd586e0ab56e3fc8d0db9210422c3c765633ad8793af68aa232cf39cc3f75ea18f03260258f7276c2e0d555f98e1cf16672dd201c",
    });

    env.DATA_DIR = "dbtestA";
    const trieA = await store.create();
    const { canonical, index } = migration0.oldToDigest(signedMessage);
    await trieA.put(Buffer.from(index, "hex"), canonical);
    t.false(await migration0.isMigrated(trieA, signedMessage));
  }
);
