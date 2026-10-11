// Derives the secret of a Kiwi account's Semaphore identity (anonymous
// upvotes, see src/anon.mjs).
//
// The secret is never the account's ECDSA key itself. Each derivation hashes
// its input together with its own domain tag, so the Semaphore secret reveals
// nothing about the signing key and the two derivations can't collide.
//
// - Passkey accounts: keccak256(prf ‖ utf8("kiwi-semaphore-v1")), where prf
//   is the passkey's PRF output (salt sha256("kiwi-news-identity-v1"), see
//   passkey.mjs). The ECDSA key is keccak256(prf), so it's a sibling of the
//   Semaphore secret, not its parent. Every device with the passkey derives
//   the same secret.
// - Accounts with a stored key (a delegated app key, or a passkey account
//   whose PRF output isn't at hand): keccak256(key ‖ utf8("kiwi-semaphore-key-v1")).
//   A delegated key exists per device, so a second device derives another
//   secret; joining from it replaces the first device's commitment.
//
// NOTE: Keep this module free of browser-only code and heavy imports; it's
// imported by passkey.mjs and by the node tests (test/anon_identity_test.mjs).
import { keccak256 } from "@ethersproject/keccak256";

export const PRF_TAG = "kiwi-semaphore-v1";
export const KEY_TAG = "kiwi-semaphore-key-v1";

function toBytes(input, name) {
  if (typeof input === "string") {
    const clean = input.startsWith("0x") ? input.slice(2) : input;
    if (!/^[0-9a-fA-F]*$/.test(clean) || clean.length % 2 !== 0) {
      throw new Error(`${name} must be hex`);
    }
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
    }
    return bytes;
  }
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  return new Uint8Array(input);
}

function tagged(bytes, tag) {
  const suffix = new TextEncoder().encode(tag);
  const data = new Uint8Array(bytes.length + suffix.length);
  data.set(bytes, 0);
  data.set(suffix, bytes.length);
  return keccak256(data);
}

// prf: the 32-byte PRF output (Uint8Array, ArrayBuffer or 0x-hex).
export function secretFromPrf(prf) {
  const bytes = toBytes(prf, "PRF output");
  if (bytes.length !== 32) throw new Error("PRF output must be 32 bytes");
  return tagged(bytes, PRF_TAG);
}

// privateKey: a 32-byte secp256k1 private key (0x-hex).
export function secretFromKey(privateKey) {
  const bytes = toBytes(privateKey, "Private key");
  if (bytes.length !== 32) throw new Error("Private key must be 32 bytes");
  return tagged(bytes, KEY_TAG);
}

// Where a passkey account keeps its PRF-derived secret, next to its key.
export function storageKey(address) {
  return `-kiwi-news-${address}-semaphore`;
}
