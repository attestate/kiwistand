import test from "ava";
import { keccak256 } from "@ethersproject/keccak256";

import { derive } from "../src/web/src/passkey.mjs";
import {
  secretFromPrf,
  secretFromKey,
  PRF_TAG,
  KEY_TAG,
} from "../src/web/src/semaphore-secret.mjs";
import {
  identityFromSecret,
  scopeOf as webScopeOf,
  messageOf as webMessageOf,
} from "../src/web/src/anon-core.mjs";
import { scopeOf, messageOf } from "../src/anon.mjs";

const prf = new Uint8Array(32).fill(1);

test("the Semaphore secret is derived deterministically from the PRF", (t) => {
  const secret = secretFromPrf(prf);
  t.is(secret, secretFromPrf(prf));
  t.is(secret, secretFromPrf(prf.buffer));
  t.is(secret, secretFromPrf("0x" + "01".repeat(32)));
  // keccak256(prf ‖ utf8("kiwi-semaphore-v1"))
  const tagged = new Uint8Array([...prf, ...new TextEncoder().encode(PRF_TAG)]);
  t.is(secret, keccak256(tagged));
  // Pinned test vector, shared with the native apps.
  t.is(
    secret,
    "0x57cfdd05180bc70ac1034552c9831ef068ad80f9a56dcbfa1c88f74fd6ad9d62",
  );
  t.is(derive(prf).semaphoreSecret, secret);
  t.throws(() => secretFromPrf(new Uint8Array(31)));
});

test("the Semaphore secret is domain-separated from the signing key", (t) => {
  const { privateKey } = derive(prf);
  const fromPrf = secretFromPrf(prf);
  const fromKey = secretFromKey(privateKey);

  // Neither secret is the ECDSA key or keccak256(prf) (which is the key).
  t.not(fromPrf, privateKey);
  t.not(fromKey, privateKey);
  t.not(fromPrf, keccak256(prf));
  // The PRF and key derivations use different tags, so they never collide,
  // not even on the same 32 input bytes.
  t.not(PRF_TAG, KEY_TAG);
  t.not(secretFromKey(fromPrf), secretFromPrf(fromPrf));
  t.not(fromPrf, fromKey);
  // Different inputs, different secrets.
  t.not(secretFromPrf(new Uint8Array(32).fill(2)), fromPrf);
  t.is(fromKey, secretFromKey(privateKey));
});

test("a secret always gives the same identity commitment", (t) => {
  const secret = secretFromPrf(prf);
  const a = identityFromSecret(secret);
  const b = identityFromSecret(secret.slice(2));
  t.is(a.commitment, b.commitment);
  t.not(
    identityFromSecret(secretFromKey(derive(prf).privateKey)).commitment,
    a.commitment,
  );
  t.throws(() => identityFromSecret("0x1234"));
});

test("browser and node agree on scope and message", (t) => {
  const href = `kiwi:0x${"ab".repeat(36)}`;
  t.is(webScopeOf(href), scopeOf(href));
  t.is(webMessageOf(href, 1700000000), messageOf(href, 1700000000));
  t.not(messageOf(href, 1700000000), messageOf(href, 1700000001));
  t.not(scopeOf(href), scopeOf(`kiwi:0x${"cd".repeat(36)}`));
});
