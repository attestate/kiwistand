#!/usr/bin/env node
// @format
import cacache from "cacache";
import { env } from "process";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import path from "path";

const CACHE_DIR = path.resolve(env.CACHE_DIR || "./cache");
const LOCK_FILE = path.join(CACHE_DIR, ".cleanup.lock");
const MAX_AGE_DAYS = parseInt(env.CACHE_MAX_AGE_DAYS || "7", 10);

function acquireLock() {
  try {
    const lockContent = readFileSync(LOCK_FILE, "utf8");
    const lockData = JSON.parse(lockContent);

    // Check if the process is still running
    try {
      process.kill(lockData.pid, 0);
      console.log(`[cache-cleanup] Already running (PID ${lockData.pid}), exiting`);
      return false;
    } catch (err) {
      // Process doesn't exist, lock is stale
      console.log(`[cache-cleanup] Removing stale lock from PID ${lockData.pid}`);
    }
  } catch (err) {
    // Lock file doesn't exist
  }

  writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, timestamp: Date.now() }));
  return true;
}

function releaseLock() {
  try {
    unlinkSync(LOCK_FILE);
  } catch (err) {
    // Ignore
  }
}

// Main
if (!acquireLock()) {
  process.exit(0);
}

try {
  console.log(`[cache-cleanup] Starting cleanup of ${CACHE_DIR}`);
  console.log(`[cache-cleanup] Deleting entries older than ${MAX_AGE_DAYS} days`);

  const maxAgeMs = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

  const stats = await cacache.verify(CACHE_DIR, {
    filter: (entry) => {
      const ageMs = Date.now() - entry.time;
      return ageMs < maxAgeMs;
    },
  });

  const reclaimedGB = (stats.reclaimedSize / (1024 * 1024 * 1024)).toFixed(2);
  console.log(`[cache-cleanup] Done! Reclaimed ${stats.reclaimedCount} entries (${reclaimedGB} GB)`);

  releaseLock();
  process.exit(0);
} catch (err) {
  console.error(`[cache-cleanup] Error: ${err.message}`);
  releaseLock();
  process.exit(1);
}
