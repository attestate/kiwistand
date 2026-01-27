//@format
import { env } from "process";
import { readFile, writeFile, rename } from "fs/promises";
import path from "path";
import { utils } from "ethers";
import { resolveIdentity } from "@attestate/delegator2";

import * as registry from "./chainstate/registry.mjs";
import * as ens from "./ens.mjs";
import log from "./logger.mjs";

const MAX_HISTORY = 1000;
const MESSAGE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const FLUSH_INTERVAL_MS = 5000; // write to disk every 5s if dirty
const MESSAGES_FILE = path.join(env.DATA_DIR || "data", "trollbox-messages.json");
const MAX_MESSAGE_LENGTH = 280;
const AUTH_TIMESTAMP_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

// EIP-712 domain for trollbox auth
const TROLLBOX_DOMAIN = {
  name: "kiwinews-trollbox",
  version: "1.0.0",
};

const TROLLBOX_TYPES = {
  Auth: [
    { name: "purpose", type: "string" },
    { name: "timestamp", type: "uint256" },
  ],
};

// In-memory cache of recent messages (persisted to disk)
let cachedMessages = [];
let dirty = false;
let onlineUsers = new Map(); // address -> { displayName, lastSeen }
const ONLINE_TIMEOUT_MS = 30000; // 30 seconds

// Display name cache
const displayNameCache = new Map(); // address -> displayName

async function resolveDisplayName(address) {
  if (displayNameCache.has(address)) {
    return displayNameCache.get(address);
  }
  let displayName = address.slice(0, 6) + "..." + address.slice(-4);
  try {
    const ensData = await ens.resolve(address, true);
    if (ensData.displayName) {
      displayName = ensData.displayName;
    }
  } catch {
    // Use truncated address
  }
  displayNameCache.set(address, displayName);
  return displayName;
}

function cleanOnlineUsers() {
  const now = Date.now();
  for (const [addr, info] of onlineUsers) {
    if (now - info.lastSeen > ONLINE_TIMEOUT_MS) {
      onlineUsers.delete(addr);
    }
  }
}

function markDirty() {
  dirty = true;
}

function pruneOldMessages() {
  const cutoff = Date.now() - MESSAGE_MAX_AGE_MS;
  cachedMessages = cachedMessages.filter((m) => m.timestamp > cutoff);
}

async function loadMessages() {
  try {
    const data = await readFile(MESSAGES_FILE, "utf-8");
    cachedMessages = JSON.parse(data);
    pruneOldMessages();
    if (cachedMessages.length > MAX_HISTORY) {
      cachedMessages = cachedMessages.slice(-MAX_HISTORY);
    }
    log(`Loaded ${cachedMessages.length} trollbox messages from disk`);
  } catch (err) {
    if (err.code === "ENOENT") {
      log("No trollbox messages file found, starting fresh");
    } else {
      log(`Error loading trollbox messages: ${err.message}`);
    }
  }
}

async function flushMessages() {
  if (!dirty) return;
  dirty = false;
  pruneOldMessages();
  const tmp = MESSAGES_FILE + ".tmp";
  try {
    await writeFile(tmp, JSON.stringify(cachedMessages), "utf-8");
    await rename(tmp, MESSAGES_FILE);
  } catch (err) {
    log(`Error flushing trollbox messages: ${err.message}`);
  }
}

async function verifyAuth(signature, timestamp) {
  const now = Date.now();
  const ts = Number(timestamp);
  if (Math.abs(now - ts) > AUTH_TIMESTAMP_MAX_AGE_MS) {
    throw new Error("Timestamp expired");
  }

  const value = { purpose: "trollbox-auth", timestamp: String(ts) };
  const recoveredAddress = utils.verifyTypedData(
    TROLLBOX_DOMAIN,
    TROLLBOX_TYPES,
    value,
    signature,
  );

  if (!recoveredAddress) {
    throw new Error("Invalid signature");
  }

  const delegations = await registry.delegations();
  const identity =
    resolveIdentity(delegations, recoveredAddress) || recoveredAddress;
  const displayName = await resolveDisplayName(identity);

  return { address: identity, displayName };
}

function createMessage(address, displayName, text) {
  const message = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    address,
    displayName,
    text,
    timestamp: Date.now(),
  };
  cachedMessages.push(message);
  if (cachedMessages.length > MAX_HISTORY * 2) {
    cachedMessages = cachedMessages.slice(-MAX_HISTORY);
  }
  markDirty();
  return message;
}

export async function setupRoutes(app) {
  // Load persisted messages from disk
  await loadMessages();

  // Periodically flush dirty messages to disk
  setInterval(flushMessages, FLUSH_INTERVAL_MS);

  // GET messages since timestamp
  app.get("/api/v1/trollbox/messages", (req, res) => {
    const since = Number(req.query.since) || 0;
    const messages = since
      ? cachedMessages.filter((m) => m.timestamp > since)
      : cachedMessages.slice(-MAX_HISTORY);

    cleanOnlineUsers();
    res.json({
      messages,
      online: onlineUsers.size,
    });
  });

  // POST send a message (requires EIP-712 signature)
  app.post("/api/v1/trollbox/messages", async (req, res) => {
    try {
      const { signature, timestamp, text } = req.body;

      if (!signature || !timestamp || !text) {
        return res.status(400).json({ error: "Missing fields" });
      }

      const trimmed = text.trim();
      if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({ error: "Invalid message length" });
      }

      const { address, displayName } = await verifyAuth(signature, timestamp);

      // Mark user online
      onlineUsers.set(address, { displayName, lastSeen: Date.now() });

      const message = createMessage(address, displayName, trimmed);
      res.json({ ok: true, message });
    } catch (err) {
      log(`Trollbox POST error: ${err.message}`);
      res.status(401).json({ error: err.message });
    }
  });

  // POST heartbeat (keeps user in online list)
  app.post("/api/v1/trollbox/heartbeat", async (req, res) => {
    try {
      const { signature, timestamp } = req.body;
      if (!signature || !timestamp) {
        return res.status(400).json({ error: "Missing fields" });
      }

      const { address, displayName } = await verifyAuth(signature, timestamp);
      onlineUsers.set(address, { displayName, lastSeen: Date.now() });

      cleanOnlineUsers();
      res.json({ ok: true, online: onlineUsers.size });
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  });

  log("Trollbox HTTP routes registered");
}
