// @format
// Credit for curators in the newsletter: when a featured story is someone's
// first submission ever, or their first after a long break, the email (and
// its web versions, /newsletter and /weekly) says so next to the story.
// Recognition keeps contributors around; this makes it visible.

// A submitter counts as "returning" when their previous story is at least
// this many days older than the featured one.
export const RETURNING_AFTER_DAYS = 90;

const DAY = 24 * 60 * 60;

// Names that are really just an address ("0xC0B3...3D80", a full address)
// don't count: the credit is only shown to people with a Kiwi nickname, an
// ENS name or a Farcaster username.
export function hasName(name) {
  if (typeof name !== "string") return false;
  const value = name.trim();
  if (!value) return false;
  if (/^0x[0-9a-f]{40}$/i.test(value)) return false;
  if (/^0x[0-9a-f]*(\.{2,3}|…)[0-9a-f]*$/i.test(value)) return false;
  return true;
}

// "new" when the story is the submitter's first, "returning" when the one
// before it is RETURNING_AFTER_DAYS or more older, otherwise null.
// `previous` is the timestamp (unix seconds) of their latest earlier
// submission, or null/undefined if there is none.
export function classify(timestamp, previous) {
  if (!Number.isFinite(timestamp)) return null;
  if (previous === null || previous === undefined) return "new";
  if (!Number.isFinite(previous)) return null;
  const gap = timestamp - previous;
  return gap >= RETURNING_AFTER_DAYS * DAY ? "returning" : null;
}

// How long someone was away, in words: "3 months", "11 months", "1 year",
// "2 years".
export function awayFor(seconds) {
  const days = Math.max(0, Math.floor(seconds / DAY));
  const years = Math.floor(days / 365);
  if (years >= 1) return `${years} year${years === 1 ? "" : "s"}`;
  const months = Math.max(1, Math.floor(days / 30));
  return `${months} month${months === 1 ? "" : "s"}`;
}

// The credit for one featured story, or null when there is nothing to say
// or no name to say it with:
//   { kind: "new", name }                 "First story from alice — welcome!"
//   { kind: "returning", name, away }     "alice is back after 5 months"
export function creditFor({ displayName, timestamp, previous }) {
  if (!hasName(displayName)) return null;
  const kind = classify(timestamp, previous);
  if (kind === "new") return { kind, name: displayName.trim() };
  if (kind === "returning") {
    return {
      kind,
      name: displayName.trim(),
      away: awayFor(timestamp - previous),
    };
  }
  return null;
}

// The credit as plain text (preheaders, logs, tests).
export function creditText(credit) {
  if (!credit) return "";
  if (credit.kind === "new") return `First story from ${credit.name} — welcome!`;
  if (credit.kind === "returning")
    return `${credit.name} is back after ${credit.away}`;
  return "";
}

// Looks up the previous submission in the SQLite cache and builds the
// credit. `lookup` is cache.getPreviousSubmission (injected so this module
// stays free of the database for tests).
export function creditForStory(story, displayName, lookup) {
  if (!story?.identity || !Number.isFinite(story?.timestamp)) return null;
  if (!hasName(displayName)) return null;
  let previous = null;
  try {
    previous = lookup(story.identity, story.timestamp);
  } catch (err) {
    return null;
  }
  return creditFor({ displayName, timestamp: story.timestamp, previous });
}
