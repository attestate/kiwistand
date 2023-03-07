//@format
import { access, unlink } from "fs/promises";
import { constants } from "fs";

import test from "ava";
import { createSecp256k1PeerId } from "@libp2p/peer-id-factory";
import { Wallet, utils } from "ethers";

import {
  sign,
  create,
  verify,
  toDigest,
  bootstrap,
  load,
  store,
} from "../src/id.mjs";
import config from "../src/config.mjs";
import { appdir } from "../src/utils.mjs";

const idPath = `${appdir()}/test/.keys.json`;

async function teardown(t) {
  try {
    await access(idPath, constants.F_OK);
  } catch {
    return;
  }

  await unlink(idPath);
}

test("generating digest from message", (t) => {
  const message = {
    timestamp: "2023-01-15T16:06:31.749Z",
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
  };
  const { digest } = toDigest(message);
  t.is(
    digest,
    "cc39a37522a2dd194264f0ec7bb9aca4694ba4e1ae4ea38d0846038355da17ba"
  );
});

test.serial("if bootstrapping id is working", async (t) => {
  try {
    await access(idPath, constants.F_OK);
    t.fail();
  } catch (err) {
    t.true(true);
  }
  const peerId = await bootstrap(idPath);

  try {
    await access(idPath, constants.F_OK);
    t.pass();
  } catch (err) {
    t.log(err);
    t.fail();
  }

  t.teardown(teardown);
});

test.serial("if id can be persisted", async (t) => {
  const id = await createSecp256k1PeerId();
  await store(idPath, id);

  try {
    await access(idPath, constants.F_OK);
    t.pass();
  } catch (err) {
    t.fail(err.toString());
  }

  t.teardown(teardown);
});

test.serial("loading a non-existent peer id file", async (t) => {
  await t.throwsAsync(async () => await load(idPath), {
    instanceOf: Error,
  });
});

test.serial("if id can be loaded", async (t) => {
  const id = await createSecp256k1PeerId();
  await store(idPath, id);
  const peerId = await load(idPath);
  t.is(id.toString(), peerId.toString());
  t.teardown(teardown);
});

test("sign message", async (t) => {
  const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
  const privateKey =
    "0xad54bdeade5537fb0a553190159783e45d02d316a992db05cbed606d3ca36b39";
  const signer = new Wallet(privateKey);
  t.is(signer.address, address);

  const text = "hello world";
  const timestamp = 1676559616;
  const message = create(text, timestamp);
  const signedMessage = await sign(signer, message);
  t.deepEqual(signedMessage, {
    ...message,
    signature:
      "0x36223f46ea950a810689fb72ea1fd075922c5f7d7a7c644c1ee3787fb9d21a847b4e93d126a40e209e8871440058ad87a6a2e772c8d6f9e0bf397dee457141411b",
  });
});

test("verify message", async (t) => {
  const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
  const privateKey =
    "0xad54bdeade5537fb0a553190159783e45d02d316a992db05cbed606d3ca36b39";
  const signer = new Wallet(privateKey);
  t.is(signer.address, address);

  const text = "hello world";
  const timestamp = 1676559616;
  const message = create(text, timestamp);
  const signedMessage = await sign(signer, message);
  t.deepEqual(signedMessage, {
    ...message,
    signature:
      "0x36223f46ea950a810689fb72ea1fd075922c5f7d7a7c644c1ee3787fb9d21a847b4e93d126a40e209e8871440058ad87a6a2e772c8d6f9e0bf397dee457141411b",
  });
  const recoveredAddr = verify(signedMessage);
  t.is(recoveredAddr, address);
});
