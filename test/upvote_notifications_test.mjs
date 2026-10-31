// @format
// Upvote notifications: who upvoted. A protocol message from
// POST /api/v1/messages has no `identity`, so the upvoter is the identity its
// signer resolves to; the mini app's upvotes name it.
import test from "ava";
import { Wallet } from "ethers";

import * as id from "../src/id.mjs";
import { EIP712_MESSAGE } from "../src/constants.mjs";
import { getSlug } from "../src/utils.mjs";
import { triggerUpvoteNotification } from "../src/subscriptions.mjs";

const T = 1700000000;
const href = "https://example.com/a-story";
const index = "ab".repeat(36);

async function upvote(signer) {
  const message = id.create("A story", href, "amplify", T);
  return await id.sign(signer, message, EIP712_MESSAGE);
}

// The story is `author`'s; every upvoter has a name and a good score.
function setup(author, overrides = {}) {
  const pushed = [];
  const resolved = [];
  return {
    pushed,
    resolved,
    deps: {
      getSubmission: (_, link) =>
        link === href ? { identity: author, title: "A story", index } : null,
      getLists: async () => ({ addresses: [] }),
      resolve: async (address) => {
        resolved.push(address);
        return { displayName: `name-${address.slice(2, 6)}`, neynarScore: 0.9 };
      },
      fetchENSData: async () => ({}),
      getFids: async () => [],
      sendNeynar: async () => {},
      sendPush: async (receivers, notification) =>
        pushed.push({ receivers, notification }),
      ...overrides,
    },
  };
}

test("an upvote signed with a delegated key notifies the author, from the account", async (t) => {
  const author = Wallet.createRandom().address;
  const account = Wallet.createRandom();
  const device = Wallet.createRandom();
  const delegations = { [device.address]: account.address };
  const { pushed, resolved, deps } = setup(author);

  await triggerUpvoteNotification(await upvote(device), delegations, deps);

  t.deepEqual(resolved, [account.address]);
  t.deepEqual(pushed, [
    {
      receivers: [author],
      notification: {
        title: "New like",
        body: `name-${account.address.slice(2, 6)} upvoted your story: A story`,
        url: `https://news.kiwistand.com/stories/${getSlug("A story")}?index=0x${index}`,
      },
    },
  ]);
});

test("an upvote signed with the upvoter's own key notifies the author", async (t) => {
  const author = Wallet.createRandom().address;
  const reader = Wallet.createRandom();
  const { pushed, resolved, deps } = setup(author);
  await triggerUpvoteNotification(await upvote(reader), {}, deps);
  t.deepEqual(resolved, [reader.address]);
  t.deepEqual(pushed.map(({ receivers }) => receivers), [[author]]);
});

test("the author's own upvote doesn't notify, also with a delegated key", async (t) => {
  const author = Wallet.createRandom();
  const device = Wallet.createRandom();
  const delegations = { [device.address]: author.address };
  // NOTE: The cache may hold the author in another case.
  for (const stored of [author.address, author.address.toLowerCase()]) {
    const { pushed, deps } = setup(stored);
    await triggerUpvoteNotification(await upvote(author), {}, deps);
    await triggerUpvoteNotification(await upvote(device), delegations, deps);
    t.deepEqual(pushed, []);
  }
});

test("the mini app's upvotes name the upvoter and still notify", async (t) => {
  const author = Wallet.createRandom().address;
  const reader = Wallet.createRandom().address;
  const { pushed, resolved, deps } = setup(author);
  const unsigned = { type: "amplify", href, title: "A story", timestamp: T };
  await triggerUpvoteNotification({ ...unsigned, identity: reader }, {}, deps);
  t.deepEqual(resolved, [reader]);
  t.deepEqual(pushed.map(({ receivers }) => receivers), [[author]]);
  // The author's own doesn't.
  await triggerUpvoteNotification({ ...unsigned, identity: author }, {}, deps);
  t.is(pushed.length, 1);
});

test("banned upvoters, upvoters without a name or score and unknown stories don't notify", async (t) => {
  const author = Wallet.createRandom().address;
  const reader = Wallet.createRandom();
  const message = await upvote(reader);
  for (const overrides of [
    { getLists: async () => ({ addresses: [reader.address.toLowerCase()] }) },
    { getLists: async () => ({ addresses: [author.toLowerCase()] }) },
    { resolve: async () => ({}) },
    { resolve: async () => ({ displayName: "low", neynarScore: 0.1 }) },
    { getSubmission: () => null },
  ]) {
    const { pushed, deps } = setup(author, overrides);
    await triggerUpvoteNotification(message, {}, deps);
    t.deepEqual(pushed, [], Object.keys(overrides).join());
  }
});

test("comments and malformed messages don't notify", async (t) => {
  const author = Wallet.createRandom().address;
  const { pushed, deps } = setup(author);
  const comment = await id.sign(
    Wallet.createRandom(),
    id.create("Nice", `kiwi:0x${index}`, "comment", T),
    EIP712_MESSAGE,
  );
  await triggerUpvoteNotification(comment, {}, deps);
  const unsigned = { type: "amplify", href, title: "A story", timestamp: T };
  await t.notThrowsAsync(() => triggerUpvoteNotification(unsigned, {}, deps));
  t.deepEqual(pushed, []);
});
