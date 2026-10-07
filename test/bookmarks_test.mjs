// @format
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import test from "ava";
import { Wallet } from "ethers";

import { EIP712_DOMAIN, EIP712_MESSAGE } from "../src/constants.mjs";

process.env.CACHE_DIR = mkdtempSync(join(tmpdir(), "bookmarks-"));
const bookmarks = await import("../src/bookmarks.mjs");

const INDEX = `0x${"6ac42ff3".padEnd(72, "a")}`;
const now = () => Math.floor(Date.now() / 1000);

async function sign(wallet, type, href = "", timestamp = now()) {
  const message = { title: "", href, type, timestamp };
  const signature = await wallet._signTypedData(
    EIP712_DOMAIN,
    EIP712_MESSAGE,
    message,
  );
  return { ...message, signature };
}

test("a signed message resolves to its signer", async (t) => {
  const wallet = Wallet.createRandom();
  const message = await sign(wallet, "bookmark", `kiwi:${INDEX}`);
  const identity = await bookmarks.verify(message, ["bookmark"]);
  t.is(identity, wallet.address.toLowerCase());
});

test("rejects the wrong type, a tampered message and an old one", async (t) => {
  const wallet = Wallet.createRandom();
  const list = await sign(wallet, "bookmarks");
  await t.throwsAsync(() => bookmarks.verify(list, ["bookmark"]), {
    message: "Invalid message type",
  });

  const save = await sign(wallet, "bookmark", `kiwi:${INDEX}`);
  const other = { ...save, href: `kiwi:0x${"b".repeat(72)}` };
  const identity = await bookmarks.verify(other, ["bookmark"]).catch(() => null);
  t.not(identity, wallet.address.toLowerCase());

  const old = await sign(wallet, "bookmarks", "", now() - bookmarks.MAX_AGE - 5);
  await t.throwsAsync(() => bookmarks.verify(old, ["bookmarks"]), {
    message: "Message expired, sign it again",
  });
});

test("storyIndex only accepts kiwi:0x<index>", (t) => {
  t.is(bookmarks.storyIndex(`kiwi:${INDEX.toUpperCase().replace("0X", "0x")}`), INDEX);
  t.throws(() => bookmarks.storyIndex("https://example.com"));
  t.throws(() => bookmarks.storyIndex("kiwi:0x1234"));
});

test("save, list and remove are per account", (t) => {
  const alice = "0xalice";
  const bob = "0xbob";
  const other = `0x${"c".repeat(72)}`;
  bookmarks.save(alice, INDEX, { timestamp: 100, signature: "0x1" });
  bookmarks.save(alice, other, { timestamp: 200, signature: "0x2" });
  bookmarks.save(alice, INDEX, { timestamp: 300, signature: "0x3" });

  t.deepEqual(
    bookmarks.list(alice).map((row) => row.index),
    [other, INDEX],
  );
  t.deepEqual(bookmarks.list(bob), []);

  bookmarks.remove(alice, INDEX);
  t.deepEqual(
    bookmarks.list(alice).map((row) => row.index),
    [other],
  );
});
