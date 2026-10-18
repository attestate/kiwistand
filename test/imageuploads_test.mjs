// @format
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import test from "ava";
import { Wallet } from "ethers";

import { EIP712_DOMAIN, EIP712_MESSAGE } from "../src/constants.mjs";

process.env.CACHE_DIR = mkdtempSync(join(tmpdir(), "imageuploads-"));
process.env.IMAGE_UPLOAD_DAILY_LIMIT = "150";
const uploads = await import("../src/imageuploads.mjs");
const bookmarks = await import("../src/bookmarks.mjs");

const { WINDOW, KARMA, TRUSTED, NEWCOMER, NEWCOMER_POOL } = uploads;
const day = (n) => 1_000_000 + n * 10 * WINDOW;
const limited = (t, fn, message) =>
  t.is(t.throws(fn, { message }).status, 429);

test.serial("newcomers and trusted accounts get their own allowance", (t) => {
  const now = day(0);
  for (let i = 0; i < NEWCOMER; i++) uploads.take("0xnew", 0, now);
  limited(
    t,
    () => uploads.take("0xnew", KARMA - 1, now),
    `You can upload up to ${NEWCOMER} images a day`,
  );

  for (let i = 0; i < TRUSTED; i++) uploads.take("0xold", KARMA, now);
  limited(
    t,
    () => uploads.take("0xold", KARMA, now),
    `You can upload up to ${TRUSTED} images a day`,
  );
});

test.serial("the window rolls and a release gives an upload back", (t) => {
  const now = day(1);
  const ids = [];
  for (let i = 0; i < NEWCOMER; i++) ids.push(uploads.take("0xnew", 0, now));
  t.throws(() => uploads.take("0xnew", 0, now + WINDOW - 1));
  t.notThrows(() => uploads.take("0xnew", 0, now + WINDOW));

  const later = day(2);
  const id = uploads.take("0xnew", 0, later);
  uploads.take("0xnew", 0, later);
  uploads.take("0xnew", 0, later);
  t.throws(() => uploads.take("0xnew", 0, later));
  uploads.release(id);
  t.notThrows(() => uploads.take("0xnew", 0, later));
});

test.serial("newcomers share a pool, everyone shares the daily limit", (t) => {
  const now = day(3);
  for (let i = 0; i < NEWCOMER_POOL; i++) {
    uploads.take(`0xfresh${Math.floor(i / NEWCOMER)}`, 0, now);
  }
  limited(
    t,
    () => uploads.take("0xanother", 0, now),
    "Too many image uploads today, try tomorrow",
  );

  for (let i = NEWCOMER_POOL; i < uploads.DAILY_LIMIT; i++) {
    uploads.take(`0xtrusted${Math.floor(i / TRUSTED)}`, KARMA, now);
  }
  t.is(uploads.DAILY_LIMIT, 150);
  limited(
    t,
    () => uploads.take("0xrich", 1000, now),
    "Kiwi's daily image upload limit is reached, try tomorrow",
  );
});

test.serial("only a signed image-upload message is accepted", async (t) => {
  const wallet = Wallet.createRandom();
  const sign = async (type) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const message = { title: "", href: "", type, timestamp };
    const signature = await wallet._signTypedData(
      EIP712_DOMAIN,
      EIP712_MESSAGE,
      message,
    );
    return { ...message, signature };
  };
  const identity = await bookmarks.verify(await sign(uploads.TYPE), [
    uploads.TYPE,
  ]);
  t.is(identity, wallet.address.toLowerCase());
  await t.throwsAsync(
    async () => bookmarks.verify(await sign("amplify"), [uploads.TYPE]),
    { message: "Invalid message type" },
  );
});
