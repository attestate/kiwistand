// Passkey sign-in with a PRF-derived identity key.
//
// The passkey is only used locally: its PRF output is hashed into a secp256k1
// private key whose address acts as its own Kiwi identity (resolveIdentity
// returns the address itself when it has no delegation). No server
// verification, no wallet, no transaction. Must stay byte-identical with the
// iOS app (see the shared spec), so don't change the constants below.
//
// NOTE: Keep this module free of browser-only top-level code; it's imported
// by the node tests (test/passkey_test.mjs).
import { keccak256 } from "@ethersproject/keccak256";
import { Wallet } from "@ethersproject/wallet";

import { secretFromPrf, storageKey } from "./semaphore-secret.mjs";

export const RP_ID = "news.kiwistand.com";
export const RP_NAME = "Kiwi News";
export const USER_NAME = "Kiwi News";
// SHA-256(utf8("kiwi-news-identity-v1"))
export const PRF_SALT_HEX =
  "0xf26714c4a2441159233461fcee89b7c32e88125e81547fc821a52db871dfe719";
export const PRF_UNSUPPORTED_MESSAGE =
  "This passkey manager doesn't support Kiwi sign-in yet. Use Apple Passwords or Google Password Manager, or connect a wallet.";
export const USED_FLAG = "-kiwi-news-passkey-used";

const SECP256K1_N = BigInt(
  "0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141",
);

export class PrfUnsupportedError extends Error {
  constructor() {
    super(PRF_UNSUPPORTED_MESSAGE);
    this.name = "PrfUnsupportedError";
  }
}

export function hexToBytes(hex) {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}

export function salt() {
  return hexToBytes(PRF_SALT_HEX);
}

// prfBytes: the 32-byte PRF output (Uint8Array, ArrayBuffer or 0x-hex)
export function derive(prfBytes) {
  let input;
  if (typeof prfBytes === "string") input = hexToBytes(prfBytes);
  else if (prfBytes instanceof ArrayBuffer) input = new Uint8Array(prfBytes);
  else input = new Uint8Array(prfBytes);
  if (input.length !== 32) throw new Error("PRF output must be 32 bytes");

  let privateKey = keccak256(input);
  // NOTE: Practically never happens, but a key of 0 or >= n is invalid.
  while (BigInt(privateKey) === 0n || BigInt(privateKey) >= SECP256K1_N) {
    privateKey = keccak256(privateKey);
  }
  const { address } = new Wallet(privateKey);
  // NOTE: The secret of the account's Semaphore identity (anonymous upvotes)
  // comes from the same PRF output under its own domain tag, see
  // semaphore-secret.mjs.
  const semaphoreSecret = secretFromPrf(input);
  return { privateKey, address, semaphoreSecret };
}

// Only use the production relying party ID on the production host; anywhere
// else (localhost, staging) let the browser default to the current origin.
export function rpIdFor(hostname) {
  if (hostname === RP_ID || (hostname && hostname.endsWith("." + RP_ID))) {
    return RP_ID;
  }
  return undefined;
}

export function isSupported() {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.credentials
  );
}

export function hasUsedPasskey() {
  try {
    return localStorage.getItem(USED_FLAG) === "true";
  } catch (err) {
    return false;
  }
}

export function isCancellation(err) {
  return !!err && (err.name === "NotAllowedError" || err.name === "AbortError");
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function prfFrom(credential) {
  const ext = credential?.getClientExtensionResults?.() || {};
  const first = ext.prf?.results?.first;
  return first ? new Uint8Array(first) : null;
}

async function getAssertion(rpId, allowCredentials) {
  const publicKey = {
    challenge: randomBytes(32),
    userVerification: "required",
    timeout: 120000,
    extensions: { prf: { eval: { first: salt() } } },
  };
  if (rpId) publicKey.rpId = rpId;
  if (allowCredentials) publicKey.allowCredentials = allowCredentials;
  return navigator.credentials.get({ publicKey });
}

// Creates a new discoverable passkey and returns the derived account.
// `name` (the nickname) is what password managers show as the account.
export async function create({ hostname = location.hostname, name } = {}) {
  const rpId = rpIdFor(hostname);
  const rp = { name: RP_NAME };
  if (rpId) rp.id = rpId;

  const credential = await navigator.credentials.create({
    publicKey: {
      rp,
      user: {
        id: randomBytes(16),
        name: name || USER_NAME,
        displayName: name || USER_NAME,
      },
      challenge: randomBytes(32),
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        residentKey: "required",
        requireResidentKey: true,
        userVerification: "required",
      },
      timeout: 120000,
      extensions: { prf: { eval: { first: salt() } } },
    },
  });
  if (!credential) throw new Error("No passkey was created");

  let prf = prfFrom(credential);
  if (!prf) {
    // NOTE: Some platforms only report prf.enabled on create, so we ask for
    // the PRF output with an assertion of the credential we just made.
    const assertion = await getAssertion(rpId, [
      { type: "public-key", id: credential.rawId },
    ]);
    prf = prfFrom(assertion);
  }
  if (!prf) throw new PrfUnsupportedError();
  return derive(prf);
}

// Signs in with an existing (discoverable) passkey.
export async function signIn({ hostname = location.hostname } = {}) {
  const assertion = await getAssertion(rpIdFor(hostname));
  if (!assertion) throw new Error("No passkey was selected");
  const prf = prfFrom(assertion);
  if (!prf) throw new PrfUnsupportedError();
  return derive(prf);
}

// Stores the derived key the same way delegated app keys are stored, so
// getLocalAccount (session.mjs) and theme-init.js treat the user as logged in.
export function storeAccount({ privateKey, address, semaphoreSecret }) {
  // NOTE: getLocalAccount only logs in with exactly one stored key, so an
  // older app key left in this browser would otherwise log nobody in.
  const schema = /^-kiwi-news-0x[a-fA-F0-9]{40}-(key|semaphore)$/;
  for (const key of Object.keys(localStorage)) {
    if (schema.test(key)) localStorage.removeItem(key);
  }
  localStorage.setItem(`-kiwi-news-${address}-key`, privateKey);
  if (semaphoreSecret) {
    localStorage.setItem(storageKey(address), semaphoreSecret);
  }
  try {
    localStorage.setItem(USED_FLAG, "true");
    localStorage.removeItem("anon-mode");
  } catch (err) {}
}
