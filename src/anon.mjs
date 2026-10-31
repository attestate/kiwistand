// @format
//
// Anonymous upvotes with Semaphore v4.
//
// 1. An identity with enough karma signs an "anon-join" message that registers
//    a Semaphore identity commitment. Joining is public.
// 2. Every node builds the same group (a Lean incremental Merkle tree) from
//    the accepted joins, ordered by (timestamp, index). An identity has one
//    leaf: its first join. Later joins are ignored.
// 3. A member upvotes a story with an "anon-upvote" message: no signature, no
//    address, just a Semaphore proof that some member of the group upvoted
//    this story. Its scope is the hash of the story id, so the proof's
//    nullifier lets nodes reject a second upvote of the same story by the same
//    member without learning who it is.
//
// All rules are a function of messages that are older than the message being
// checked, so nodes that have synced the same messages agree. See the notes
// on ANON_ROOT_SETTLE_SECS in constants.mjs for why recent joins are ignored.
import { promises as fs } from "fs";
import path from "path";

import { keccak256 } from "ethereum-cryptography/keccak.js";
import { utf8ToBytes, toHex } from "ethereum-cryptography/utils.js";
import { Group } from "@semaphore-protocol/group";
import { verifyProof } from "@semaphore-protocol/proof";

import log from "./logger.mjs";
import {
  ANON_TYPES,
  ANON_MIN_KARMA,
  ANON_ROOT_HISTORY,
  ANON_ROOT_SETTLE_SECS,
} from "./constants.mjs";
import {
  getAnonJoins,
  countAnonJoins,
  calculateKarmaFromDB,
  hasNullifier,
  getAnonMember,
  isSubmission,
} from "./cache.mjs";

export function isAnonType(type) {
  return ANON_TYPES.includes(type);
}

// An anonymous upvote must name the story by its submission's index (not by
// one of its upvotes), so that each story has exactly one scope.
export function checkStory(href) {
  if (!isSubmission(href)) {
    throw new Error(`anon-upvote: "${href}" isn't a story's submission`);
  }
}

// The order of the BN254 scalar field; commitments are elements of it.
export const SNARK_FIELD = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617",
);

function keccakBigInt(text) {
  return BigInt(`0x${toHex(keccak256(utf8ToBytes(text)))}`);
}

// The Semaphore scope ("external nullifier") of an upvote: the hash of the
// story id (kiwi:0x<index>). One vote per member per story.
export function scopeOf(href) {
  return keccakBigInt(href).toString();
}

// The Semaphore message of an upvote. It binds the story and the timestamp,
// so nobody can re-send someone's proof under another timestamp.
export function messageOf(href, timestamp) {
  return keccakBigInt(`${href}|${timestamp}`).toString();
}

// Replays the joins (sorted by timestamp, id) into a group, one per identity. Returns the group
// after the last join and one state per join that changed the root.
export function replay(joins) {
  const group = new Group();
  const positions = new Map();
  const states = [];
  for (const join of joins) {
    const commitment = BigInt(join.commitment);
    // NOTE: The first join of an identity wins. Letting an identity swap its
    // commitment would hand it a fresh nullifier, and with it another vote on
    // the same story, every time.
    if (positions.has(join.identity)) continue;
    group.addMember(commitment);
    positions.set(join.identity, group.size - 1);
    states.push({
      id: join.id,
      timestamp: join.timestamp,
      root: group.root.toString(),
      size: group.size,
    });
  }
  return { group, states };
}

let memo = { count: -1, joins: [], states: [] };
function current() {
  const count = countAnonJoins();
  if (memo.count !== count) {
    const joins = getAnonJoins();
    const { states } = replay(joins);
    memo = { count, joins, states };
  }
  return memo;
}

// Exposed for tests.
export function resetMemo() {
  memo = { count: -1, joins: [], states: [] };
}

// The roots an upvote with this timestamp may be proven against: the last
// ANON_ROOT_HISTORY group states among joins at least ANON_ROOT_SETTLE_SECS
// older than the upvote.
export function validRoots(timestamp, states = current().states) {
  const cutoff = timestamp - ANON_ROOT_SETTLE_SECS;
  const settled = states.filter((state) => state.timestamp <= cutoff);
  return settled.slice(-ANON_ROOT_HISTORY).map((state) => state.root);
}

// The group clients should prove against now: all joins that have settled.
export function settledGroup(now = Math.floor(Date.now() / 1000)) {
  const { joins } = current();
  const cutoff = now - ANON_ROOT_SETTLE_SECS;
  const settled = joins.filter((join) => join.timestamp <= cutoff);
  const { group } = replay(settled);
  const pending = joins.length - settled.length;
  return { group, pending };
}

export function karmaAt(identity, timestamp) {
  return calculateKarmaFromDB(identity, new Date(timestamp * 1000));
}

// Eligibility gate against throwaway accounts: the identity needs
// ANON_MIN_KARMA, counted only from messages at or before the join's
// timestamp. Nodes that synced different amounts of history may disagree for
// a while, but karma only grows as older messages arrive, so a node that
// rejected a join accepts it on a later sync round.
export function checkJoin(message, identity) {
  if (!identity) throw new Error("anon-join: missing identity");
  const commitment = BigInt(message.commitment);
  if (commitment === 0n || commitment >= SNARK_FIELD) {
    throw new Error("anon-join: commitment isn't in the SNARK field");
  }
  // NOTE: Only an *earlier* join (by timestamp) of the same identity rules a
  // new one out. replay() keeps the first join by (timestamp, id), so a join
  // that is older than what this node has seen must still be accepted: else
  // nodes that saw the joins in a different order would end up with different
  // groups. Later duplicates are ignored by replay().
  const existing = getAnonMember(identity);
  if (existing && existing.timestamp < message.timestamp) {
    throw new Error(`anon-join: identity "${identity}" has already joined`);
  }
  const karma = karmaAt(identity, message.timestamp);
  if (karma < ANON_MIN_KARMA) {
    throw new Error(
      `anon-join: identity "${identity}" has ${karma} karma, needs ${ANON_MIN_KARMA} to join`,
    );
  }
}

// Checks an anonymous upvote's proof. The caller (store.add) has already
// checked the schema, the timestamp and that the story exists and is older.
export async function checkUpvote(message) {
  const { href, timestamp, depth, merkleRoot, nullifier, proof } = message;

  if (hasNullifier(href, nullifier)) {
    throw new Error(
      `anon-upvote: nullifier was already used for "${href}" (duplicate)`,
    );
  }

  const roots = validRoots(timestamp);
  if (!roots.includes(merkleRoot)) {
    throw new Error(
      `anon-upvote: merkle root "${merkleRoot}" isn't one of the last ${ANON_ROOT_HISTORY} settled group roots`,
    );
  }

  let valid = false;
  try {
    valid = await verifyProof({
      merkleTreeDepth: depth,
      merkleTreeRoot: merkleRoot,
      nullifier,
      message: messageOf(href, timestamp),
      scope: scopeOf(href),
      points: proof,
    });
  } catch (err) {
    log(`anon-upvote: verifyProof threw "${err.toString()}"`);
    valid = false;
  }
  if (!valid) {
    throw new Error("anon-upvote: invalid Semaphore proof");
  }
}

// What the website shows in the anonymous upvote sheet.
export function status(identity, now = Math.floor(Date.now() / 1000)) {
  const karma = identity ? karmaAt(identity, now) : 0;
  const member = identity ? getAnonMember(identity) : null;
  return {
    minKarma: ANON_MIN_KARMA,
    karma,
    eligible: karma >= ANON_MIN_KARMA,
    member: member
      ? {
          commitment: member.commitment,
          timestamp: member.timestamp,
          settled: member.timestamp <= now - ANON_ROOT_SETTLE_SECS,
          settlesAt: member.timestamp + ANON_ROOT_SETTLE_SECS,
        }
      : null,
  };
}

// Semaphore's proving artifacts (circuit wasm and zkey) for each tree depth.
// The verification keys bundled in @semaphore-protocol/proof belong to this
// version. Nodes cache them on disk and serve them to the website, so the
// browser downloads them from Kiwi and not from a third party.
export const ARTIFACTS_VERSION = "4.13.0";
const ARTIFACTS_URL = "https://snark-artifacts.pse.dev/semaphore";
const inflight = new Map();

export function artifactName(depth, kind) {
  return `semaphore-${depth}.${kind}`;
}

export function parseArtifactName(name) {
  const match = /^semaphore-([1-9]|[12][0-9]|3[0-2])\.(wasm|zkey)$/.exec(name);
  if (!match) return null;
  return { depth: parseInt(match[1], 10), kind: match[2] };
}

export async function ensureArtifact(depth, kind, dir) {
  const name = artifactName(depth, kind);
  const target = path.join(dir, ARTIFACTS_VERSION, name);
  try {
    await fs.access(target);
    return target;
  } catch (err) {}

  if (!inflight.has(target)) {
    const download = (async () => {
      await fs.mkdir(path.dirname(target), { recursive: true });
      const url = `${ARTIFACTS_URL}/${ARTIFACTS_VERSION}/${name}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Downloading "${url}" failed: ${response.status}`);
      }
      const data = Buffer.from(await response.arrayBuffer());
      const tmp = `${target}.${process.pid}.tmp`;
      await fs.writeFile(tmp, data);
      await fs.rename(tmp, target);
      return target;
    })().finally(() => inflight.delete(target));
    inflight.set(target, download);
  }
  return await inflight.get(target);
}

export async function ensureArtifacts(depth, dir) {
  const [wasm, zkey] = await Promise.all([
    ensureArtifact(depth, "wasm", dir),
    ensureArtifact(depth, "zkey", dir),
  ]);
  return { wasm, zkey };
}
