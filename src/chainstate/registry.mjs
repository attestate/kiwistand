// @format
import { resolve } from "path";
import { createHash } from "crypto";

import { differenceInDays } from "date-fns";
import { utils } from "ethers";
import { database } from "@attestate/crawler";
import { organize } from "@attestate/delegator2";
import * as blockLogs from "@attestate/crawler-call-block-logs";

const { aggregate } = blockLogs.loader;

import mainnet from "./mainnet-mints.mjs";

let cachedDelegations = {};
await refreshDelegations();
export async function delegations() {
  return cachedDelegations;
}
export async function refreshDelegations() {
  const path = resolve(process.env.DATA_DIR, "list-delegations-load-2");
  const maxReaders = 500;
  const db = database.open(path, maxReaders);
  const name = database.order("list-delegations-2");
  const subdb = db.openDB(name);
  const all = await database.all(subdb, "");
  // NOTE: Since a revocation alters the set of addresses with permissions to
  // store data on the network, and since the revocation essentially gives a
  // user the option to remove an address from the delegation mapping
  // indefinitely, this can cause a reconciliation bug where when a user
  // revokes an address, the reconciliation algorithm - for synchronizations
  // with new nodes would consider a formerly valid but now revoked signer key
  // not part of the signer set and hence, for the new node, some received
  // older messages would appear as invalid and split the network. A mitigation
  // of this problem could be to delete or tombstone all messages immediately
  // after a delegate key is revoked.
  // Hence, below we are checking if the last bit of data[2] (`bool
  // authorize`) is zero. If so, we're filtering it from the delegation event
  // logs as to not allow revocations to be validated.
  const logs = all
    .map(({ value }) => ({ ...value, data: value.data.data }))
    .filter(({ data }) => BigInt(data[2]) % 2n !== 0n);

  cachedDelegations = organize(logs);
}

// NOTE: For the purpose of set reconciliation, we must know the first moment
// of ownership, so in which block the user minted the NFT. However, for
// mainnet NFTs we're NOT continuously tracking which addresses hold or
// transfer the NFTs as this would increase scope and complexity significantly.
//
// In addition to that, every holder has been sent an OP NFT some time after
// MAINNET_MAX_TIMESTAMP, which is when we invalidate the mainnet NFT.
//
// We're not increasing or decreasing mainnet NFT holders "balance" property
// because instead we assume that they have held the token from the date of
// minting to the moment when we switched over to OP mainnet.
export function augmentWithMainnet(opAccounts) {
  const MAINNET_MAX_TIMESTAMP = 1694676249;

  for (let { to, timestamp } of mainnet) {
    timestamp = parseInt(timestamp, 16);
    const tokenId = `mainnet-tokenId-${timestamp}`;

    if (!opAccounts[to]) {
      opAccounts[to] = {};
    }
    if (!opAccounts[to].tokens) {
      opAccounts[to].tokens = {};
    }

    opAccounts[to].tokens[tokenId] = [
      {
        start: timestamp,
        end: MAINNET_MAX_TIMESTAMP,
      },
    ];
  }

  return opAccounts;
}

export async function recents() {
  const everyone = await accounts();
  const recentJoiners = [];
  for (const [address, { start }] of Object.entries(everyone)) {
    const today = new Date();
    const parsedStart = new Date(start * 1000);
    const diff = differenceInDays(today, parsedStart);
    if (diff < 7) {
      recentJoiners.push(address);
    }
  }
  return recentJoiners;
}

let cachedAccounts = {};
await refreshAccounts();
export async function accounts() {
  return cachedAccounts;
}
export async function refreshAccounts() {
  const path = resolve(process.env.DATA_DIR, "op-call-block-logs-load");
  // NOTE: On some cloud instances we ran into problems where LMDB reported
  // MDB_READERS_FULL which exceeded the LMDB default value of 126. So we
  // increased it and it fixed the issue. So we're passing this option in the
  // @attestate/crawler.
  const maxReaders = 500;
  const db = database.open(path, maxReaders);
  const name = database.order("op-call-block-logs");
  const subdb = db.openDB(name);
  const optimism = await database.all(subdb, "");
  const transformed = optimism.map(({ value }) => ({
    ...value,
    timestamp: parseInt(value.timestamp, 16),
  }));
  const accounts = aggregate(transformed);
  const result = augmentWithMainnet(accounts);

  cachedAccounts = result;
}

export async function allowlist() {
  const accs = await accounts();
  const currentHolders = new Set();
  for (let address of Object.keys(accs)) {
    if (accs[address].balance > 0) {
      currentHolders.add(address);
    }
  }
  return currentHolders;
}

export async function aggregateRevenue() {
  const revenueMap = new Map();

  for (const tx of await mints()) {
    const { revenueShare } = tx;
    if (revenueShare) {
      const { beneficiaries, amounts } = revenueShare;
      beneficiaries.forEach((addr, index) => {
        const amount = BigInt(amounts[index]);
        if (revenueMap.has(addr)) {
          revenueMap.set(addr, revenueMap.get(addr) + amount);
        } else {
          revenueMap.set(addr, amount);
        }
      });
    }
  }

  return Object.fromEntries(revenueMap);
}

// NOTE: This function won't have accurate data for mainnet mints' existence.
export async function mints() {
  const path = resolve(process.env.DATA_DIR, "op-call-block-logs-load");
  // NOTE: On some cloud instances we ran into problems where LMDB reported
  // MDB_READERS_FULL which exceeded the LMDB default value of 126. So we
  // increased it and it fixed the issue. So we're passing this option in the
  // @attestate/crawler.
  const maxReaders = 500;
  const db = database.open(path, maxReaders);
  const name = database.direct("op-call-block-logs");
  const subdb = db.openDB(name);
  const optimism = await database.all(subdb, "");
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  // NOTE: We originally didn't filter for value being zero but then this meant
  // that admin-directed airdrops would also count towards increasing the price
  // which increased the price unnecessarily high.
  const mints = optimism
    .map(({ value }) => value)
    .filter(({ from, value }) => from === zeroAddress && value !== "0x0");

  const counts = {};
  const getKey = (tx) => `${tx.from}-${tx.to}-${tx.timestamp}`;
  const withoutDuplicates = mints
    .map((tx) => {
      const key = getKey(tx);

      if (!counts[key]) counts[key] = 0;
      counts[key] += 1;

      return tx;
    })
    .map((tx) => {
      const key = getKey(tx);
      const count = counts[key];
      const value = `0x${(tx.value / count).toString(16)}`;
      return {
        ...tx,
        value,
      };
    });
  return withoutDuplicates;
}
