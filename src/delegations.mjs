// @format
// Delegations (protocol 15.0.0).
//
// An identity (the user's wallet, which owns profile and karma) lets a signer
// (a key on a device, which signs stories, upvotes and comments) sign for it
// with one `Delegation` message that the identity signs (EIP712_DELEGATION in
// src/constants.mjs). It holds the signer's signature of
// `Authorization(address identity,bool authorize)` for the identity, so
// nobody can claim a signer without its consent. No transaction, no ETH. A
// revocation is the same message with `authorize` false and no signature of
// the signer.
//
// Timestamps decide whom a signer's message counts for: the identity of the
// signer's latest delegation dated before it, or the signer itself if that
// was a revocation. A revocation only counts if the signer's identity at that
// point signed it. Messages a signer signed before its first delegation count
// for that delegation's identity. Delegations from OP Mainnet (the snapshot)
// come before every message.
import { env } from "process";

import { utils } from "ethers";
import { createPublicClient, http } from "viem";
import { resolveIdentity } from "@attestate/delegator2";

import {
  EIP712_DOMAIN,
  EIP712_DELEGATION,
  EIP712_AUTHORIZATION,
} from "./constants.mjs";
import { validate } from "./id.mjs";

export function create({
  identity,
  signer,
  authorization,
  authorize,
  timestamp,
}) {
  return {
    type: "delegation",
    identity,
    signer,
    authorization: authorize ? authorization : "0x",
    authorize,
    timestamp,
  };
}

// The signer's half: its signature of the identity's address.
export async function authorization(signer, identity) {
  const value = { identity: utils.getAddress(identity), authorize: true };
  return await signer._signTypedData(
    EIP712_DOMAIN,
    EIP712_AUTHORIZATION,
    value,
  );
}

// The identity that signed a delegation, or throws. EOAs are checked locally;
// a smart wallet's signature (ERC-1271, or ERC-6492 before it's deployed)
// needs an RPC of the chain it lives on (SMART_WALLET_RPC_URL).
export async function verify(message, rpc = env.SMART_WALLET_RPC_URL) {
  validate(message);
  const identity = utils.getAddress(message.identity);
  const signer = utils.getAddress(message.signer);
  if (identity === signer) {
    throw new Error("A signer can't be its own identity");
  }

  const { type, authorization, authorize, timestamp, signature } = message;
  if (authorize) {
    const value = { identity, authorize: true };
    const recovered = utils.verifyTypedData(
      EIP712_DOMAIN,
      EIP712_AUTHORIZATION,
      value,
      authorization,
    );
    if (recovered !== signer) {
      throw new Error("The signer didn't sign the identity");
    }
  } else if (authorization !== "0x") {
    throw new Error("A revocation has no authorization");
  }

  const value = { type, signer, authorization, authorize, timestamp };
  let recovered;
  try {
    recovered = utils.verifyTypedData(
      EIP712_DOMAIN,
      EIP712_DELEGATION,
      value,
      signature,
    );
  } catch (err) {
    // NOTE: Not an ECDSA signature, e.g. a smart wallet's.
  }
  if (recovered === identity) return identity;
  if (!rpc) throw new Error("The identity didn't sign the delegation");

  const client = createPublicClient({ transport: http(rpc) });
  const valid = await client.verifyTypedData({
    address: identity,
    domain: EIP712_DOMAIN,
    types: EIP712_DELEGATION,
    primaryType: "Delegation",
    message: value,
    signature,
  });
  if (!valid) throw new Error("The identity didn't sign the delegation");
  return identity;
}

// Delegations are sorted by [timestamp, index], arrays compared element by
// element.
function compare(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

// A trie key's timestamp.
const timestampOf = (index) => parseInt(index.slice(0, -64), 16);

// The identity a signer signs for at `timestamp` among its delegations
// (sorted), or null if it signs for itself.
function attribute(entries, timestamp) {
  let identity;
  for (const entry of entries) {
    if (entry.at[0] >= timestamp) break;
    if (entry.authorize) identity = entry.identity;
    else if (identity === entry.identity) identity = null;
  }
  if (identity === undefined) {
    identity = entries.find(({ authorize }) => authorize)?.identity ?? null;
  }
  return identity;
}

export const HISTORY = Symbol("history");

// The delegations as nodes pass them around: signers to their identities now,
// for resolveIdentity of @attestate/delegator2. Under HISTORY, every signer's
// delegations by timestamp, for `resolve`. `base` are signers to identities
// from before the protocol's delegations and `rows` the delegation messages
// ({index, signer, identity, authorize}).
export function build(base, rows) {
  const signers = new Map();
  for (const [signer, identity] of Object.entries(base)) {
    signers.set(utils.getAddress(signer), [
      {
        identity: utils.getAddress(identity),
        authorize: true,
        at: [-Infinity],
      },
    ]);
  }
  for (const row of rows) {
    const signer = utils.getAddress(row.signer);
    if (!signers.has(signer)) signers.set(signer, []);
    signers.get(signer).push({
      identity: utils.getAddress(row.identity),
      authorize: Boolean(row.authorize),
      at: [timestampOf(row.index), row.index],
    });
  }

  const delegations = {};
  for (const [signer, entries] of signers) {
    entries.sort((a, b) => compare(a.at, b.at));
    const identity = attribute(entries, Infinity);
    if (identity) delegations[signer] = identity;
  }
  delegations[HISTORY] = { signers };
  return delegations;
}

// Whom the message `index` that `signer` signed counts for.
export function resolve(delegations, signer, index) {
  const address = utils.getAddress(signer);
  const history = delegations[HISTORY];
  const entries = history?.signers.get(address);
  if (!entries || index === undefined) {
    return resolveIdentity(delegations, address);
  }
  if (entries.length === 1 && entries[0].authorize) {
    return entries[0].identity;
  }
  return attribute(entries, timestampOf(index)) ?? address;
}

// The signers that ever signed for `identity`.
export function keysOf(delegations, identity) {
  const target = identity.toLowerCase();
  const signers = [];
  for (const [signer, entries] of delegations[HISTORY]?.signers ?? []) {
    if (entries.some((entry) => entry.identity.toLowerCase() === target)) {
      signers.push(signer);
    }
  }
  return signers;
}
