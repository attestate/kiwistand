// @format
import { env } from "process";
import { rm } from "fs/promises";
import { join } from "path";

import test from "ava";
import { Wallet } from "ethers";
import Database from "better-sqlite3";
import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { generateProof } from "@semaphore-protocol/proof";

import * as id from "../src/id.mjs";
import {
  EIP712_MESSAGE,
  EIP712_ANON_JOIN,
  ANON_IDENTITY,
  ANON_MIN_KARMA,
  ANON_ROOT_HISTORY,
  ANON_ROOT_SETTLE_SECS,
} from "../src/constants.mjs";
import * as store from "../src/store.mjs";
import * as anon from "../src/anon.mjs";
import * as ens from "../src/ens.mjs";
import { anonGroup, anonStatus } from "../src/api.mjs";
import {
  getSubmission,
  calculateKarmaFromDB,
  countAnonJoins,
  initializeLtCache,
} from "../src/cache.mjs";
import { secretFromKey } from "../src/web/src/semaphore-secret.mjs";
import { identityFromSecret } from "../src/web/src/anon-core.mjs";

const artifactsDir = join(env.CACHE_DIR, "semaphore-artifacts");

test.before(() => {
  // NOTE: Same tables as cache.initialize; the test cache may not have run it.
  const db = new Database(join(env.CACHE_DIR, "database.db"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY NOT NULL, href TEXT NOT NULL UNIQUE, title TEXT NOT NULL, timestamp INTEGER NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS upvotes (id TEXT PRIMARY KEY NOT NULL, href TEXT NOT NULL, timestamp INTEGER NOT NULL, title TEXT NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY NOT NULL, submission_id TEXT NOT NULL, timestamp INTEGER NOT NULL, title TEXT NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS reactions (id TEXT PRIMARY KEY NOT NULL, comment_id TEXT NOT NULL, timestamp INTEGER NOT NULL, title TEXT NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL);
  `);
  // The group is built from every join in the cache, so start empty.
  countAnonJoins();
  db.exec(`DELETE FROM anon_members; DELETE FROM anon_nullifiers;`);
  db.close();
  initializeLtCache();
  anon.resetMemo();
});

test.after.always(async () => {
  // NOTE: snarkjs keeps worker threads for the curve around.
  await globalThis.curve_bn128?.terminate?.();
});

const join_ = (identity, commitment, timestamp, id_ = `kiwi:0x${timestamp}`) => ({
  id: id_,
  identity,
  commitment: commitment.toString(),
  timestamp,
});

test("the group is built deterministically from the joins", (t) => {
  const [a, b, c] = [1, 2, 3].map(
    (n) => new Identity(new Uint8Array(32).fill(n)).commitment,
  );
  const joins = [
    join_("0xA", a, 100),
    join_("0xB", b, 101),
    join_("0xC", c, 102),
  ];
  const { group, states } = anon.replay(joins);
  const expected = new Group([a, b, c]);
  t.is(group.root, expected.root);
  t.deepEqual(group.members, [a, b, c]);
  t.is(states.length, 3);
  t.is(states[2].root, expected.root.toString());
  // Replaying again gives the same roots.
  t.deepEqual(anon.replay(joins).states, states);

  // A later join of an identity is ignored: swapping commitments would mint a
  // fresh nullifier, and with it another vote on the same story.
  const d = new Identity(new Uint8Array(32).fill(4)).commitment;
  const replaced = anon.replay([...joins, join_("0xA", d, 103)]);
  t.deepEqual(replaced.group.members, [a, b, c]);
  t.is(replaced.states.length, 3);
  t.is(replaced.group.size, 3);
  // Registering the same commitment again changes nothing.
  const same = anon.replay([...joins, join_("0xB", b, 104)]);
  t.is(same.states.length, 3);
});

test("only the last settled roots are valid", (t) => {
  const states = Array.from({ length: ANON_ROOT_HISTORY + 5 }, (_, i) => ({
    timestamp: 1000 + i,
    root: `root${i}`,
  }));
  const last = 1000 + ANON_ROOT_HISTORY + 4;

  const roots = anon.validRoots(last + ANON_ROOT_SETTLE_SECS, states);
  t.is(roots.length, ANON_ROOT_HISTORY);
  t.true(roots.includes(`root${ANON_ROOT_HISTORY + 4}`));
  // Too old: pushed out by ANON_ROOT_HISTORY newer states.
  t.false(roots.includes("root0"));
  t.false(roots.includes("root4"));
  t.true(roots.includes("root5"));

  // Not settled yet: the newest state is younger than ANON_ROOT_SETTLE_SECS.
  const early = anon.validRoots(last + ANON_ROOT_SETTLE_SECS - 1, states);
  t.false(early.includes(`root${ANON_ROOT_HISTORY + 4}`));
  t.deepEqual(anon.validRoots(999 + ANON_ROOT_SETTLE_SECS, states), []);
});

test("artifact names are validated", (t) => {
  t.deepEqual(anon.parseArtifactName("semaphore-2.wasm"), {
    depth: 2,
    kind: "wasm",
  });
  t.deepEqual(anon.parseArtifactName("semaphore-32.zkey"), {
    depth: 32,
    kind: "zkey",
  });
  t.is(anon.parseArtifactName("semaphore-33.zkey"), null);
  t.is(anon.parseArtifactName("../semaphore-1.wasm"), null);
});

test("the anonymous identity resolves to Someone", async (t) => {
  const profile = await ens.resolve(ANON_IDENTITY);
  t.is(profile.displayName, "Someone");
  t.is(profile.safeAvatar, null);
});

test.serial("anonymous upvotes end to end through store.add", async (t) => {
  env.DATA_DIR = "dbtestAnon";
  await rm("dbtestAnon", { recursive: true, force: true });
  const trie = await store.create();
  const delegations = {};
  const now = Math.floor(Date.now() / 1000);
  const base = now - 7200;
  const run = `${now}-${Math.random().toString(16).slice(2)}`;

  const submit = async (signer, title, href, timestamp) => {
    const message = id.create(title, href, "amplify", timestamp);
    const signed = await id.sign(signer, message, EIP712_MESSAGE);
    return await store.add(trie, signed, null, delegations);
  };
  const joinGroup = async (signer, commitment, timestamp) => {
    const message = {
      commitment: commitment.toString(),
      type: "anon-join",
      timestamp,
    };
    const signed = await id.sign(signer, message, EIP712_ANON_JOIN);
    return await store.add(trie, signed, null, delegations);
  };
  const identityOf = (wallet) =>
    identityFromSecret(secretFromKey(wallet.privateKey));
  const prove = async (identity, group, href, timestamp) => {
    const depth = Math.max(1, group.depth);
    const artifacts = await anon.ensureArtifacts(depth, artifactsDir);
    const started = Date.now();
    const proof = await generateProof(
      identity,
      group,
      anon.messageOf(href, timestamp),
      anon.scopeOf(href),
      depth,
      artifacts,
    );
    const ms = Date.now() - started;
    return {
      ms,
      message: {
        timestamp,
        type: "anon-upvote",
        href,
        depth: proof.merkleTreeDepth,
        merkleRoot: proof.merkleTreeRoot,
        nullifier: proof.nullifier,
        proof: proof.points.map(String),
      },
    };
  };

  const author = Wallet.createRandom();
  const members = [Wallet.createRandom(), Wallet.createRandom(), Wallet.createRandom()];
  const newcomer = Wallet.createRandom();

  const storyIndex = await submit(author, "A story", `https://example.com/anon-${run}`, base);
  const storyId = `kiwi:0x${storyIndex}`;
  const otherIndex = await submit(author, "Another story", `https://example.com/anon-other-${run}`, base + 1);

  // Every member submits ANON_MIN_KARMA stories, the newcomer fewer.
  for (const [m, member] of members.entries()) {
    for (let i = 0; i < ANON_MIN_KARMA; i++) {
      await submit(member, `Story ${i}`, `https://example.com/anon-${run}-${m}-${i}`, base + 10 + i);
    }
  }
  for (let i = 0; i < ANON_MIN_KARMA - 1; i++) {
    await submit(newcomer, `Story ${i}`, `https://example.com/anon-${run}-new-${i}`, base + 10 + i);
  }

  // Eligibility: too little karma, or karma that came after the join.
  await t.throwsAsync(() => joinGroup(newcomer, identityOf(newcomer).commitment, base + 100), {
    message: /has 9 karma, needs 10 to join/,
  });
  await t.throwsAsync(() => joinGroup(members[0], identityOf(members[0]).commitment, base + 5), {
    message: /has 0 karma/,
  });
  t.is(countAnonJoins(), 0);

  // Joining. A join is signed like any other message.
  for (const [i, member] of members.entries()) {
    await joinGroup(member, identityOf(member).commitment, base + 100 + i);
  }
  t.is(countAnonJoins(), 3);
  await t.throwsAsync(() => joinGroup(members[0], identityOf(members[0]).commitment, base + 100), {
    message: /already joined/,
  });
  // Swapping the commitment would mint a fresh nullifier, so it's rejected.
  const swapped = new Identity(new Uint8Array(32).fill(9)).commitment;
  await t.throwsAsync(() => joinGroup(members[0], swapped, base + 200), {
    message: /already joined/,
  });
  t.is(countAnonJoins(), 3);

  // Every node builds the same group from the joins.
  const voteTime = base + 102 + ANON_ROOT_SETTLE_SECS + 10;
  const { group } = anon.settledGroup(voteTime);
  const expected = new Group(members.map((m) => identityOf(m).commitment));
  t.is(group.root, expected.root);
  t.deepEqual(anon.validRoots(voteTime).slice(-1), [expected.root.toString()]);

  // Upvoting anonymously with a real proof.
  const before = getSubmission(`0x${storyIndex}`);
  const karmaBefore = calculateKarmaFromDB(author.address);
  const memberKarmaBefore = calculateKarmaFromDB(members[0].address);
  const voter = identityOf(members[0]);
  const vote = await prove(voter, group, storyId, voteTime);
  t.log(`proof generation (depth ${vote.message.depth}): ${vote.ms}ms`);

  // A tampered proof, a changed timestamp or another story don't verify.
  const tampered = structuredClone(vote.message);
  tampered.proof[0] = (BigInt(tampered.proof[0]) + 1n).toString();
  await t.throwsAsync(() => store.add(trie, tampered, null, delegations), {
    message: /invalid Semaphore proof/,
  });
  await t.throwsAsync(
    () => store.add(trie, { ...vote.message, timestamp: voteTime + 1 }, null, delegations),
    { message: /invalid Semaphore proof/ },
  );
  await t.throwsAsync(
    () => store.add(trie, { ...vote.message, href: `kiwi:0x${otherIndex}` }, null, delegations),
    { message: /invalid Semaphore proof/ },
  );

  const started = Date.now();
  const voteIndex = await store.add(trie, vote.message, null, delegations);
  t.log(`node path (checks + proof verification + store): ${Date.now() - started}ms`);
  t.truthy(voteIndex);

  // It counts for the story and the submitter's karma...
  const after = getSubmission(`0x${storyIndex}`);
  t.is(after.upvotes, before.upvotes + 1);
  t.true(after.upvoters.some((u) => u.identity === ANON_IDENTITY));
  t.is(calculateKarmaFromDB(author.address), karmaBefore + 1);
  // ... but not for the voter, who isn't named anywhere.
  t.is(calculateKarmaFromDB(members[0].address), memberKarmaBefore);
  t.false(after.upvoters.some((u) => u.identity === members[0].address));
  const leaf = await store.leaf(trie, Buffer.from(voteIndex, "hex"), JSON.parse);
  t.false(JSON.stringify(leaf).toLowerCase().includes(members[0].address.toLowerCase().slice(2)));
  t.is(leaf.signature, undefined);

  // The same member can't upvote the same story twice.
  await t.throwsAsync(() => store.add(trie, vote.message, null, delegations), {
    message: /already exists|duplicate/,
  });
  const again = await prove(voter, group, storyId, voteTime + 5);
  t.is(again.message.nullifier, vote.message.nullifier);
  await t.throwsAsync(() => store.add(trie, again.message, null, delegations), {
    message: /nullifier was already used/,
  });

  // A root nodes don't know, or one that hasn't settled yet, is rejected.
  const outsider = new Identity(new Uint8Array(32).fill(9));
  const fake = new Group([...group.members, outsider.commitment]);
  const forged = await prove(outsider, fake, storyId, voteTime + 6);
  await t.throwsAsync(() => store.add(trie, forged.message, null, delegations), {
    message: /isn't one of the last/,
  });
  const tooEarly = base + 102 + ANON_ROOT_SETTLE_SECS - 10;
  const early = await prove(identityOf(members[1]), group, storyId, tooEarly);
  await t.throwsAsync(() => store.add(trie, early.message, null, delegations), {
    message: /isn't one of the last/,
  });

  // The story must exist, be a submission and be older than the upvote.
  await t.throwsAsync(
    () => store.add(trie, { ...vote.message, href: `kiwi:0x${"ab".repeat(36)}` }, null, delegations),
    { message: /Didn't find root message/ },
  );

  // Another member's upvote counts too.
  const second = await prove(identityOf(members[1]), group, storyId, voteTime + 7);
  t.not(second.message.nullifier, vote.message.nullifier);
  await store.add(trie, second.message, null, delegations);
  t.is(getSubmission(`0x${storyIndex}`).upvotes, before.upvotes + 2);
  t.is(calculateKarmaFromDB(author.address), karmaBefore + 2);

  // After a restart, the cache is rebuilt from the trie.
  const upvotes = await store.posts(trie, null, null, JSON.parse, null, delegations, null, "anon-upvote");
  t.is(upvotes.length, 2);
  t.is(upvotes[0].signer, null);
  t.is(upvotes[0].identity, null);
  const joins = await store.posts(trie, null, null, JSON.parse, null, delegations, null, "anon-join");
  t.deepEqual(
    joins.map((j) => j.identity).sort(),
    members.map((m) => m.address).sort(),
  );

  // The API serves the settled group and each account's status.
  const reply = () => {
    const r = { headers: {} };
    r.header = (k, v) => (r.headers[k] = v);
    r.status = (code) => ({ json: (body) => ({ code, body }) });
    return r;
  };
  const groupRes = await anonGroup()({}, reply());
  t.is(groupRes.code, 200);
  t.is(groupRes.body.data.size, 3);
  t.is(groupRes.body.data.root, expected.root.toString());
  t.deepEqual(
    groupRes.body.data.members,
    expected.members.map(String),
  );
  const statusRes = await anonStatus()(
    { query: { address: members[2].address } },
    reply(),
  );
  t.is(statusRes.body.data.member.commitment, identityOf(members[2]).commitment.toString());
  t.true(statusRes.body.data.member.settled);
  t.true(statusRes.body.data.eligible);
  const newcomerRes = await anonStatus()(
    { query: { address: newcomer.address } },
    reply(),
  );
  t.is(newcomerRes.body.data.member, null);
  t.false(newcomerRes.body.data.eligible);
  t.is(newcomerRes.body.data.karma, ANON_MIN_KARMA - 1);

  await rm("dbtestAnon", { recursive: true });
});
