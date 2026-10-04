// @format
//
// Kiwi profile names: a free, node-run, off-protocol name registry.
//
// Namestone (which served *.kiwinews.eth subnames) shut down, so people
// without an ENS name (including wallet-less users whose identity is their
// own key) had no way to pick a name. Here, an identity signs an EIP712
// message (same domain and types as every other Kiwi message) and the node
// stores the signed record in DATA_DIR/profiles.db. The signed records are
// exposed via GET /api/v1/profiles so other nodes can verify and import them.
import { env } from "process";
import path from "path";

import Database from "better-sqlite3";
import { utils } from "ethers";
import { resolveIdentity } from "@attestate/delegator2";

import { EIP712_MESSAGE } from "./constants.mjs";
import { ecrecover } from "./id.mjs";
import log from "./logger.mjs";

export const SIGNATURE_TTL_SECONDS = 5 * 60;
export const AUTH_TYPE = "PROFILE";
// NOTE: The request body and the signed message are identical in shape to the
// removed POST /api/v1/ens-name endpoint, including its title.
export const AUTH_TITLE = "kiwi ens name registration";
export const COOLDOWN_SECONDS = 30 * 24 * 60 * 60;
export const HOLD_SECONDS = 30 * 24 * 60 * 60;
export const ENS_LOOKUP_TIMEOUT_MS = 5000;
export const MAX_AVATAR_LENGTH = 512;

export const RESERVED = new Set([
  "kiwi",
  "kiwinews",
  "kiwistand",
  "admin",
  "mod",
  "moderator",
  "support",
  "team",
  "official",
  "root",
  "api",
  "www",
  "help",
  "news",
  "null",
  "undefined",
  "timdaub",
  "macbudkowski",
]);

const NAME_PATTERN = /^[a-z0-9-]{3,20}$/;

let db;

function init(database) {
  database.pragma("journal_mode = WAL");
  database.pragma("busy_timeout = 5000");
  database.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      address TEXT PRIMARY KEY,
      name TEXT UNIQUE COLLATE NOCASE,
      avatar TEXT,
      message TEXT,
      signature TEXT,
      signed_at INTEGER,
      updated_at INTEGER
    )
  `);
  database.exec(`
    CREATE TABLE IF NOT EXISTS name_history (
      name TEXT NOT NULL COLLATE NOCASE,
      address TEXT NOT NULL,
      from_ts INTEGER NOT NULL,
      to_ts INTEGER
    )
  `);
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_name_history_name ON name_history (name)
  `);
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_name_history_address
    ON name_history (address)
  `);
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_profiles_updated_at
    ON profiles (updated_at)
  `);
  return database;
}

function getDB() {
  if (!db) {
    db = init(new Database(path.join(env.DATA_DIR, "profiles.db")));
  }
  return db;
}

// NOTE: For tests: swap in another database (e.g. ":memory:").
export function _setDB(file) {
  db = init(new Database(file));
  return db;
}

export class ProfileError extends Error {
  constructor(code, message, details) {
    super(details);
    this.code = code;
    this.httpMessage = message;
    this.details = details;
  }
}

const badRequest = (details) => new ProfileError(400, "Bad Request", details);
const unauthorized = (details) =>
  new ProfileError(401, "Unauthorized", details);

// Returns a human-readable reason when the name isn't allowed, else null.
export function validateName(name) {
  if (typeof name !== "string") return "Name must be a string";
  if (!NAME_PATTERN.test(name)) {
    return "Name must be 3 to 20 characters and only contain lowercase letters, numbers, and hyphens";
  }
  if (name.startsWith("-") || name.endsWith("-")) {
    return "Name can't start or end with a hyphen";
  }
  if (RESERVED.has(name)) return "This name is reserved";
  return null;
}

export function validateAvatar(avatar) {
  if (avatar === "") return null;
  if (typeof avatar !== "string") return "Avatar must be a string";
  if (avatar.length > MAX_AVATAR_LENGTH) return "Avatar URL is too long";
  let url;
  try {
    url = new URL(avatar);
  } catch (err) {
    return "Avatar must be a valid URL";
  }
  if (url.protocol !== "https:") return "Avatar must be an https URL";
  return null;
}

export function buildHref({ address, name, avatar }) {
  return `kiwi://profile?address=${encodeURIComponent(
    String(address).toLowerCase(),
  )}&name=${encodeURIComponent(name)}&avatar=${encodeURIComponent(
    avatar || "",
  )}`;
}

export function buildMessage({ address, name, avatar, timestamp }) {
  return {
    title: AUTH_TITLE,
    href: buildHref({ address, name, avatar }),
    type: AUTH_TYPE,
    timestamp,
  };
}

export function get(address) {
  if (!address) return null;
  try {
    const row = getDB()
      .prepare("SELECT address, name, avatar FROM profiles WHERE address = ?")
      .get(String(address).toLowerCase());
    return row || null;
  } catch (err) {
    log(`profiles.get failed: ${err.toString()}`);
    return null;
  }
}

export function byName(name) {
  if (typeof name !== "string" || !name) return null;
  const row = getDB()
    .prepare("SELECT address, name, avatar FROM profiles WHERE name = ?")
    .get(name.toLowerCase());
  return row || null;
}

export function list(since = 0) {
  return getDB()
    .prepare(
      `SELECT address, name, avatar, message, signature, signed_at
       FROM profiles WHERE updated_at >= ? ORDER BY updated_at ASC`,
    )
    .all(since)
    .map((row) => ({ ...row, message: JSON.parse(row.message) }));
}

async function defaultEnsLookup(ensName) {
  // NOTE: Imported lazily to avoid a circular import (ens.mjs reads profiles).
  const { toAddress } = await import("./ens.mjs");
  return await toAddress(ensName);
}

// Resolves <name>.eth. Returns the address or null if it doesn't resolve,
// fails or times out (in which case we allow the claim).
async function lookupEns(name, ensLookup) {
  let timer;
  try {
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve(null), ENS_LOOKUP_TIMEOUT_MS);
    });
    return await Promise.race([ensLookup(`${name}.eth`), timeout]);
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Throws a ProfileError if `address` may not take `name` at `now`.
function checkClaim(database, address, name, now) {
  const current = database
    .prepare("SELECT name FROM profiles WHERE address = ?")
    .get(address);
  const currentName = current?.name || null;
  if (currentName === name) return { currentName, unchanged: true };

  const owner = database
    .prepare("SELECT address FROM profiles WHERE name = ?")
    .get(name);
  if (owner && owner.address !== address) {
    throw badRequest("This name is already taken");
  }

  const held = database
    .prepare(
      `SELECT 1 FROM name_history
       WHERE name = ? AND address != ? AND to_ts IS NOT NULL AND to_ts > ?
       LIMIT 1`,
    )
    .get(name, address, now - HOLD_SECONDS);
  if (held) {
    throw badRequest(
      "This name was recently released and is on hold for 30 days",
    );
  }

  // NOTE: Taking back the name you held last (e.g. after removing it) is
  // always allowed, otherwise one name change per 30 days.
  const last = database
    .prepare(
      `SELECT name, from_ts FROM name_history
       WHERE address = ? ORDER BY from_ts DESC, rowid DESC LIMIT 1`,
    )
    .get(address);
  const isReclaim = last && last.name.toLowerCase() === name;
  if (last && !isReclaim && last.from_ts > now - COOLDOWN_SECONDS) {
    const days = Math.ceil(
      (last.from_ts + COOLDOWN_SECONDS - now) / (24 * 60 * 60),
    );
    throw badRequest(
      `You can change your name once every 30 days. Try again in ${days} day${
        days === 1 ? "" : "s"
      }`,
    );
  }
  return { currentName, unchanged: false };
}

// Verifies and stores a signed profile request (the POST /api/v1/profile
// body). Returns { address, name, avatar } or throws a ProfileError.
export async function save(body, options = {}) {
  const {
    delegations = {},
    now = Math.floor(Date.now() / 1000),
    ensLookup = defaultEnsLookup,
  } = options;
  const { address, avatar = "", signature, signedAt } = body || {};
  let { name } = body || {};
  if (name === undefined || name === null) name = "";

  if (!address) throw badRequest("Missing required field: address");
  if (!signature) throw unauthorized("Missing required field: signature");
  if (!signedAt) throw badRequest("Missing required field: signedAt");
  if (typeof name !== "string") throw badRequest("Name must be a string");

  let normalizedAddress;
  try {
    normalizedAddress = utils.getAddress(address).toLowerCase();
  } catch (err) {
    throw badRequest("Invalid Ethereum address");
  }

  const normalizedName = name.toLowerCase();
  const isRemoval = normalizedName === "";
  if (!isRemoval) {
    const reason = validateName(normalizedName);
    if (reason) throw badRequest(reason);
  }
  const normalizedAvatar = avatar || "";
  const avatarReason = validateAvatar(normalizedAvatar);
  if (avatarReason) throw badRequest(avatarReason);

  const signedAtSeconds = Number(signedAt);
  if (!Number.isInteger(signedAtSeconds) || signedAtSeconds <= 0) {
    throw badRequest("Invalid signedAt value");
  }
  if (
    signedAtSeconds < now - SIGNATURE_TTL_SECONDS ||
    signedAtSeconds > now + SIGNATURE_TTL_SECONDS
  ) {
    throw unauthorized("Expired or invalid signature timestamp");
  }

  const message = buildMessage({
    address: normalizedAddress,
    name: normalizedName,
    avatar: normalizedAvatar,
    timestamp: signedAtSeconds,
  });

  let identity;
  try {
    const signer = ecrecover({ ...message, signature }, EIP712_MESSAGE);
    identity = resolveIdentity(delegations, signer);
  } catch (err) {
    throw unauthorized("Invalid signature");
  }
  if (!identity || identity.toLowerCase() !== normalizedAddress) {
    throw unauthorized("Signature/address mismatch");
  }

  const database = getDB();
  if (!isRemoval) {
    // NOTE: Cheap local checks first, so that we don't hit the network for a
    // request that will be rejected anyway. They're re-run in the
    // transaction below because the ENS lookup is async.
    const { unchanged } = checkClaim(
      database,
      normalizedAddress,
      normalizedName,
      now,
    );
    if (!unchanged) {
      const ensOwner = await lookupEns(normalizedName, ensLookup);
      if (ensOwner && ensOwner.toLowerCase() !== normalizedAddress) {
        throw badRequest(
          `${normalizedName}.eth belongs to someone else on ENS`,
        );
      }
    }
  }

  const write = database.transaction(() => {
    const current = database
      .prepare("SELECT name FROM profiles WHERE address = ?")
      .get(normalizedAddress);
    const currentName = current?.name || null;
    const newName = isRemoval ? null : normalizedName;
    if (!isRemoval) checkClaim(database, normalizedAddress, newName, now);

    if (currentName !== newName) {
      if (currentName) {
        database
          .prepare(
            `UPDATE name_history SET to_ts = ?
             WHERE address = ? AND to_ts IS NULL`,
          )
          .run(now, normalizedAddress);
      }
      const last = database
        .prepare(
          `SELECT rowid, name FROM name_history
           WHERE address = ? ORDER BY from_ts DESC, rowid DESC LIMIT 1`,
        )
        .get(normalizedAddress);
      if (newName && last && last.name.toLowerCase() === newName) {
        // NOTE: Taking back the last name reopens its entry, so that it
        // doesn't restart the 30 day cooldown.
        database
          .prepare("UPDATE name_history SET to_ts = NULL WHERE rowid = ?")
          .run(last.rowid);
      } else if (newName) {
        database
          .prepare(
            `INSERT INTO name_history (name, address, from_ts, to_ts)
             VALUES (?, ?, ?, NULL)`,
          )
          .run(newName, normalizedAddress, now);
      }
    }

    database
      .prepare(
        `INSERT INTO profiles
           (address, name, avatar, message, signature, signed_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(address) DO UPDATE SET
           name = excluded.name,
           avatar = excluded.avatar,
           message = excluded.message,
           signature = excluded.signature,
           signed_at = excluded.signed_at,
           updated_at = excluded.updated_at`,
      )
      .run(
        normalizedAddress,
        newName,
        normalizedAvatar || null,
        JSON.stringify(message),
        signature,
        signedAtSeconds,
        now,
      );
  });
  // NOTE: immediate takes the write lock up front, so that two workers can't
  // both pass checkClaim for the same name.
  write.immediate();

  return {
    address: normalizedAddress,
    name: isRemoval ? null : normalizedName,
    avatar: normalizedAvatar || null,
  };
}
