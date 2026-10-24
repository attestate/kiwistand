// @format
// Which writer or publication a story's link belongs to, for the "Best of
// <source>" pages at /source/<key> (src/sources.mjs). Pure, no I/O.
//
// A key is either a bare host without "www." (vitalik.eth.limo, ethresear.ch,
// name.substack.com) or, on a platform where many people publish under one
// host, the host plus the author's first path segment
// (paragraph.xyz/@name, x.com/handle). Aliases of a platform map to one host
// (twitter.com -> x.com) so one author has one page. A link to a platform
// without an author (x.com/i/..., youtube.com/watch) has no source.

const ALIASES = {
  "twitter.com": "x.com",
  "mobile.twitter.com": "x.com",
  "mobile.x.com": "x.com",
  "fxtwitter.com": "x.com",
  "vxtwitter.com": "x.com",
  "fixupx.com": "x.com",
  "warpcast.com": "farcaster.xyz",
  "paragraph.com": "paragraph.xyz",
  "m.youtube.com": "youtube.com",
  "youtu.be": "youtube.com",
  "gist.github.com": "github.com",
};

// Link hosts that aren't a source: image uploads, Kiwi itself, shorteners.
const EXCLUDED = new Set([
  "imagedelivery.net",
  "news.kiwistand.com",
  "kiwistand.com",
  "t.co",
  "bit.ly",
]);

const reserved = (words) => {
  const set = new Set(words);
  return (segment) => !segment.startsWith("@") && !set.has(segment);
};
const handle = (segment) => segment.startsWith("@") && segment.length > 1;

// Which first path segments name an author, per platform.
const PLATFORMS = {
  "paragraph.xyz": handle,
  "youtube.com": handle,
  "substack.com": handle,
  "hackmd.io": handle,
  "medium.com": (segment) =>
    handle(segment) ||
    reserved(["p", "m", "tag", "topic", "search", "me", "plans", "membership"])(
      segment,
    ),
  "x.com": reserved([
    "i",
    "home",
    "search",
    "explore",
    "hashtag",
    "intent",
    "share",
    "settings",
    "messages",
    "notifications",
    "compose",
    "login",
    "signup",
    "tos",
    "privacy",
  ]),
  "farcaster.xyz": reserved(["~", "channel", "channels", "search", "settings"]),
  "github.com": reserved([
    "orgs",
    "topics",
    "features",
    "marketplace",
    "sponsors",
    "settings",
    "explore",
    "collections",
    "about",
    "search",
    "trending",
    "login",
    "pricing",
    "enterprise",
    "apps",
    "users",
  ]),
  "mirror.xyz": reserved(["dashboard"]),
};

const NAMES = {
  "paragraph.xyz": "Paragraph",
  "youtube.com": "YouTube",
  "substack.com": "Substack",
  "hackmd.io": "HackMD",
  "medium.com": "Medium",
  "x.com": "X",
  "farcaster.xyz": "Farcaster",
  "github.com": "GitHub",
  "mirror.xyz": "Mirror",
};

const HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const SEGMENT = /^@?[a-z0-9_][a-z0-9._-]{0,99}$/;

function segmentOf(pathname) {
  const first = pathname.split("/").find(Boolean);
  if (!first) return null;
  let segment;
  try {
    segment = decodeURIComponent(first).toLowerCase();
  } catch (err) {
    return null;
  }
  return SEGMENT.test(segment) ? segment : null;
}

export function sourceKey(href) {
  if (typeof href !== "string" || !/^https?:\/\//i.test(href)) return null;
  let url;
  try {
    url = new URL(href);
  } catch (err) {
    return null;
  }
  let host = url.hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^www\./, "");
  if (!HOST.test(host) || EXCLUDED.has(host)) return null;
  host = ALIASES[host] || host;
  const isAuthor = PLATFORMS[host];
  if (!isAuthor) return host;
  const segment = segmentOf(url.pathname);
  return segment && isAuthor(segment) ? `${host}/${segment}` : null;
}

// The page's path. Keys only contain [a-z0-9._-@/], so this keeps them
// readable; "@" stays as is.
export function sourcePath(key) {
  return `/source/${key
    .split("/")
    .map((part) => encodeURIComponent(part).replace(/%40/g, "@"))
    .join("/")}`;
}

function keyOf(value) {
  if (!value || /[\s?#\\]/.test(value)) return null;
  return sourceKey(`https://${value}`);
}

// `rest` is the raw request path after "/source/". Anything that names a
// source (www., twitter.com, upper case, a whole article URL's path, a
// trailing slash) redirects to the canonical path. "<key>/context" is the
// Markdown twin; that's unambiguous because a platform host alone is never a
// key, so "x.com/context" is the X user "context".
export function resolveRequest(rest) {
  let value;
  try {
    value = decodeURIComponent(rest);
  } catch (err) {
    return { status: 404 };
  }
  let key = keyOf(value);
  let context = false;
  if (/\/context$/i.test(value)) {
    const inner = keyOf(value.slice(0, -"/context".length));
    if (inner) {
      key = inner;
      context = true;
    }
  }
  if (!key) return { status: 404 };
  const location = `${sourcePath(key)}${context ? "/context" : ""}`;
  if (`/source/${rest}` !== location) return { status: 308, location };
  return { status: 200, key, context };
}

// { host, author, platform } for display: "@vitalikbuterin" and "X" for
// x.com/vitalikbuterin, nulls for a plain host.
export function describe(key) {
  const [host, author] = key.split("/");
  if (!author) return { host, author: null, platform: null };
  const handles = ["x.com", "farcaster.xyz"].includes(host);
  return {
    host,
    author: handles ? `@${author}` : author,
    platform: NAMES[host] || host,
  };
}

// "vitalik.eth.limo", "@vitalikbuterin on X"
export function sourceName(key) {
  const { author, platform } = describe(key);
  return author ? `${author} on ${platform}` : key;
}
