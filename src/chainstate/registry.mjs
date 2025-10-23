// @format
import { resolve } from "path";
import { createHash } from "crypto";
import canonicalize from "canonicalize"; // Added import
import { readFileSync } from "fs";

import { differenceInDays } from "date-fns";
import { utils } from "ethers";
import { database } from "@attestate/crawler";
import { organize } from "@attestate/delegator2";

import log from "../logger.mjs";
import { purgeCache } from "../cloudflarePurge.mjs";

const baseURL = `https://news.kiwistand.com:8443`;
let cachedDelegations = {};
let lastDelegationsChecksum = null; // Added checksum state

// Simple initialization function
export async function initialize() {
  log(`[PID ${process.pid}] Initializing registry data...`);
  console.time(`[PID ${process.pid}] Registry initialization`);

  await refreshDelegations();

  console.timeEnd(`[PID ${process.pid}] Registry initialization`);
  return true;
}

/**
 * Calculates a SHA-256 checksum for the given data using canonicalization.
 * @param {*} data - The data to checksum (typically an array of objects).
 * @returns {string} - The hex representation of the SHA-256 checksum.
 */
function calculateCanonicalChecksum(data) {
  const canonicalString = canonicalize(data);
  if (canonicalString === undefined) {
    log("Canonicalize returned undefined, using empty string for checksum.");
    // SHA-256 hash of an empty string
    return "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  }
  const hash = createHash("sha256");
  hash.update(canonicalString);
  return hash.digest("hex");
}

export async function delegations() {
  return cachedDelegations;
}
export async function refreshDelegations() {
  // DELEGATION SYSTEM ARCHITECTURE (as of Aug 2024):
  // 
  // We use a dual-contract delegation system on Optimism:
  // 1. Delegator2 (0x08b7ecfac2c5754abafb789c84f8fa37c9f088b0): 
  //    - Original contract deployed at block 117149738
  //    - Used until block 140309526
  //    - Emits: Delegate(bytes32[3] data)
  //    - Required complex sender recovery logic
  //
  // 2. Delegator3 (0x418910fef46896eb0bfe38f656e2f7df3eca7198):
  //    - New contract deployed at block 140309527
  //    - Emits: Delegate(bytes32[3] data, address sender)
  //    - Sender is emitted directly in event (supports EIP-7702 & Porto wallets)
  //
  // HISTORICAL CONTEXT:
  // - Initially attempted to re-crawl all Delegator2 logs with complex recovery
  // - Realized maintaining backward compatibility was critical for message validation
  // - Messages are signed with the contract address in EIP-712 domain
  // - Old messages require Delegator2 address to validate signatures
  //
  // CURRENT APPROACH:
  // - Historical delegations (Delegator2 era) are loaded from a static JSON file
  // - This JSON was exported from production and contains ~2561 delegations
  // - New delegations (Delegator3) are crawled dynamically
  // - Both sets are merged, with newer delegations overriding older ones
  //
  // This hybrid approach ensures:
  // - Historical message validation continues to work
  // - No complex sender recovery needed for old delegations
  // - New delegations support EIP-7702 and smart contract wallets
  // - System remains simple and maintainable
  
  // Load historical delegations from static JSON (Delegator2 era)
  const historicalDelegationsPath = resolve(process.cwd(), "src/chainstate/historical-delegations.json");
  let historicalDelegations = {};
  try {
    const content = readFileSync(historicalDelegationsPath, 'utf8');
    historicalDelegations = JSON.parse(content);
    log(`Loaded ${Object.keys(historicalDelegations).length} historical delegations`);
  } catch (err) {
    log(`Warning: Could not load historical delegations: ${err.message}`);
  }
  
  const path = resolve(process.env.DATA_DIR, "list-delegations-load-2");
  const maxReaders = 500;
  const db = database.open(path, maxReaders);
  const name = database.order("list-delegations-2");
  const subdb = db.openDB(name);
  const all = await database.all(subdb, "");

  const currentChecksum = calculateCanonicalChecksum(all);
  if (currentChecksum === lastDelegationsChecksum) {
    log(`Didn't find any new delegations to process, skipping refresh`);
    await db.close();
    return;
  }

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
  // Delegator3 deployment block - this is when we switched contracts
  const DELEGATOR3_START_BLOCK = 140309527;
  
  // Process only Delegator3 logs from the crawler
  // These are new delegations that happen after the contract upgrade
  const delegator3Logs = [];
  
  for (const { value } of all) {
    if (!value.data) continue;
    
    const blockNumber = parseInt(value.blockNumber, 16);
    
    // Only process Delegator3 logs (from block 140309527 with sender field)
    if (value.data.sender && blockNumber >= DELEGATOR3_START_BLOCK) {
      // Filter out revocations
      if (BigInt(value.data.data[2]) % 2n === 0n) continue;
      
      delegator3Logs.push({
        data: value.data.data,
        sender: value.data.sender
      });
    }
  }
  
  log(`Using ${Object.keys(historicalDelegations).length} historical and ${delegator3Logs.length} new Delegator3 delegations`);
  
  // Process Delegator3 with v0.6.0 validation
  const delegator3Delegations = organize(delegator3Logs);   // Uses v0.6.0 with new contract
  
  // Merge historical with new Delegator3 delegations
  cachedDelegations = {
    ...historicalDelegations,
    ...delegator3Delegations
  };
  
  lastDelegationsChecksum = currentChecksum;
  await db.close();
  await purgeCache(`${baseURL}/api/v1/delegations?cached=true`);
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
  await db.close();
  return withoutDuplicates;
}
