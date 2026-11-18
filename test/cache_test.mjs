// @format
import test from "ava";
import { join } from "path";
import { env } from "process";

import Database from "better-sqlite3";
import { Wallet } from "ethers";

import {
  getSubmission,
  initializeReactions,
  insertMessage,
  listNewest,
  calculateKarmaFromDB,
  getKarmaRanking,
  getWeekStories,
  getUpvotes,
  reattribute,
} from "../src/cache.mjs";

const INDEX = "0x" + "c4".repeat(36);
const ID = `kiwi:${INDEX}`;
const HREF = "https://cache-test.example/story";
const SUBMITTER = "0x0eFE9eB3cE412C3b06BacC8eC5Fc85Aa1d3cc772";
const COMMENTER = "0x000000000000000000000000000000000000c0de";

function openTestDb() {
  const db = new Database(join(env.CACHE_DIR, "database.db"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY NOT NULL, href TEXT NOT NULL UNIQUE, title TEXT NOT NULL, timestamp INTEGER NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS upvotes (id TEXT PRIMARY KEY NOT NULL, href TEXT NOT NULL, timestamp INTEGER NOT NULL, title TEXT NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY NOT NULL, submission_id TEXT NOT NULL, timestamp INTEGER NOT NULL, title TEXT NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL);
  `);
  return db;
}

function cleanup(db) {
  db.prepare(`DELETE FROM submissions WHERE id = ?`).run(ID);
  db.prepare(`DELETE FROM comments WHERE submission_id = ?`).run(ID);
}

test.before(() => {
  initializeReactions();
  const db = openTestDb();
  cleanup(db);
  db.prepare(
    `INSERT INTO submissions (id, href, title, timestamp, signer, identity) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(ID, HREF, "Story", 1700000000, SUBMITTER, SUBMITTER);
  db.prepare(
    `INSERT INTO comments (id, submission_id, timestamp, title, signer, identity) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(`kiwi:0x${"c5".repeat(36)}`, ID, 1700000060, "hi", COMMENTER, COMMENTER);
  db.close();
});

test.after.always(() => {
  const db = openTestDb();
  cleanup(db);
  db.close();
});

test("getSubmission returns a story whose submitter isn't banned", (t) => {
  const story = getSubmission(INDEX, null, null, null, [COMMENTER]);
  t.is(story.href, HREF);
  t.is(story.comments.length, 0, "banned commenters are hidden");
});

test("getSubmission throws for a banned submitter's story", (t) => {
  const banned = [SUBMITTER.toLowerCase()];
  t.throws(() => getSubmission(INDEX, null, null, null, banned), {
    message: /moderated/,
  });
  t.throws(() => getSubmission(null, HREF, null, null, banned), {
    message: /moderated/,
  });
});

test("getSubmission without a banlist still returns every story", (t) => {
  t.is(getSubmission(INDEX).href, HREF);
});

// NOTE: Nodes take one upvote per signer (src/store.mjs), and delegations are
// free, so one identity can upvote a story with its wallet and each key. Read
// paths count it once (COUNTED_UPVOTES in src/cache.mjs).
test("an identity's upvotes with its wallet and two keys count once", (t) => {
  const db = openTestDb();
  const submitter = Wallet.createRandom().address;
  const identity = Wallet.createRandom().address;
  const keys = [Wallet.createRandom().address, Wallet.createRandom().address];
  const href = `https://dedupe.example/${Date.now()}`;
  const now = Math.floor(Date.now() / 1000) - 600;
  const byte = (i) => i.toString(16).padStart(2, "0");
  const index = `${now.toString(16)}${"d1".repeat(32)}`;
  const amplify = (i, signer, identity, timestamp) => ({
    type: "amplify",
    href,
    title: "Story",
    index: `${timestamp.toString(16)}${byte(i).repeat(32)}`,
    timestamp,
    signer,
    identity,
  });
  insertMessage({ ...amplify(0, submitter, submitter, now), index });
  // NOTE: The second key's upvote reached this node while it counted for the
  // key itself (e.g. before its delegation was known); reattribute credits it
  // to the identity.
  const upvotes = [
    amplify(0xe1, identity, identity, now + 1),
    amplify(0xe2, keys[0], identity, now + 2),
    amplify(0xe3, keys[1], keys[1], now + 3),
  ];
  upvotes.forEach(insertMessage);
  t.is(getSubmission(null, href).upvotes, 3);
  reattribute(keys[1], () => identity);

  const story = getSubmission(null, href);
  t.is(story.upvotes, 2);
  t.deepEqual(
    story.upvoters.map(({ identity }) => identity),
    [submitter, identity],
  );
  t.is(story.upvoters[1].timestamp, now + 1);
  const newest = listNewest(500).find((story) => story.href === href);
  t.is(newest.upvotes, 2);
  t.deepEqual(newest.upvoters, [submitter, identity]);
  const week = getWeekStories(now, now + 1, 500).find(
    (story) => story.href === href,
  );
  t.is(week.upvotes, 2);
  // Karma: one for the story, one for the identity's upvotes.
  t.is(calculateKarmaFromDB(submitter), 2);
  t.is(
    getKarmaRanking().find((row) => row.identity === submitter).karma,
    2,
  );
  t.is(
    getUpvotes(submitter).filter(({ href: link }) => link === href).length,
    2,
  );

  // The submitter's own key adds nothing either.
  const key = Wallet.createRandom().address;
  insertMessage(amplify(0xe4, key, submitter, now + 4));
  t.is(getSubmission(null, href).upvotes, 2);
  t.is(calculateKarmaFromDB(submitter), 2);

  // Reactions to a comment count once per identity, too.
  const comment = `kiwi:0x${"d2".repeat(36)}`;
  const react = (i, signer) => ({
    type: "comment",
    href: comment,
    title: "🥝",
    index: `${now.toString(16)}${byte(i).repeat(32)}`,
    timestamp: now + i,
    signer,
    identity,
  });
  insertMessage({
    type: "comment",
    href: `kiwi:0x${index}`,
    title: "hi",
    index: "d2".repeat(36),
    timestamp: now + 5,
    signer: submitter,
    identity: submitter,
  });
  [react(0x10, identity), react(0x11, keys[0])].forEach(insertMessage);
  const [reactions] = getSubmission(null, href).comments.map(
    ({ reactions }) => reactions,
  );
  t.deepEqual(reactions, [{ emoji: "🥝", count: 1, reactors: [identity] }]);

  db.prepare(`DELETE FROM upvotes WHERE href = ?`).run(href);
  db.prepare(`DELETE FROM reactions WHERE comment_id = ?`).run(comment);
  db.prepare(`DELETE FROM comments WHERE id = ?`).run(comment);
  db.prepare(`DELETE FROM submissions WHERE href = ?`).run(href);
  db.close();
});
