// @format
import { resolve } from "path";
import { createHash } from "crypto";

import { utils } from "ethers";
import { database } from "@attestate/crawler";
import { organize } from "@attestate/delegator2";
import * as blockLogs from "@attestate/crawler-call-block-logs";

const { aggregate } = blockLogs.loader;

import mainnet from "./mainnet-mints.mjs";

function hash(obj) {
  const str = JSON.stringify(obj);
  return createHash("sha256").update(str).digest("hex");
}

let cachedDelegations = null;
let logsHash = null;
export async function delegations() {
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

  if (logsHash !== hash(logs) || !cachedDelegations) {
    cachedDelegations = organize(logs);
    logsHash = hash(logs);
  }

  return cachedDelegations;
}

// NOTE: For the purpose of set reconciliation, we must know the first moment
// of ownership, so in which block the user minted the NFT. However, for
// mainnet NFTs we're NOT continuously tracking which addresses hold or
// transfer the NFTs as this would increase scope and complexity significantly.
export function augmentWithMainnet(opAccounts) {
  for (let { to, timestamp } of mainnet) {
    timestamp = parseInt(timestamp, 16);

    if (
      opAccounts[to] &&
      opAccounts[to].balance !== undefined &&
      opAccounts[to].start > timestamp
    ) {
      opAccounts[to].start = timestamp;
      // NOTE: We're intentionally NOT increasing the balance here, as for
      // mainnet mints, we've airdropped every one of these users a Kiwi Pass
      // on Optimism too.
      //opAccounts[to].balance += 1;
    }

    if (!opAccounts[to]) {
      opAccounts[to] = {
        balance: 1,
        start: timestamp,
      };
    }
  }

  return opAccounts;
}

export async function accounts() {
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
  return augmentWithMainnet(accounts);
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
  return optimism
    .map(({ value }) => value)
    .filter(({ from }) => from === zeroAddress);
}
