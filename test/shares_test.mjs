// @format
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import test from "ava";
import { Wallet } from "ethers";

import { EIP712_DOMAIN, EIP712_MESSAGE } from "../src/constants.mjs";

process.env.CACHE_DIR = mkdtempSync(join(tmpdir(), "shares-"));
const shares = await import("../src/shares.mjs");
const { MAX_AGE } = await import("../src/bookmarks.mjs");
const cache = await import("../src/cache.mjs");

const HREF = "https://example.com/story";
const now = () => Math.floor(Date.now() / 1000);
const trusted = () => shares.MIN_SHARE_KARMA;

async function sign(wallet, type, timestamp = now()) {
  const message = { title: "native", href: HREF, type, timestamp };
  const signature = await wallet._signTypedData(
    EIP712_DOMAIN,
    EIP712_MESSAGE,
    message,
  );
  return { ...message, signature };
}

test("a signed share resolves to its signer", async (t) => {
  const wallet = Wallet.createRandom();
  const message = await sign(wallet, "share");
  const identity = await shares.authorize(message, trusted);
  t.is(identity, wallet.address.toLowerCase());
});

test("rejects unsigned, amplify and stale messages", async (t) => {
  const wallet = Wallet.createRandom();
  const message = await sign(wallet, "share");
  const { signature, ...unsigned } = message;
  await t.throwsAsync(() => shares.authorize(unsigned, trusted), {
    message: "Invalid message",
  });

  const amplify = await sign(wallet, "amplify");
  await t.throwsAsync(() => shares.authorize(amplify, trusted), {
    message: "Invalid message type",
  });

  const stale = await sign(wallet, "share", now() - MAX_AGE - 5);
  await t.throwsAsync(() => shares.authorize(stale, trusted), {
    message: "Message expired, sign it again",
  });
});

test("doesn't count accounts below MIN_SHARE_KARMA", async (t) => {
  const wallet = Wallet.createRandom();
  const message = await sign(wallet, "share");
  const low = () => shares.MIN_SHARE_KARMA - 1;
  t.is(await shares.authorize(message, low), null);
});

test("an identity counts once per story", async (t) => {
  cache.initializeShares();
  const wallet = Wallet.createRandom();
  const first = await shares.authorize(await sign(wallet, "share"), trusted);
  const second = await shares.authorize(await sign(wallet, "share"), trusted);
  cache.trackShare(HREF, first, "native");
  cache.trackShare(HREF, second, "native");
  t.is(cache.countShares(HREF), 1);
});
