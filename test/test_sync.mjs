// @format
import test from "ava";
import { Wallet, utils } from "ethers";

import { toDigest, verify } from "../src/sync.mjs";

test("handle validating a message and checking its signature", async (t) => {
  const address = "0x0f6A79A579658E401E0B81c6dde1F2cd51d97176";
  const privateKey =
    "0xad54bdeade5537fb0a553190159783e45d02d316a992db05cbed606d3ca36b39";
  const signer = new Wallet(privateKey);
  t.is(signer.address, address);

  const message = {
    timestamp: "2023-01-15T16:06:31.749Z",
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
  };
  const digest = toDigest(message);
  message.signature = await signer.signMessage(digest);
  const recoveredAddr = verify(message);
  t.is(recoveredAddr, address);
});

test("generating digest from message", (t) => {
  const message = {
    timestamp: "2023-01-15T16:06:31.749Z",
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
    signature: "0x00",
  };
  const digest = toDigest(message);
  t.is(
    digest,
    "0xcc39a37522a2dd194264f0ec7bb9aca4694ba4e1ae4ea38d0846038355da17ba"
  );
});
