//@format
import test from "ava";

import {
  MAX_AVATARS,
  newestDistinct,
  othersText,
  headlineText,
  groupReactions,
} from "../src/views/activity-groups.mjs";
import * as activity from "../src/views/activity.mjs";

const me = "0x000000000000000000000000000000000000aaaa";
const addr = (n) => `0x${String(n).padStart(40, "0")}`;

test("othersText: just the name for one, '1 other' for two, 'N others' beyond", (t) => {
  t.is(othersText(0), "");
  t.is(othersText(1), "");
  t.is(othersText(2), " and 1 other");
  t.is(othersText(5), " and 4 others");
});

test("headlineText reads like Farcaster's notification groups", (t) => {
  t.is(headlineText("alice.eth", 1, "liked your story"), "alice.eth liked your story");
  t.is(
    headlineText("alice.eth", 2, "liked your story"),
    "alice.eth and 1 other liked your story",
  );
  t.is(
    headlineText("bob.eth", 12, "reacted to your comment"),
    "bob.eth and 11 others reacted to your comment",
  );
});

test("newestDistinct: newest first, distinct (any case), without the viewer", (t) => {
  const oldestFirst = [addr(1), addr(2), addr(1).toUpperCase().replace("0X", "0x"), me, addr(3)];
  t.deepEqual(newestDistinct(oldestFirst, me), [addr(3), addr(1).toUpperCase().replace("0X", "0x"), addr(2)]);
  t.deepEqual(newestDistinct([], me), []);
});

const reaction = (comment, by, emoji, timestamp) => ({
  verb: "reacted",
  timestamp,
  emoji,
  identities: [by],
  message: {
    identity: by,
    commentId: `kiwi:0x${comment}`,
    submissionId: "kiwi:0xstory",
    submission_title: "A story",
    comment_title: `Comment ${comment}`,
    title: emoji,
  },
});

test("groupReactions: one group per comment, reactors and emojis newest first", (t) => {
  const groups = groupReactions(
    [
      reaction("c1", addr(1), "🔥", 10),
      reaction("c2", addr(2), "👍", 15),
      reaction("c1", addr(2), "😂", 20),
      reaction("c1", addr(1), "🔥", 30),
      reaction("c1", me, "🥝", 40),
    ],
    me,
  );
  t.is(groups.length, 2);
  const [c1, c2] = groups;
  t.is(c1.verb, "reactions");
  t.is(c1.message.commentId, "kiwi:0xc1");
  // The viewer's own reaction is the newest, but not one of the reactors.
  t.is(c1.timestamp, 40);
  t.deepEqual(c1.reactors, [addr(1), addr(2)]);
  t.deepEqual(c1.emojis, ["🥝", "🔥", "😂"]);
  t.is(c1.emoji, "🥝");
  t.is(c2.timestamp, 15);
  t.deepEqual(c2.reactors, [addr(2)]);
  t.deepEqual(c2.emojis, ["👍"]);
});

test("groupReactions drops a comment only you reacted to", (t) => {
  t.deepEqual(groupReactions([reaction("c1", me, "🔥", 10)], me), []);
});

const actor = (n) => ({
  address: addr(n),
  displayName: `user${n}.eth`,
  safeAvatar: n % 2 ? `https://example.com/${n}.png` : null,
});

function feed() {
  return [
    {
      verb: "liked",
      timestamp: 100,
      message: { title: "My story", index: "abc" },
      identities: [],
      actors: [10, 9, 8, 7, 6, 5, 4, 3].map(actor),
      actorCount: 12,
    },
    {
      verb: "liked",
      timestamp: 90,
      message: { title: "Second story", index: "def" },
      identities: [],
      actors: [actor(1), actor(2)],
      actorCount: 2,
    },
    {
      verb: "liked",
      timestamp: 80,
      message: { title: "Third story", index: "123" },
      identities: [],
      actors: [actor(3)],
      actorCount: 1,
    },
    {
      verb: "reactions",
      timestamp: 70,
      emoji: "🔥",
      emojis: ["🔥", "😂"],
      actors: [actor(5), actor(7), actor(9)],
      actorCount: 3,
      message: {
        commentId: "kiwi:0xcomment",
        submissionId: "kiwi:0xstory",
        submission_title: "A story",
        comment_title: "Nice one",
      },
    },
  ];
}

test("page renders grouped likes and reactions with faces and headlines", async (t) => {
  const out = (await activity.page("light", me, feed(), 85, false)).toString();
  const faces = out.match(/class="n2-notif-face"/g) || [];
  t.is(faces.length, MAX_AVATARS + 2 + 1 + 3);
  t.true(out.includes('href="/upvotes?address=' + addr(10) + '"'));
  t.true(out.includes(">user10.eth</a> and 11 others liked your story"));
  t.true(out.includes(">user1.eth</a> and 1 other liked your story"));
  t.true(out.includes(">user3.eth</a> liked your story"));
  t.true(out.includes(">user5.eth</a> and 2 others reacted to your comment"));
  t.true(out.includes('<span class="n2-notif-emojis">🔥 😂</span>'));
  t.true(out.includes(">Nice one</span>"));
  t.true(out.includes(">My story</span>"));
  // The story link (and the newest reaction's emoji for the burst).
  t.true(out.includes('href="/stories/My-story?index=0xabc"'));
  t.true(
    out.includes(
      `href="/stories/A-story?index=0xstory&amp;reaction=${encodeURIComponent("🔥")}#0xcomment"`,
    ),
  );
  // Unread: newer than lastUpdate (85) are the first two rows.
  t.is((out.match(/n2-notif n2-notif-group is-new/g) || []).length, 2);
  t.is((out.match(/class="n2-notif-dot"/g) || []).length, 2);
  // Fixed avatar sizes (no layout shift).
  t.true(out.includes('width="24" height="24"'));
  // No links inside links: the cover link is empty.
  t.regex(out, /<a class="n2-notif-cover notification"[^>]*><\/a>/);
});
