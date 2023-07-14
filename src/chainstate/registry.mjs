// @format
import { resolve } from "path";

import { utils } from "ethers";
import { database } from "@attestate/crawler";
import { organize } from "@attestate/delegator2";

export async function delegations() {
  const path = resolve(process.env.DATA_DIR, "list-delegations-load");
  const maxReaders = 500;
  const db = database.open(path, maxReaders);
  const name = database.order("list-delegations");
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
  return organize(logs);
}

export async function allowlist() {
  const path = resolve(process.env.DATA_DIR, "call-block-logs-load");
  // NOTE: On some cloud instances we ran into problems where LMDB reported
  // MDB_READERS_FULL which exceeded the LMDB default value of 126. So we
  // increased it and it fixed the issue. So we're passing this option in the
  // @attestate/crawler.
  const maxReaders = 500;
  const db = database.open(path, maxReaders);
  const name = database.order("call-block-logs");
  const subdb = db.openDB(name);
  const all = await database.all(subdb, "");
  const addresses = all.map(({ value }) => utils.getAddress(value));
  const uniqueAddresses = Array.from(new Set(addresses));
  return uniqueAddresses;
}
