import test from "ava";
import { join } from "path";
import { env } from "process";
import Database from "better-sqlite3";

import {
  insertMessage,
  findMessage,
  isDeleted,
  isDeletion,
  DELETE,
} from "../src/cache.mjs";

const author = "0x1111111111111111111111111111111111111111";
const other = "0x2222222222222222222222222222222222222222";
// Unique per run: the test cache persists between runs.
const run = Date.now().toString(16);
const hex = (seed) => (seed + run).padEnd(72, "0").slice(0, 72);

// Same tables as test/weekly_test.mjs (cache.initialize would add foreign
// keys that other tests' cleanup trips over), plus reactions, which
// reference the comment, like in production.
test.before(() => {
  const db = new Database(join(env.CACHE_DIR, "database.db"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY NOT NULL, href TEXT NOT NULL UNIQUE, title TEXT NOT NULL, timestamp INTEGER NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS upvotes (id TEXT PRIMARY KEY NOT NULL, href TEXT NOT NULL, timestamp INTEGER NOT NULL, title TEXT NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY NOT NULL, submission_id TEXT NOT NULL, timestamp INTEGER NOT NULL, title TEXT NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS fingerprints (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL, hash TEXT NOT NULL, timestamp INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS reactions (id TEXT PRIMARY KEY NOT NULL, comment_id TEXT NOT NULL, timestamp INTEGER NOT NULL, title TEXT NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL, FOREIGN KEY(comment_id) REFERENCES comments(id));
  `);
  db.close();
});

// A story by `author` with an upvote, a comment and a reaction by `other`,
// ids unique per test. Nothing is inserted until `insert` runs.
function thread(seed) {
  const id = (kind) => hex(`${kind}${seed}`);
  const link = `https://example.com/deletion-${seed}-${run}`;
  const messages = {
    story: {
      type: "amplify",
      href: link,
      index: id("a"),
      title: `Story ${seed}`,
      timestamp: 1000,
      signer: author,
      identity: author,
    },
    upvote: {
      type: "amplify",
      href: link,
      index: id("b"),
      title: `Story ${seed}`,
      timestamp: 1001,
      signer: other,
      identity: other,
    },
    comment: {
      type: "comment",
      href: `kiwi:0x${id("a")}`,
      index: id("c"),
      title: "posted this by mistake",
      timestamp: 1002,
      signer: author,
      identity: author,
    },
    reaction: {
      type: "comment",
      href: `kiwi:0x${id("c")}`,
      index: id("e"),
      title: "🥝",
      timestamp: 1003,
      signer: other,
      identity: other,
    },
  };
  const ids = Object.fromEntries(
    Object.entries(messages).map(([k, m]) => [k, `kiwi:0x${m.index}`]),
  );
  const del = (target, identity, n = "") => ({
    type: "comment",
    href: ids[target],
    index: id(`d${target[0]}${n}`),
    title: DELETE,
    timestamp: 1010,
    signer: identity,
    identity,
  });
  const insert = (...names) => names.forEach((n) => insertMessage(messages[n]));
  return { messages, ids, del, insert, link };
}

const present = (ids) =>
  Object.fromEntries(
    Object.entries(ids).map(([k, id]) => [k, findMessage(id)?.kind || null]),
  );

test("the author can delete their comment, reactions go with it", (t) => {
  const { ids, del, insert } = thread("1");
  insert("story", "upvote", "comment", "reaction");
  const removed = insertMessage(del("comment", author));
  t.is(removed.kind, "comment");
  t.is(removed.storyId, ids.story);
  t.deepEqual(present(ids), {
    story: "story",
    upvote: "upvote",
    comment: null,
    reaction: null,
  });
  t.true(isDeleted(ids.comment, author));
});

test("the author can delete their reaction", (t) => {
  const { ids, del, insert } = thread("2");
  insert("story", "upvote", "comment", "reaction");
  const removed = insertMessage(del("reaction", other));
  t.is(removed.kind, "reaction");
  t.is(removed.storyId, ids.story);
  t.is(present(ids).reaction, null);
  t.is(present(ids).comment, "comment");
});

test("the author can delete their upvote", (t) => {
  const { ids, del, insert } = thread("3");
  insert("story", "upvote");
  const removed = insertMessage(del("upvote", other));
  t.is(removed.kind, "upvote");
  t.is(removed.storyId, ids.story);
  t.is(present(ids).upvote, null);
  t.is(present(ids).story, "story");
});

test("deleting a story removes its whole thread", (t) => {
  const { ids, del, insert } = thread("4");
  insert("story", "upvote", "comment", "reaction");
  const removed = insertMessage(del("story", author));
  t.is(removed.kind, "story");
  t.deepEqual(removed.upvoters, [other]);
  t.deepEqual(present(ids), {
    story: null,
    upvote: null,
    comment: null,
    reaction: null,
  });
});

test("a deletion signed by someone else removes nothing", (t) => {
  const { ids, del, insert } = thread("5");
  insert("story", "upvote", "comment", "reaction");
  for (const target of ["story", "upvote", "comment", "reaction"]) {
    const signer = target === "upvote" || target === "reaction" ? author : other;
    t.is(insertMessage(del(target, signer)), null);
  }
  t.deepEqual(present(ids), {
    story: "story",
    upvote: "upvote",
    comment: "comment",
    reaction: "reaction",
  });
});

test("messages that sync in after their deletion stay deleted", (t) => {
  const { ids, del, insert } = thread("6");
  insert("story");
  insertMessage(del("comment", author));
  insertMessage(del("upvote", other));
  insert("comment", "upvote");
  t.is(present(ids).comment, null);
  t.is(present(ids).upvote, null);
});

test("older upvotes don't bring a deleted story back, a new submission may", (t) => {
  const { messages, ids, del, insert, link } = thread("7");
  insert("story");
  insertMessage(del("story", author));
  insert("upvote");
  t.is(present(ids).story, null);
  t.is(present(ids).upvote, null);

  const resubmission = {
    ...messages.upvote,
    index: hex(`f7`),
    timestamp: 1020,
  };
  insertMessage(resubmission);
  const found = findMessage(`kiwi:0x${resubmission.index}`);
  t.is(found.kind, "story");
  t.is(found.href, link);
});

test("only the exact marker counts as a deletion", (t) => {
  t.true(isDeletion(DELETE));
  t.false(isDeletion(` ${DELETE}`));
  t.false(isDeletion("delete"));
  t.false(isDeletion("kiwi:delete-comment"));
});
