// @format
// Kiwi profiles: a nickname, avatar and bio people set on Kiwi itself.
//
// An update is the whole profile signed as the EIP-712 type `Profile`, by the
// account or by its delegated device key, and resolves to the account through
// the delegations like bookmarks.mjs. ens.mjs overlays the stored profile
// when it resolves names, so a Kiwi nickname wins over ENS and Farcaster.
import { join } from "path";
import Database from "better-sqlite3";
import { utils } from "ethers";
import { resolveIdentity } from "@attestate/delegator2";

import { EIP712_DOMAIN } from "./constants.mjs";
import * as registry from "./chainstate/registry.mjs";

export const PROFILE_TYPES = {
  Profile: [
    { name: "name", type: "string" },
    { name: "bio", type: "string" },
    { name: "avatar", type: "string" },
    { name: "timestamp", type: "uint256" },
  ],
};

export const MAX_AGE = 5 * 60;
export const BIO_LIMIT = 160;
export const RESERVED = [
  "kiwi",
  "kiwinews",
  "admin",
  "support",
  "moderator",
  "mod",
  "official",
  "team",
];
const NAME = /^[a-z0-9_]{2,20}$/i;
// NOTE: Only pictures uploaded through /api/v1/image-upload-token, which end
// up in Kiwi's Cloudflare Images account under this account hash.
const AVATAR =
  /^https:\/\/imagedelivery\.net\/C5bPuWCkK_P2Rg7LwXEwPQ\/[A-Za-z0-9-]+\/[A-Za-z0-9]+$/;
const CONTROL = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/;

let db;
function open() {
  if (db) return db;
  db = new Database(join(process.env.CACHE_DIR || "./cache", "profiles.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      identity TEXT PRIMARY KEY,
      name TEXT,
      name_key TEXT UNIQUE,
      bio TEXT,
      avatar TEXT,
      timestamp INTEGER,
      signature TEXT
    );
  `);
  return db;
}

let statements;
function prepared() {
  if (statements) return statements;
  const db = open();
  statements = {
    get: db.prepare(
      `SELECT name, bio, avatar FROM profiles WHERE identity = ?`,
    ),
    byName: db.prepare(`SELECT identity FROM profiles WHERE name_key = ?`),
    upsert: db.prepare(`
      INSERT INTO profiles (identity, name, name_key, bio, avatar, timestamp, signature)
      VALUES (@identity, @name, @key, @bio, @avatar, @timestamp, @signature)
      ON CONFLICT(identity) DO UPDATE SET
        name = excluded.name,
        name_key = excluded.name_key,
        bio = excluded.bio,
        avatar = excluded.avatar,
        timestamp = excluded.timestamp,
        signature = excluded.signature
      WHERE excluded.timestamp > profiles.timestamp
    `),
  };
  return statements;
}

function fail(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function validName(name) {
  if (name === "") return;
  if (!NAME.test(name)) {
    throw fail(
      "A name has 2 to 20 letters, digits or underscores (no dots or spaces)",
    );
  }
  if (RESERVED.includes(name.toLowerCase())) {
    throw fail("That name is reserved");
  }
}

export function validBio(bio) {
  if (CONTROL.test(bio)) throw fail("The bio can't contain control characters");
  if ([...bio.trim()].length > BIO_LIMIT) {
    throw fail(`The bio can have up to ${BIO_LIMIT} characters`);
  }
}

export function validAvatar(avatar) {
  if (avatar === "" || AVATAR.test(avatar)) return;
  throw fail("The avatar must be a picture uploaded to Kiwi");
}

// Returns the identity (lowercase address) whose profile `message` sets.
export async function verify(message, now = Math.floor(Date.now() / 1000)) {
  if (
    !message ||
    typeof message.name !== "string" ||
    typeof message.bio !== "string" ||
    typeof message.avatar !== "string" ||
    typeof message.signature !== "string" ||
    !Number.isInteger(message.timestamp)
  ) {
    throw fail("Invalid profile");
  }
  validName(message.name);
  validBio(message.bio);
  validAvatar(message.avatar);
  if (Math.abs(now - message.timestamp) > MAX_AGE) {
    throw fail("Profile expired, sign it again");
  }

  const { name, bio, avatar, timestamp } = message;
  const value = { name, bio, avatar, timestamp };
  let signer;
  try {
    signer = utils.verifyTypedData(
      EIP712_DOMAIN,
      PROFILE_TYPES,
      value,
      message.signature,
    );
  } catch {
    signer = null;
  }
  if (!signer) throw fail("Invalid signature", 401);
  const identity = resolveIdentity(await registry.delegations(), signer);
  if (!identity) throw fail("Signer isn't linked to an account", 401);
  return identity.toLowerCase();
}

// Replaces the whole profile. Expects a message that passed verify.
export function save(identity, message) {
  const { name, signature, timestamp } = message;
  const row = {
    identity: identity.toLowerCase(),
    name: name || null,
    key: name ? name.toLowerCase() : null,
    bio: message.bio.trim(),
    avatar: message.avatar,
    timestamp,
    signature,
  };
  let result;
  try {
    result = prepared().upsert.run(row);
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw fail("That name is taken", 409);
    }
    throw err;
  }
  if (result.changes === 0) {
    throw fail("A newer profile was already saved, sign it again", 409);
  }
  return { name: row.name || "", bio: row.bio, avatar: row.avatar };
}

export async function update(message, now) {
  const identity = await verify(message, now);
  return { identity, profile: save(identity, message) };
}

export function get(identity) {
  const row = prepared().get.get(identity.toLowerCase());
  if (!row) return;
  return { name: row.name || "", bio: row.bio || "", avatar: row.avatar || "" };
}

export function byName(name) {
  return prepared().byName.get(name.toLowerCase())?.identity;
}
