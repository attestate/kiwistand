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
import { findMessage } from "../src/cache.mjs";

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

test.serial(
  "a deleted upvote and reaction can be redone, through the protocol",
  async (t) => {
    env.DATA_DIR = "dbtestDeletion";
    const trie = await store.create();
    const author = Wallet.createRandom();
    const voter = Wallet.createRandom();
    const delegations = {};
    const now = Math.floor(Date.now() / 1000) - 100;
    const add = async (signer, title, href, type, timestamp) => {
      const message = id.create(title, href, type, timestamp);
      const signed = await id.sign(signer, message, EIP712_MESSAGE);
      return await store.add(trie, signed, null, delegations);
    };

    const link = `https://example.com/deletion-store-${now}`;
    const story = await add(author, "A story", link, "amplify", now);
    const upvote = await add(voter, "A story", link, "amplify", now + 1);
    await t.throwsAsync(() => add(voter, "A story", link, "amplify", now + 2));

    // Deleting the upvote is accepted by the protocol and frees the marker.
    await add(voter, "", `kiwi:0x${upvote}`, "delete", now + 3);
    t.is(findMessage(`kiwi:0x${upvote}`), null);
    const again = await add(voter, "A story", link, "amplify", now + 4);
    t.is(findMessage(`kiwi:0x${again}`).kind, "upvote");

    const comment = await add(author, "hi", `kiwi:0x${story}`, "comment", now + 5);
    const reaction = await add(voter, "🥝", `kiwi:0x${comment}`, "comment", now + 6);
    await t.throwsAsync(() =>
      add(voter, "🔥", `kiwi:0x${comment}`, "comment", now + 7),
    );
    await add(voter, "", `kiwi:0x${reaction}`, "delete", now + 8);
    t.is(findMessage(`kiwi:0x${reaction}`), null);
    const redo = await add(voter, "🔥", `kiwi:0x${comment}`, "comment", now + 9);
    t.is(findMessage(`kiwi:0x${redo}`).kind, "reaction");

    // Someone else can't delete the story; its author can.
    await add(voter, "", `kiwi:0x${story}`, "delete", now + 10);
    t.is(findMessage(`kiwi:0x${story}`).kind, "story");
    await add(author, "", `kiwi:0x${story}`, "delete", now + 11);
    t.is(findMessage(`kiwi:0x${story}`), null);
    t.is(findMessage(`kiwi:0x${comment}`), null);

    await rm("dbtestDeletion", { recursive: true });
  },
);

test.serial("the protocol accepts delete messages only without text", async (t) => {
  const signer = Wallet.createRandom();
  const index = "ab".repeat(36);
  const sign = async (title) =>
    await id.sign(
      signer,
      id.create(title, `kiwi:0x${index}`, "delete", 1700000000),
      EIP712_MESSAGE,
    );
  const ok = await sign("");
  t.is(id.verify(ok), signer.address);
  const withText = await sign("bye");
  t.throws(() => id.verify(withText), { message: /Wrongly formatted message/ });
});
