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
//
// src/writers.mjs (/writers) uses the same keys, so both agree on who a
// writer is.

// X/Twitter and its frontends and mirrors (nitter, xcancel, fxtwitter). Links
// to them have the same paths as x.com. src/parser.mjs uses this list for
// tweet previews too.
export const twitterFrontends = [
  "xcancel.com",
  "nitter.net",
  "nitter.privacydev.net",
  "nitter.poast.org",
  "nitter.lucabased.xyz",
  "nitter.kavin.rocks",
  "nitter.tiekoetter.com",
  "nitter.qwik.space",
  "bird.habedieeh.re",
  "nitter.lunar.icu",
  "nitter.moomoo.me",
  "nitter.kylrth.com",
  "nitter.io.lol",
  "nitter.rawbit.ninja",
  "nitter.holo-mix.com",
  "twitter.com",
  "x.com",
  "fxtwitter.com",
  "vxtwitter.com",
];

const ALIASES = {
  ...Object.fromEntries(twitterFrontends.map((host) => [host, "x.com"])),
  "mobile.twitter.com": "x.com",
  "mobile.x.com": "x.com",
  "fixupx.com": "x.com",
  "warpcast.com": "farcaster.xyz",
  "paragraph.com": "paragraph.xyz",
  "m.youtube.com": "youtube.com",
  "youtu.be": "youtube.com",
  "gist.github.com": "github.com",
  "t2.world": "app.t2.world",
};

// Link hosts that aren't a writer or publication: image and file uploads,
// IPFS and Arweave gateways, Google Docs/Drive, link shorteners and Kiwi
// itself. A host is excluded with all its subdomains (i.imgur.com,
// <cid>.ipfs.dweb.link, files.catbox.moe).
const EXCLUDED = [
  "imagedelivery.net",
  "news.kiwistand.com",
  "kiwistand.com",
  "t.co",
  "bit.ly",
  "tinyurl.com",
  "buff.ly",
  "ow.ly",
  "goo.gl",
  "dub.sh",
  "lnkd.in",
  "catbox.moe",
  "imgur.com",
  "ibb.co",
  "postimg.cc",
  "ipfs.io",
  "dweb.link",
  "w3s.link",
  "nftstorage.link",
  "cloudflare-ipfs.com",
  "gateway.pinata.cloud",
  "mypinata.cloud",
  "ipfs.tech",
  "arweave.net",
  "docs.google.com",
  "drive.google.com",
];

function excluded(host) {
  return EXCLUDED.some((name) => host === name || host.endsWith(`.${name}`));
}

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
  // T2 articles (app.t2.world/article/<id>) don't name the author.
  "app.t2.world": handle,
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
  "app.t2.world": "T2",
};

const HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const SEGMENT = /^@?[a-z0-9_][a-z0-9._-]{0,99}$/;

function segmentOf(pathname, position = 0) {
  const first = pathname.split("/").filter(Boolean)[position];
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
  if (!HOST.test(host) || excluded(host)) return null;
  if (host === "open.substack.com") return substackApp(url.pathname);
  if (host === "firefly.social") return firefly(url.pathname);
  host = ALIASES[host] || host;
  const isAuthor = PLATFORMS[host];
  if (!isAuthor) return host;
  const segment = segmentOf(url.pathname);
  return segment && isAuthor(segment) ? `${host}/${segment}` : null;
}

// Substack app links: open.substack.com/pub/<name>/p/<slug> is
// <name>.substack.com/p/<slug>.
function substackApp(pathname) {
  if (segmentOf(pathname) !== "pub") return null;
  const name = segmentOf(pathname, 1);
  return name && /^[a-z0-9-]+$/.test(name) ? `${name}.substack.com` : null;
}

// firefly.social is a client for Farcaster, Lens and X. Profile links name
// the author (/profile/farcaster/<name>, /profile/x/<handle>); post links
// (/post/farcaster/<hash>, /post/x/<id>) and Lens profiles don't map to a
// key we have, so they have no source.
const FIREFLY = { farcaster: "farcaster.xyz", x: "x.com", twitter: "x.com" };
function firefly(pathname) {
  if (segmentOf(pathname) !== "profile") return null;
  const host = FIREFLY[segmentOf(pathname, 1)];
  const name = segmentOf(pathname, 2);
  if (!host || !name || !PLATFORMS[host](name)) return null;
  return `${host}/${name}`;
}

// One person often has two Farcaster usernames, "name" and the ENS name
// "name.eth". Without an FID lookup we can't be sure they're the same
// account, so this merges only when both keys exist: the one with fewer
// stories becomes an alias of the other. `counts` maps keys to their story
// counts; returns a Map of alias -> key.
// TODO: Merge by FID once the build has the usernames' FIDs.
export function farcasterAliases(counts) {
  const aliases = new Map();
  for (const [key, count] of counts) {
    const match = key.match(/^farcaster\.xyz\/(.+)\.eth$/);
    if (!match) continue;
    const plain = `farcaster.xyz/${match[1]}`;
    if (!counts.has(plain)) continue;
    const other = counts.get(plain);
    if (count > other) aliases.set(plain, key);
    else aliases.set(key, plain);
  }
  return aliases;
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
