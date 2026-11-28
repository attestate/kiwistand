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

// NOTE: Whether a node takes an upvote mustn't depend on the order it synced
// the messages in, or on whether it restarted. A node that got the story, its
// deletion and then an older upvote of it must free that upvote's marker just
// like a node that got the upvote before the deletion did.
test.serial(
  "an upvote a story deletion swept doesn't keep blocking its voter",
  async (t) => {
    env.DATA_DIR = "dbtestDeletionOrder";
    const trie = await store.create();
    const author = Wallet.createRandom();
    const voter = Wallet.createRandom();
    const delegations = {};
    const now = Math.floor(Date.now() / 1000) - 100;
    const sign = async (signer, title, href, type, timestamp) =>
      await id.sign(
        signer,
        id.create(title, href, type, timestamp),
        EIP712_MESSAGE,
      );
    const del = async (signer, href, timestamp) =>
      await id.sign(signer, { href, type: "delete", timestamp }, EIP712_DELETE);

    const link = `https://example.com/deletion-order-${now}`;
    const story = await sign(author, "A story", link, "amplify", now);
    const old = await sign(voter, "A story", link, "amplify", now + 1);
    const storyIndex = await store.add(trie, story, null, delegations);
    // The deletion comes in before the older upvote.
    await store.add(
      trie,
      await del(author, `kiwi:0x${storyIndex}`, now + 2),
      null,
      delegations,
    );
    await store.add(trie, old, null, delegations);
    const marker = store.upvoteID(voter.address, link, "amplify");
    t.false(store.upvotes.has(marker));

    // After a restart, the markers come from the trie again.
    store.upvotes.clear();
    const upvotes = [story, old].map((message) => ({
      ...message,
      identity: id.verify(message),
      index: id.toDigest(message).index,
    }));
    await store.cache(upvotes, []);
    t.false(store.upvotes.has(marker));

    // So the voter can submit the link again, as on every other node.
    const again = await store.add(
      trie,
      await sign(voter, "Again", link, "amplify", now + 3),
      null,
      delegations,
    );
    t.is(findMessage(`kiwi:0x${again}`).kind, "story");

    await rm("dbtestDeletionOrder", { recursive: true });
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

// NOTE: A story deletion marks the link as deleted up to its timestamp. Synced
// messages skip the future-timestamp check, so a deletion dated years ahead
// would have censored every later submission and upvote of the link.
test.serial(
  "a deletion dated in the future is refused, even while synching",
  async (t) => {
    env.DATA_DIR = "dbtestDeletionFuture";
    const trie = await store.create();
    const author = Wallet.createRandom();
    const other = Wallet.createRandom();
    const delegations = {};
    const now = Math.floor(Date.now() / 1000) - 100;
    const sign = async (signer, title, href, type, timestamp) =>
      await id.sign(
        signer,
        id.create(title, href, type, timestamp),
        EIP712_MESSAGE,
      );

    const link = `https://example.com/deletion-future-${now}`;
    const story = await store.add(
      trie,
      await sign(author, "A story", link, "amplify", now),
      null,
      delegations,
    );
    const future = await id.sign(
      author,
      { href: `kiwi:0x${story}`, type: "delete", timestamp: now + 10 * 365 * 86400 },
      EIP712_DELETE,
    );
    const synching = true;
    await t.throwsAsync(
      () => store.add(trie, future, null, delegations, synching),
      { message: /in the future/ },
    );
    t.is(findMessage(`kiwi:0x${story}`).kind, "story");

    // An honest deletion still works, and a later re-submission of the link
    // by someone else survives it.
    await store.add(
      trie,
      await id.sign(
        author,
        { href: `kiwi:0x${story}`, type: "delete", timestamp: now + 1 },
        EIP712_DELETE,
      ),
      null,
      delegations,
      synching,
    );
    t.is(findMessage(`kiwi:0x${story}`), null);
    const again = await store.add(
      trie,
      await sign(other, "Again", link, "amplify", now + 2),
      null,
      delegations,
    );
    t.is(findMessage(`kiwi:0x${again}`).kind, "story");

    await rm("dbtestDeletionFuture", { recursive: true });
  },
);
