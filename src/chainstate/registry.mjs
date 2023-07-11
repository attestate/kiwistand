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
  const logs = all.map(({ value }) => ({ ...value, data: value.data.data }));
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
