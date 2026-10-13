// @format
import { env } from "process";
import { rm } from "fs/promises";
import { join } from "path";

import test from "ava";
import { Wallet } from "ethers";
import Database from "better-sqlite3";

import * as id from "../src/id.mjs";
import { EIP712_MESSAGE, EIP712_DELETE } from "../src/constants.mjs";
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
    // A deletion has no title and its own EIP-712 type.
    const del = async (signer, href, timestamp) => {
      const message = { href, type: "delete", timestamp };
      const signed = await id.sign(signer, message, EIP712_DELETE);
      return await store.add(trie, signed, null, delegations);
    };

    const link = `https://example.com/deletion-store-${now}`;
    const story = await add(author, "A story", link, "amplify", now);
    const upvote = await add(voter, "A story", link, "amplify", now + 1);
    await t.throwsAsync(() => add(voter, "A story", link, "amplify", now + 2));

    // Deleting the upvote is accepted by the protocol and frees the marker.
    await del(voter, `kiwi:0x${upvote}`, now + 3);
    t.is(findMessage(`kiwi:0x${upvote}`), null);
    const again = await add(voter, "A story", link, "amplify", now + 4);
    t.is(findMessage(`kiwi:0x${again}`).kind, "upvote");

    const comment = await add(author, "hi", `kiwi:0x${story}`, "comment", now + 5);
    const reaction = await add(voter, "🥝", `kiwi:0x${comment}`, "comment", now + 6);
    await t.throwsAsync(() =>
      add(voter, "🔥", `kiwi:0x${comment}`, "comment", now + 7),
    );
    await del(voter, `kiwi:0x${reaction}`, now + 8);
    t.is(findMessage(`kiwi:0x${reaction}`), null);
    const redo = await add(voter, "🔥", `kiwi:0x${comment}`, "comment", now + 9);
    t.is(findMessage(`kiwi:0x${redo}`).kind, "reaction");

    // Someone else can't delete the story; its author can.
    await del(voter, `kiwi:0x${story}`, now + 10);
    t.is(findMessage(`kiwi:0x${story}`).kind, "story");
    await del(author, `kiwi:0x${story}`, now + 11);
    t.is(findMessage(`kiwi:0x${story}`), null);
    t.is(findMessage(`kiwi:0x${comment}`), null);

    await rm("dbtestDeletion", { recursive: true });
  },
);

test.serial("delete messages have no title and their own signing type", async (t) => {
  const signer = Wallet.createRandom();
  const href = `kiwi:0x${"ab".repeat(36)}`;
  const deletion = { href, type: "delete", timestamp: 1700000000 };

  const ok = await id.sign(signer, deletion, EIP712_DELETE);
  t.is(id.verify(ok), signer.address);

  // A title isn't allowed on a delete message.
  const withTitle = await id.sign(
    signer,
    { ...deletion, title: "" },
    EIP712_MESSAGE,
  );
  t.throws(() => id.verify(withTitle), { message: /Wrongly formatted message/ });
});
