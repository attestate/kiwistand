//@format
import { env } from "process";
import { rm } from "fs/promises";

import test from "ava";
import { encode } from "cbor-x";
import { Wallet } from "ethers";

import { sign, create } from "../src/id.mjs";
import {
  handleMessage,
  listMessages,
  listAllowed,
  listDelegations,
} from "../src/api.mjs";
import * as store from "../src/store.mjs";
import { EIP712_MESSAGE } from "../src/constants.mjs";

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

test("list delegation addresses", async (t) => {
  const mockRequest = {};
  const mockReply = {
    status: (code) => ({
      json: (response) => response,
    }),
  };

  const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
  const delegations = () => [address];
  const response = await listDelegations(delegations)(mockRequest, mockReply);

  t.is(response.status, "success");
  t.is(response.code, 200);
  t.is(response.message, "OK");
  t.is(response.data.length, 1);
  t.deepEqual(response.data, delegations());
});

test("list allowed addresses", async (t) => {
  const mockRequest = {};
  const mockReply = {
    status: (code) => ({
      json: (response) => response,
    }),
  };

  const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
  const list = [address];
  const allowlist = () => new Set(list);
  const response = await listAllowed(allowlist)(mockRequest, mockReply);

  t.is(response.status, "success");
  t.is(response.code, 200);
  t.is(response.message, "OK");
  t.is(response.data.length, 1);
  t.deepEqual(response.data, list);
});

test("listMessages success", async (t) => {
  const mockRequest = {
    body: {
      from: 0,
      amount: 2,
    },
  };
  const mockReply = {
    status: (code) => ({
      json: (response) => response,
    }),
  };

  const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
  const privateKey =
    "0xad54bdeade5537fb0a553190159783e45d02d316a992db05cbed606d3ca36b39";
  const signer = new Wallet(privateKey);
  t.is(signer.address, address);

  const title = "hello world";
  const href = "https://example.com";
  const type = "amplify";
  const timestamp = 1676559616;
  const message = create(title, href, type, timestamp);
  const signedMessage = await sign(signer, message, EIP712_MESSAGE);
  t.deepEqual(signedMessage, {
    ...message,
    signature:
      "0x1df128dfe1f86df4e20ecc6ebbd586e0ab56e3fc8d0db9210422c3c765633ad8793af68aa232cf39cc3f75ea18f03260258f7276c2e0d555f98e1cf16672dd201c",
  });

  env.DATA_DIR = "dbtestA";
  const trie = await store.create();
  const libp2p = null;
  const allowlist = new Set([address]);
  await store.add(trie, signedMessage, libp2p, allowlist);

  const getAllowlist = () => allowlist;
  const getDelegations = () => ({});
  const response = await listMessages(
    trie,
    getAllowlist,
    getDelegations,
  )(mockRequest, mockReply);

  console.log(response);
  t.is(response.status, "success");
  t.is(response.code, 200);
  t.is(response.message, "OK");
  t.is(response.data[0].title, "hello world");
  t.is(response.data[0].signer, address);
  t.is(response.data[0].identity, address);

  await rm("dbtestA", { recursive: true });
});

test("handleMessage should send back an error upon invalid address signer", async (t) => {
  const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
  const privateKey =
    "0xad54bdeade5537fb0a553190159783e45d02d316a992db05cbed606d3ca36b39";
  const signer = new Wallet(privateKey);
  t.is(signer.address, address);

  const text = "hello world";
  const href = "https://example.com";
  const type = "amplify";
  const timestamp = 1676559616;
  const message = create(text, href, type, timestamp);
  const signedMessage = await sign(signer, message, EIP712_MESSAGE);

  const request = {
    body: signedMessage,
  };

  const reply = {
    status: (code) => reply,
    json: (response) => {
      console.log(response);
      t.is(response.status, "error");
      t.is(response.code, 400);
      t.is(response.message, "Bad Request");
      t.true(response.details.includes("You must mint"));
    },
  };

  env.DATA_DIR = "dbtestA";
  const trie = await store.create();
  const libp2p = null;
  const zeroAddr = "0x0000000000000000000000000000000000000000";
  const allowlist = () => new Set([zeroAddr]);
  const delegations = () => ({});
  const handler = handleMessage(trie, libp2p, allowlist, delegations);

  await handler(request, reply);

  await rm("dbtestA", { recursive: true });
});

test("handleMessage should handle a valid message and return 200 OK", async (t) => {
  const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
  const privateKey =
    "0xad54bdeade5537fb0a553190159783e45d02d316a992db05cbed606d3ca36b39";
  const signer = new Wallet(privateKey);
  t.is(signer.address, address);

  const text = "hello world";
  const href = "https://example.com";
  const type = "amplify";
  const timestamp = 1676559616;
  const message = create(text, href, type, timestamp);
  const signedMessage = await sign(signer, message, EIP712_MESSAGE);

  const request = {
    body: signedMessage,
    query: {
      wait: false,
    },
  };

  const reply = {
    status: (code) => reply,
    json: (response) => {
      t.is(response.status, "success");
      t.is(response.code, 200);
      t.is(response.message, "OK");
      t.is(response.details, "Message included");
    },
  };

  env.DATA_DIR = "dbtestA";
  const trie = await store.create();
  const libp2p = null;
  const allowlist = () => new Set([address]);
  const delegations = () => ({});
  const handler = handleMessage(trie, libp2p, allowlist, delegations);

  await handler(request, reply);

  await rm("dbtestA", { recursive: true });
});

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
        json: (message) => {
          t.truthy(message);
        },
      };
    },
  };
  await route(request, reply);

  await rm("dbtestA", { recursive: true });
});
