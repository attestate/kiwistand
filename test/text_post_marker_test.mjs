// @format
import { env } from "process";
import { rm } from "fs/promises";
import { join } from "path";

import test from "ava";
import { Wallet } from "ethers";
import Database from "better-sqlite3";

import * as id from "../src/id.mjs";
import { EIP712_MESSAGE } from "../src/constants.mjs";
import * as store from "../src/store.mjs";

// Same tables as test/deletion_test.mjs.
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

const sign = async (signer, title, href, timestamp) =>
  await id.sign(
    signer,
    id.create(title, href, "amplify", timestamp),
    EIP712_MESSAGE,
  );

// NOTE: A text post's link is its text. Signing the same text again must count
// as upvoting it again, which is a duplicate, just like with a URL.
test.serial("the same text can't be upvoted twice by one member", async (t) => {
  env.DATA_DIR = "dbtestTextPostMarker";
  const trie = await store.create();
  const author = Wallet.createRandom();
  const voter = Wallet.createRandom();
  const delegations = {};
  const now = Math.floor(Date.now() / 1000) - 100;
  const text = `data:text/plain,${encodeURIComponent(`hello ${now}`)}`;

  await store.add(trie, await sign(author, "Hi", text, now), null, delegations);
  await t.throwsAsync(
    store.add(trie, await sign(author, "Hi", text, now + 1), null, delegations),
  );

  await store.add(trie, await sign(voter, "Hi", text, now + 2), null, delegations);
  await t.throwsAsync(
    store.add(trie, await sign(voter, "Hi", text, now + 3), null, delegations),
  );

  await rm("dbtestTextPostMarker", { recursive: true });
});

// NOTE: A node that restarted (store.cache) must reject the same messages as
// one that didn't.
test.serial(
  "after a restart, a text post's author still can't upvote it again",
  async (t) => {
    env.DATA_DIR = "dbtestTextPostRestart";
    const trie = await store.create();
    const author = Wallet.createRandom();
    const delegations = {};
    const now = Math.floor(Date.now() / 1000) - 100;
    const text = `data:text/plain,${encodeURIComponent(`restart ${now}`)}`;

    const post = await sign(author, "Hi", text, now);
    await store.add(trie, post, null, delegations);

    store.upvotes.clear();
    await store.cache(
      [
        {
          ...post,
          identity: id.verify(post),
          index: id.toDigest(post).index,
        },
      ],
      [],
    );

    await t.throwsAsync(
      store.add(trie, await sign(author, "Hi", text, now + 1), null, delegations),
    );

    await rm("dbtestTextPostRestart", { recursive: true });
  },
);
