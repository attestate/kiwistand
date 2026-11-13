// @format
import test from "ava";
import { join } from "path";
import { env } from "process";

import Database from "better-sqlite3";

import { getSubmission, initializeReactions } from "../src/cache.mjs";

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
