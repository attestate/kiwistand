// The parts of anonymous upvotes that the browser and the node must agree
// on. Kept free of browser-only imports so the node tests can check them
// against src/anon.mjs (test/anon_identity_test.mjs).
import { Identity } from "@semaphore-protocol/identity";
import { keccak256 } from "@ethersproject/keccak256";

function keccakBigInt(text) {
  return BigInt(keccak256(new TextEncoder().encode(text)));
}

// Same as scopeOf and messageOf in src/anon.mjs.
export function scopeOf(href) {
  return keccakBigInt(href).toString();
}
export function messageOf(href, timestamp) {
  return keccakBigInt(`${href}|${timestamp}`).toString();
}

// secret: 0x-hex of 32 bytes (see semaphore-secret.mjs). The bytes are the
// Semaphore v4 (EdDSA) private key.
export function identityFromSecret(secret) {
  const clean = secret.startsWith("0x") ? secret.slice(2) : secret;
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
    throw new Error("Semaphore secret must be 32 bytes of hex");
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return new Identity(bytes);
}
