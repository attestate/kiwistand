// @format
// Delegations (protocol 15.0.0).
//
// An account lets a key sign for it with one `Delegation` message that the
// account signs (EIP712_DELEGATION in src/constants.mjs). It holds the key's
// signature of `Authorization(address from,bool authorize)` for the account,
// so nobody can claim a key without its consent. No transaction, no ETH. A
// revocation is the same message with `authorize` false and no key
// signature.
//
// The order of the messages (src/commits.mjs) decides whom a key's message
// counts for: the account of the key's latest delegation before it, or the
// key itself if that was a revocation. A revocation only counts if the key's
// account at that point signed it. Messages a key signed before its first
// delegation count for that delegation's account. Delegations from OP
// Mainnet (the snapshot) come before every message.
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

export function create({ account, key, authorization, authorize, timestamp }) {
  return {
    type: "delegation",
    account,
    key,
    authorization: authorize ? authorization : "0x",
    authorize,
    timestamp,
  };
}

// The key's half: its signature of the account's address.
export async function authorization(key, account) {
  const value = { from: utils.getAddress(account), authorize: true };
  return await key._signTypedData(EIP712_DOMAIN, EIP712_AUTHORIZATION, value);
}

// The account that signed a delegation, or throws. EOAs are checked locally;
// a smart wallet's signature (ERC-1271, or ERC-6492 before it's deployed)
// needs an RPC of the chain it lives on (SMART_WALLET_RPC_URL).
export async function verify(message, rpc = env.SMART_WALLET_RPC_URL) {
  validate(message);
  const account = utils.getAddress(message.account);
  const key = utils.getAddress(message.key);
  if (account === key) throw new Error("A key can't be its own account");

  const { type, authorization, authorize, timestamp, signature } = message;
  if (authorize) {
    const value = { from: account, authorize: true };
    const signer = utils.verifyTypedData(
      EIP712_DOMAIN,
      EIP712_AUTHORIZATION,
      value,
      authorization,
    );
    if (signer !== key) throw new Error("The key didn't sign the account");
  } else if (authorization !== "0x") {
    throw new Error("A revocation has no authorization");
  }

  const value = { type, key, authorization, authorize, timestamp };
  let signer;
  try {
    signer = utils.verifyTypedData(
      EIP712_DOMAIN,
      EIP712_DELEGATION,
      value,
      signature,
    );
  } catch (err) {
    // NOTE: Not an ECDSA signature, e.g. a smart wallet's.
  }
  if (signer === account) return account;
  if (!rpc) throw new Error("The account didn't sign the delegation");

  const client = createPublicClient({ transport: http(rpc) });
  const valid = await client.verifyTypedData({
    address: account,
    domain: EIP712_DOMAIN,
    types: EIP712_DELEGATION,
    primaryType: "Delegation",
    message: value,
    signature,
  });
  if (!valid) throw new Error("The account didn't sign the delegation");
  return account;
}

// Places in the order are arrays compared element by element (see
// commits.position).
export function compare(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

// The account a key signs for at place `at` among its delegations (sorted by
// place), or null if it signs for itself.
function attribute(entries, at) {
  let account;
  for (const entry of entries) {
    if (compare(entry.at, at) >= 0) break;
    if (entry.authorize) account = entry.account;
    else if (account === entry.account) account = null;
  }
  if (account === undefined) {
    account = entries.find(({ authorize }) => authorize)?.account ?? null;
  }
  return account;
}

export const HISTORY = Symbol("history");
const LAST = [Infinity, Infinity];

// The delegations as nodes pass them around: keys to their accounts now, for
// resolveIdentity of @attestate/delegator2. Under HISTORY, every key's
// delegations in order, for `resolve`. `base` are keys to accounts from
// before the protocol's delegations, `rows` the delegation messages
// ({index, key, account, authorize}) and `position` gives an index's place.
export function build(base, rows, position) {
  const keys = new Map();
  for (const [key, account] of Object.entries(base)) {
    keys.set(utils.getAddress(key), [
      { account: utils.getAddress(account), authorize: true, at: [-Infinity] },
    ]);
  }
  for (const row of rows) {
    const key = utils.getAddress(row.key);
    if (!keys.has(key)) keys.set(key, []);
    keys.get(key).push({
      account: utils.getAddress(row.account),
      authorize: Boolean(row.authorize),
      at: position(row.index),
    });
  }

  const delegations = {};
  for (const [key, entries] of keys) {
    entries.sort((a, b) => compare(a.at, b.at));
    const account = attribute(entries, LAST);
    if (account) delegations[key] = account;
  }
  delegations[HISTORY] = { keys, position };
  return delegations;
}

// Whom the message `index` that `signer` signed counts for.
export function resolve(delegations, signer, index) {
  const address = utils.getAddress(signer);
  const history = delegations[HISTORY];
  const entries = history?.keys.get(address);
  if (!entries || index === undefined) {
    return resolveIdentity(delegations, address);
  }
  if (entries.length === 1 && entries[0].authorize) return entries[0].account;
  return attribute(entries, history.position(index)) ?? address;
}

// The keys that ever signed for `identity`.
export function keysOf(delegations, identity) {
  const target = identity.toLowerCase();
  const keys = [];
  for (const [key, entries] of delegations[HISTORY]?.keys ?? []) {
    if (entries.some(({ account }) => account.toLowerCase() === target)) {
      keys.push(key);
    }
  }
  return keys;
}
