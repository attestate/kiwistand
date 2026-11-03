// @format
// Mentions in comments. In a comment's text a mention is "@" and the
// person's address, e.g. "@0x0f6A79A579658E401E0B81c6dde1F2cd51d97176", so
// it keeps pointing at them when they change their name. Names are only
// shown: wherever comment text is shown, each mention becomes "@<name>",
// their name at that time. The comment box shows names too and writes the
// addresses when posting (encode).
//
// Used by the comment box (CommentInput.jsx), the comments (CommentSection
// .jsx) and the server: the story page, the feeds' comment previews, the
// notifications (subscriptions.mjs, views/activity.mjs) and
// GET /api/v1/mentions (src/mentions.mjs).

// NOTE: A mention starts the text or follows whitespace, and no letter,
// digit or underscore follows it: an email address or a URL with "@0x…" in
// it isn't one, and neither are 41 hex characters.
const TOKEN = /(^|\s)@(0x[a-fA-F0-9]{40})(?![A-Za-z0-9_])/g;

// NOTE: Only a comment's first five mentions notify anyone, so one comment
// can't notify a crowd.
export const MAX_NOTIFIED = 5;

// The mentions in `text`: where each one's "@" is, where it ends and the
// address as written.
export function tokens(text) {
  const found = [];
  for (const match of text.matchAll(TOKEN)) {
    const start = match.index + match[1].length;
    found.push({ start, end: start + 43, address: match[2] });
  }
  return found;
}

// The addresses `text` mentions, lowercase, each once, in order.
export function mentioned(text) {
  return [...new Set(tokens(text).map(({ address }) => address.toLowerCase()))];
}

// The people a comment with `text` notifies: its first MAX_NOTIFIED.
export function notified(text) {
  return mentioned(text).slice(0, MAX_NOTIFIED);
}

export function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// A person's name in a mention: their display name (ENS, Farcaster or Kiwi
// nickname, see ens.resolve) without Farcaster's "@", else the short
// address.
export function nameOf(profile, address) {
  const name = profile?.displayName?.replace(/^@/, "");
  return name || shortAddress(address);
}

// The names of the people `texts` mention, {lowercase address: name}.
// `resolve(address)` gives a profile like ens.resolve.
export async function names(texts, resolve) {
  const addresses = [...new Set(texts.flatMap((text) => mentioned(text)))];
  const profiles = await Promise.allSettled(
    addresses.map((address) => resolve(address)),
  );
  return Object.fromEntries(
    addresses.map((address, i) => [
      address,
      nameOf(
        profiles[i].status === "fulfilled" ? profiles[i].value : null,
        address,
      ),
    ]),
  );
}

// `text` as strings and mentions, {address, name}, with the names from
// `names` (see names()) or the short address.
export function split(text, names = {}) {
  const parts = [];
  let last = 0;
  for (const { start, end, address } of tokens(text)) {
    if (start > last) parts.push(text.slice(last, start));
    const name = names[address.toLowerCase()] || shortAddress(address);
    parts.push({ address, name });
    last = end;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// `text` with each mention as "@<name>", for where it can't be a link.
export function render(text, names) {
  return split(text, names)
    .map((part) => (typeof part === "string" ? part : `@${part.name}`))
    .join("");
}

// The comment box: the "@…" typed right before `caret`, as where its "@"
// is and the text after it (up to 32 characters, see GET /api/v1/mentions),
// or null.
export function typing(text, caret) {
  const match = text.slice(0, caret).match(/(^|\s)@([^\s@]{0,32})$/);
  if (!match) return null;
  return { start: caret - match[2].length - 1, query: match[2] };
}

// Puts "@<name> " in place of what typing() found before `caret`.
export function insert(text, caret, at, name) {
  const before = `${text.slice(0, at.start)}@${name} `;
  return { text: before + text.slice(caret), caret: before.length };
}

// What the comment box posts: each "@<name>" it put in the text (`inserted`,
// {name: address}) becomes "@<address>". A name that was typed or changed
// by hand stays text, and so does an "@0x…" typed by hand.
export function encode(text, inserted) {
  const list = Object.keys(inserted).sort((a, b) => b.length - a.length);
  if (list.length === 0) return text;
  const escaped = list.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // NOTE: "@alice" isn't in "@alice.eth" or "@alice_b", but it is in
  // "@alice." at the end of a sentence.
  const end = "(?![\\p{L}\\p{N}_-]|\\.[\\p{L}\\p{N}_-])";
  const pattern = new RegExp(`(^|\\s)@(${escaped.join("|")})${end}`, "gu");
  return text.replace(pattern, (_, space, name) => `${space}@${inserted[name]}`);
}
