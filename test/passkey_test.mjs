import test from "ava";
import { createHash } from "crypto";

import {
  PRF_SALT_HEX,
  derive,
  salt,
  rpIdFor,
} from "../src/web/src/passkey.mjs";

test("PRF salt is sha256('kiwi-news-identity-v1')", (t) => {
  const expected =
    "0x" +
    createHash("sha256").update("kiwi-news-identity-v1", "utf8").digest("hex");
  t.is(PRF_SALT_HEX, expected);
  t.is(
    PRF_SALT_HEX,
    "0xf26714c4a2441159233461fcee89b7c32e88125e81547fc821a52db871dfe719",
  );
  t.is(salt().length, 32);
  t.is(salt()[0], 0xf2);
});

test("derive matches the shared test vector", (t) => {
  const prf = new Uint8Array(32).fill(1);
  const { privateKey, address } = derive(prf);
  t.is(
    privateKey,
    "0xcebc8882fecbec7fb80d2cf4b312bec018884c2d66667c67a90508214bd8bafc",
  );
  t.is(address, "0x7dE955EA5C8C40f33755C4da8cAC86Dd7fFA8b98");

  // Same result from an ArrayBuffer or hex input
  t.is(derive(prf.buffer).address, address);
  t.is(derive("0x" + "01".repeat(32)).address, address);
});

test("derive rejects PRF outputs that aren't 32 bytes", (t) => {
  t.throws(() => derive(new Uint8Array(31)));
});

test("relying party ID is only set on the production host", (t) => {
  t.is(rpIdFor("news.kiwistand.com"), "news.kiwistand.com");
  t.is(rpIdFor("localhost"), undefined);
  t.is(rpIdFor("staging.kiwistand.com"), undefined);
  t.is(rpIdFor("evilnews.kiwistand.com"), undefined);
});
