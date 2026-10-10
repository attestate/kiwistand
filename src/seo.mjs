// @format
// <title> and meta description for story pages, picked for search results.
//
// Chosen with the offline SERP snippet eval in the private metrics repo
// (evals/serp, strategy "C"): an Opus grader scored 60 real stories' snippets
// on accuracy, information scent, key entity, fit to Google's display and
// quality. Everything here is deterministic and uses only what the page has
// at render time: the story title and link, the stored AI summary (already
// filtered by isSafeSummary in getSummary), the linked page's own description
// (cachedMetadata().ogDescription) and the text of a text post.
//
// The returned strings are plain text; vhtml escapes them in attributes.

export const BRAND = " | Kiwi News";
export const TITLE_MAX = 60;
export const DESC_MAX = 155;

const ENTITIES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&nbsp;": " ",
};

// Plain one-line text: no tags (fxtwitter descriptions contain <br>), no
// entities, no bare URLs, no runs of whitespace.
export function cleanText(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39|#x27|nbsp);/g, (m) => ENTITIES[m])
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Splits after . ! ? (optionally closed by a quote or bracket) when the next
// sentence starts with an uppercase letter, digit or quote; one-letter
// abbreviations ("U.S. ") don't end a sentence.
export function sentences(text) {
  const parts = [];
  const re = /[.!?]["'”’)\]]?\s+(?=["“'‘(]?[A-Z0-9@$])/g;
  let start = 0;
  let m;
  while ((m = re.exec(text))) {
    const end = m.index + m[0].trimEnd().length;
    const before = text.slice(start, m.index + 1);
    if (/(^|\s|\.)[A-Z]\.$/.test(before)) continue;
    parts.push(text.slice(start, end).trim());
    start = m.index + m[0].length;
  }
  const rest = text.slice(start).trim();
  if (rest) parts.push(rest);
  return parts;
}

// Cuts at a word boundary and adds an ellipsis.
export function cutWords(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  const head = (space > max * 0.6 ? cut.slice(0, space) : cut).replace(
    /[\s,;:–—-]+$/,
    "",
  );
  return `${head}…`;
}

// Whole sentences while they fit; if that leaves little text (or the first
// sentence alone is too long), fills up with the next sentence cut at a word.
export function clip(text, max = DESC_MAX) {
  text = cleanText(text);
  if (text.length <= max) return text;
  let out = "";
  for (const s of sentences(text)) {
    const next = out ? `${out} ${s}` : s;
    if (next.length > max) {
      if (out.length < max * 0.65) return cutWords(next, max);
      return out;
    }
    out = next;
  }
  return out;
}

// Hosts whose name says nothing about the story.
const OPAQUE_HOSTS = new Set([
  "x.com",
  "twitter.com",
  "farcaster.xyz",
  "warpcast.com",
  "imagedelivery.net",
  "firefly.social",
  "bsky.app",
  "t.co",
]);

export function domainOf(href) {
  if (!href || !/^https?:\/\//.test(href)) return "";
  try {
    return new URL(href).hostname.split(".").slice(-2).join(".");
  } catch {
    return "";
  }
}

// Site-wide boilerplate some publishers put in every page's description.
const BOILERPLATE = [
  /^GitHub Gist: instantly share code/i,
  /^Contribute to [\w.-]+\/[\w.-]+ development by creating an account on GitHub/i,
  /^Available on (iOS|Android)/i,
  /went live on Twitch/i,
  /^Watch .* on YouTube/i,
  /^Enjoy the videos and music you love/i,
  /^Read writing from .* on Medium/i,
  /^Subscribe to /i,
  /^Sign (up|in) /i,
];

// The linked page's own description is only useful if it says something
// about this story: not boilerplate, not a short tagline or author bio.
export function usableArticleDescription(desc, title) {
  const text = cleanText(desc);
  if (text.length < 25) return "";
  if (BOILERPLATE.some((re) => re.test(text))) return "";
  if (text.toLowerCase() === cleanText(title).toLowerCase()) return "";
  return text;
}

function wordCount(title) {
  return cleanText(title)
    .replace(/^(@[\w.-]+|[\w-]+\.eth):\s*/, "")
    .split(/\s+/)
    .filter(Boolean).length;
}

// No summary and nothing usable from the linked page: the title (which
// Google cuts off at ~60 chars) plus where the link goes, so the snippet
// still says what the page is.
export function fallbackDescription(title, href) {
  const t = cleanText(title);
  const end = /[.!?…]$/.test(t) ? "" : ".";
  const domain = domainOf(href);
  const from = domain ? ` from ${domain}` : "";
  for (const context of [
    `Shared${from} and discussed on Kiwi News, the community-curated crypto and Ethereum news feed.`,
    `Shared${from} and discussed on Kiwi News.`,
  ]) {
    const text = `${t}${end} ${context}`;
    if (text.length <= DESC_MAX) return text;
  }
  return clip(t);
}

// Short publisher descriptions get the same context appended.
function padShort(text, href) {
  if (!text || text.length >= 90) return text;
  const domain = domainOf(href);
  return clip(
    `${text} Shared${domain ? ` from ${domain}` : ""} and discussed on Kiwi News.`,
  );
}

function hostOf(href) {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function storyTitle(title, href) {
  let t = cleanText(title);
  const domain = domainOf(href);
  if (
    domain &&
    !OPAQUE_HOSTS.has(domain) &&
    wordCount(t) <= 3 &&
    !t.toLowerCase().includes(domain.split(".")[0])
  ) {
    t = `${t} – ${hostOf(href)}`;
  }
  return t.length + BRAND.length <= TITLE_MAX ? `${t}${BRAND}` : t;
}

// "<title> | Kiwi News" when that fits in Google's ~60 chars, otherwise the
// bare title (Google shows the site name next to the result anyway, and the
// suffix would push the title's own words past the cut). Vague titles of up
// to three words get the linked host, e.g. "Pacto – covenant-gov.github.io".
export const storyDocumentTitle = storyTitle;

// Summary first: it says what's behind the link in neutral, specific words.
// Then a text post's own text, then the linked page's description unless it's
// boilerplate, then the title plus where the link goes.
export function storyDescription({
  title,
  href,
  summary,
  articleDescription,
  textContent,
}) {
  return (
    (summary && clip(summary)) ||
    (textContent && clip(textContent)) ||
    padShort(clip(usableArticleDescription(articleDescription, title)), href) ||
    fallbackDescription(title, href)
  );
}
