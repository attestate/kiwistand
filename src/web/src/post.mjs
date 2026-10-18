// @format
// Posts: short text (up to 200 characters) and optionally one picture,
// shown like a Farcaster cast. Shared by the server's views (row.mjs,
// story.mjs, rss.mjs, social-posting.mjs) and the composer
// (SubmitButton.jsx), so it's plain ESM without dependencies.
//
// A post is a normal Kiwi "amplify" message, so the protocol doesn't change:
//
//   href  = "data:text/plain," + encodeURIComponent(text)
//         | "data:text/plain," + encodeURIComponent(text + "\n\n" + image)
//   title = deriveTitle(text)
//
// - text: 1 to 200 characters (graphemes, so an emoji counts as one),
//   trimmed, line breaks as "\n".
// - image (optional): the LAST line, after an empty line, and only a picture
//   uploaded to Kiwi's own Cloudflare Images account (POST_IMAGE_PATTERN).
//   Any other last line is part of the text.
// - title: the text's first 80 characters, cut at a word boundary with "…"
//   (deriveTitle). The post card and story page hide it; it's what's shown
//   where a title is needed (slug, <title>, og:title, RSS, notifications).
// - href stays within the protocol's 2048 characters after encoding.
//
// Old text posts (a title and a separate body in the same data: href) keep
// their rendering: a story is only a post when its title is exactly the
// title derived from its text (isPost).
//
// Clients that don't know posts show them as a text post whose last line is
// the picture's URL.

export const POST_PREFIX = "data:text/plain,";
export const MAX_POST_LENGTH = 200;
export const MAX_TITLE_LENGTH = 80;
export const MAX_HREF_LENGTH = 2048;
export const POST_IMAGE_PATTERN =
  /^https:\/\/imagedelivery\.net\/C5bPuWCkK_P2Rg7LwXEwPQ\/[A-Za-z0-9-]+\/public$/;

let segmenter;
// Characters as people count them (grapheme clusters: "👍🏽" or "é" is one).
// Falls back to code points where Intl.Segmenter is missing.
export function countCharacters(text) {
  const value = String(text ?? "");
  if (segmenter === undefined) {
    try {
      segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    } catch {
      segmenter = null;
    }
  }
  if (segmenter) {
    let count = 0;
    for (const _ of segmenter.segment(value)) count++;
    return count;
  }
  return Array.from(value).length;
}

// How the composer's text is stored: Windows/old Mac line breaks become
// "\n", and leading/trailing whitespace goes.
export function normalizeText(text) {
  return String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

// The title for a post's text: one line, its first 80 characters (code
// points, like the protocol's maxLength), cut at the last space when there
// is one in the second half, with "…".
export function deriveTitle(text) {
  const line = normalizeText(text).replace(/\s+/g, " ");
  const chars = Array.from(line);
  if (chars.length <= MAX_TITLE_LENGTH) return line;
  let cut = chars.slice(0, MAX_TITLE_LENGTH - 1).join("");
  const space = cut.lastIndexOf(" ");
  if (space >= MAX_TITLE_LENGTH / 2) cut = cut.slice(0, space);
  cut = cut.replace(/[\s.,;:!?\-–—]+$/u, "");
  return `${cut}…`;
}

export function isPostImage(url) {
  return typeof url === "string" && POST_IMAGE_PATTERN.test(url);
}

export function buildPostHref(text, image) {
  const body = normalizeText(text);
  const content = image ? `${body}\n\n${image}` : body;
  return POST_PREFIX + encodeURIComponent(content);
}

// { text, image } of a data:text/plain href, or null when it isn't one or
// doesn't decode. image is null without a (valid) picture line.
export function parsePostHref(href) {
  if (typeof href !== "string" || !href.startsWith(POST_PREFIX)) return null;
  let content;
  try {
    content = decodeURIComponent(href.slice(POST_PREFIX.length));
  } catch {
    return null;
  }
  const split = content.lastIndexOf("\n\n");
  if (split !== -1) {
    const last = content.slice(split + 2).trim();
    if (isPostImage(last)) {
      return { text: content.slice(0, split).trim(), image: last };
    }
  }
  return { text: content, image: null };
}

// The post in a story ({ title, href }), or null when it's a link or an
// old-style text post (whose title isn't derived from its text).
export function getPost(story) {
  if (!story || typeof story.title !== "string") return null;
  const post = parsePostHref(story.href);
  if (!post || !post.text) return null;
  if (story.title !== deriveTitle(post.text)) return null;
  return post;
}

export function isPost(story) {
  return getPost(story) !== null;
}

// What the composer shows and checks: { ok, error, count, remaining,
// title, href }. error is a sentence for the person writing, or null.
export function validatePost(text, image = null) {
  const body = normalizeText(text);
  const count = countCharacters(body);
  const remaining = MAX_POST_LENGTH - count;
  const title = deriveTitle(body);
  const href = buildPostHref(body, image);
  let error = null;
  if (!body) {
    error = "Write something to post.";
  } else if (remaining < 0) {
    error = `Posts can have up to ${MAX_POST_LENGTH} characters.`;
  } else if (image && !isPostImage(image)) {
    error = "The picture has to be uploaded here.";
  } else if (href.length > MAX_HREF_LENGTH) {
    error = "This post is too long once encoded. Please shorten it.";
  }
  return { ok: error === null, error, count, remaining, title, href };
}

// The text's links, for rendering: [{ text }, { href, display }, ...]. Only
// http(s) links; trailing punctuation stays text, the display drops the
// scheme and "www." and is shortened.
const LINK = /\bhttps?:\/\/[^\s<>"]+/g;
export function splitLinks(text) {
  const value = String(text ?? "");
  const parts = [];
  let last = 0;
  for (const match of value.matchAll(LINK)) {
    const href = match[0].replace(/[.,;:!?'")\]]+$/, "");
    if (!href.includes(".", href.indexOf("//"))) continue;
    if (match.index > last) parts.push({ text: value.slice(last, match.index) });
    const bare = href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
    const display = bare.length > 32 ? `${bare.slice(0, 31)}…` : bare;
    parts.push({ href, display });
    last = match.index + href.length;
  }
  if (last < value.length) parts.push({ text: value.slice(last) });
  return parts;
}
