//@format
// NOTE: How the notifications page groups likes and reactions, like the
// Farcaster client's notification groups (CastReactionNotificationGroup):
// one row per story with its likers, one row per comment with its reactors,
// a row of up to MAX_AVATARS distinct faces, newest first, and the headline
// "<newest name> and N others <predicate>". Pure functions without imports
// so they're testable without the database (test/activity_groups_test.mjs).

export const MAX_AVATARS = 8;

const lower = (address) => String(address || "").toLowerCase();

// The distinct addresses of `addresses` (oldest first, as generateFeed and
// the database return them) newest first, without `viewer` (you don't get a
// notification for your own like or reaction).
export function newestDistinct(addresses, viewer) {
  const seen = new Set([lower(viewer)]);
  const result = [];
  for (let i = addresses.length - 1; i >= 0; i--) {
    const key = lower(addresses[i]);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(addresses[i]);
  }
  return result;
}

// " and 1 other", " and 4 others" or "" for `count` actors in total.
export function othersText(count) {
  const others = count - 1;
  if (others <= 0) return "";
  return ` and ${others} ${others === 1 ? "other" : "others"}`;
}

// The headline as plain text, e.g. "alice.eth and 2 others liked your story".
export function headlineText(name, count, predicate) {
  return `${name}${othersText(count)} ${predicate}`;
}

// The reactions to your comments (one activity per reaction, as data()
// builds them, any order) as one group per comment: its reactions newest
// first, the distinct reactors newest first, the distinct emojis newest
// first and the newest reaction's timestamp, emoji and message (it has the
// comment's text and its story, for the link).
export function groupReactions(reactions, viewer) {
  const byComment = new Map();
  const sorted = [...reactions].sort((a, b) => b.timestamp - a.timestamp);
  for (const reaction of sorted) {
    const key = reaction.message.commentId;
    if (!byComment.has(key)) byComment.set(key, []);
    byComment.get(key).push(reaction);
  }
  const groups = [];
  for (const items of byComment.values()) {
    const newest = items[0];
    const reactors = newestDistinct(
      items.map((item) => item.message.identity).reverse(),
      viewer,
    );
    if (reactors.length === 0) continue;
    const emojis = [...new Set(items.map((item) => item.emoji).filter(Boolean))];
    groups.push({
      verb: "reactions",
      message: newest.message,
      timestamp: newest.timestamp,
      emoji: newest.emoji,
      emojis,
      reactors,
    });
  }
  return groups.sort((a, b) => b.timestamp - a.timestamp);
}

// The joins of your communities (one activity per person, as data() builds
// them, any order) as one group per community: the distinct members newest
// first, and the newest join's timestamp and message (it has the community).
// Your own joins aren't in it.
export function groupJoins(joins, viewer) {
  const byCommunity = new Map();
  const sorted = joins
    .filter((join) => lower(join.message.identity) !== lower(viewer))
    .sort((a, b) => b.timestamp - a.timestamp);
  for (const join of sorted) {
    const key = join.message.community.id;
    if (!byCommunity.has(key)) byCommunity.set(key, []);
    byCommunity.get(key).push(join);
  }
  const groups = [];
  for (const items of byCommunity.values()) {
    const members = newestDistinct(
      items.map((item) => item.message.identity).reverse(),
      viewer,
    );
    if (members.length === 0) continue;
    groups.push({
      verb: "joins",
      message: items[0].message,
      timestamp: items[0].timestamp,
      members,
    });
  }
  return groups.sort((a, b) => b.timestamp - a.timestamp);
}
