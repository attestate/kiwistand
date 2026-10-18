//@format
import { LRUCache } from "lru-cache";
import { extractWarpcastContent, extractBlueskyContent, parseInWorker } from "../../parser.mjs";
import { safeFetch } from "../../safefetch.mjs";
import { wrapParagraphs, fromParagraphs } from "./article.mjs";

export { parseDiscourseTopic, parseArxivAbs, requiresCaptcha, stripBoilerplate } from "./article.mjs";

const FETCH_TIMEOUT = 15_000;
const MAX_PAGE_BYTES = 5 * 1024 * 1024;

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

// LRU cache for extracted articles
const extractionCache = new LRUCache({
  max: 500,
  maxSize: 50 * 1024 * 1024, // 50MB max
  sizeCalculation: (value) => {
    const estimated =
      (value?.title?.length || 0) +
      (value?.plainText?.length || 0) +
      (value?.wrappedHtml?.length || 0);
    return estimated > 0 ? estimated : 1;
  },
  ttl: 1000 * 60 * 60 * 24, // 24 hour TTL
});

function isFarcasterUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "warpcast.com" || parsed.hostname === "farcaster.xyz") return true;
    if (parsed.hostname === "firefly.social" && parsed.pathname.startsWith("/post/farcaster/")) return true;
    return false;
  } catch {
    return false;
  }
}

function isBlueskyUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "bsky.app" && parsed.pathname.includes("/post/");
  } catch {
    return false;
  }
}

// X/Twitter and its mirrors, which all use the same /<user>/status/<id> paths.
const X_HOSTS = new Set([
  "x.com",
  "twitter.com",
  "mobile.x.com",
  "mobile.twitter.com",
  "xcancel.com",
  "vxtwitter.com",
  "fxtwitter.com",
  "fixupx.com",
  "fixvx.com",
]);

export function isXUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (X_HOSTS.has(host) || host.startsWith("nitter.")) return true;
    if (parsed.hostname === "firefly.social" && parsed.pathname.startsWith("/post/x/")) return true;
    return false;
  } catch {
    return false;
  }
}

async function extractXArticle(url) {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  // The ID follows "status" (links can end in /photo/1); firefly ends in it.
  const status = parts.findIndex((p) => p === "status" || p === "statuses");
  const tweetId = status >= 0 ? parts[status + 1] : parts[parts.length - 1];
  if (!tweetId || !/^\d+$/.test(tweetId)) {
    throw new Error("Could not extract tweet ID from URL");
  }

  const apiUrl = `https://api.fxtwitter.com/status/${tweetId}`;
  const res = await fetch(apiUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`fxtwitter API returned ${res.status}`);
  const data = await res.json();
  const tweet = data?.tweet;
  if (!tweet) throw new Error("No tweet data from fxtwitter");

  // X article — extract from Draft.js content blocks
  if (tweet.article) {
    const blocks = tweet.article.content?.blocks || [];
    const plainText = blocks
      .map(b => b.text?.trim())
      .filter(Boolean)
      .join("\n\n");

    if (!plainText) {
      throw new Error("X article has no text content");
    }

    const elements = blocks
      .filter(b => b.text?.trim())
      .map(b => ({ type: "text", content: b.text.trim() }));
    const wrappedHtml = wrapParagraphs(elements);
    const title = tweet.article.title || tweet.text || "X Article";
    return { title, plainText, wrappedHtml };
  }

  // Regular tweet — use tweet text. No minimum length: the tweet IS the content.
  const plainText = tweet.text?.trim() || "";
  if (!plainText) {
    throw new Error("Tweet has no text content");
  }
  const elements = [{ type: "text", content: plainText }];
  const wrappedHtml = wrapParagraphs(elements);
  const handle = tweet.author?.screen_name ? `@${tweet.author.screen_name}` : "X";
  return { title: `${handle} on X`, plainText, wrappedHtml };
}

async function extractFarcasterArticle(url) {
  const parsed = new URL(url);
  let cast;
  if (parsed.hostname === "firefly.social" && parsed.pathname.startsWith("/post/farcaster/")) {
    const hash = parsed.pathname.split("/").filter(Boolean)[2];
    cast = hash ? await extractWarpcastContent(hash, "hash") : null;
  } else {
    cast = await extractWarpcastContent(url, "url");
  }
  if (!cast || !cast.text) {
    throw new Error("Could not fetch Farcaster post");
  }

  const plainText = cast.text.trim();
  if (!plainText) {
    throw new Error("Farcaster post has no text content");
  }

  const paragraphs = plainText.split(/\n\n+|\n/).filter(p => p.trim());
  const elements = paragraphs.map(p => ({ type: "text", content: p }));
  const wrappedHtml = wrapParagraphs(elements);
  const title = `${cast.author.displayName || cast.author.username} on Farcaster`;

  return { title, plainText, wrappedHtml };
}

async function extractBlueskyPost(url) {
  const post = await extractBlueskyContent(url);
  if (!post || !post.text) {
    throw new Error("Could not fetch Bluesky post");
  }

  const plainText = post.text.trim();
  if (!plainText) {
    throw new Error("Bluesky post has no text content");
  }

  const paragraphs = plainText.split(/\n\n+|\n/).filter(p => p.trim());
  const elements = paragraphs.map(p => ({ type: "text", content: p }));
  const wrappedHtml = wrapParagraphs(elements);
  const title = `${post.author.displayName || post.author.handle} on Bluesky`;

  return { title, plainText, wrappedHtml };
}

// Story hrefs are user input and /stories/context returns the extracted
// text, so every page fetch goes through the SSRF guard (see safefetch.mjs).
let pageFetch = safeFetch;
export function setPageFetchForTests(fn) {
  pageFetch = fn || safeFetch;
}

function fetchWithTimeout(url, headers = BROWSER_HEADERS, timeout = FETCH_TIMEOUT) {
  return pageFetch(url, {
    headers,
    signal: AbortSignal.timeout(timeout),
  });
}

// Reads at most maxBytes of a response. Larger HTML pages are cut off (the
// article is usually near the top), other bodies throw.
async function readLimited(res, { maxBytes = MAX_PAGE_BYTES, truncate = false } = {}) {
  if (!res.body) return "";
  const chunks = [];
  let size = 0;
  // Works for node-fetch (Node stream) and WHATWG bodies; leaving the loop
  // early destroys/cancels the stream.
  for await (const chunk of res.body) {
    const value = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    size += value.byteLength;
    if (size > maxBytes) {
      if (!truncate) throw new Error(`Response larger than ${maxBytes} bytes`);
      chunks.push(value.subarray(0, value.byteLength - (size - maxBytes)));
      break;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

// Remote HTML is only parsed in articleWorker.mjs, where it can be terminated
// on timeout: JSDOM and Readability take seconds to minutes on a few KB of
// unclosed tags, and the main thread shares its event loop with p2p sync.
const WORKER = "lib/listen/articleWorker.mjs";
const PARSE_TIMEOUT = 10_000;
let parseTimeout = PARSE_TIMEOUT;
export function setParseTimeoutForTests(ms) {
  parseTimeout = ms || PARSE_TIMEOUT;
}

async function parse(kind, html, data) {
  const { result } = await parseInWorker(WORKER, html, parseTimeout, { kind, ...data });
  return result;
}

async function fetchPage(url) {
  const res = await fetchWithTimeout(url);
  if (!res.ok) return null;
  return readLimited(res, { truncate: true });
}

async function fetchJson(url) {
  const headers = { "User-Agent": BROWSER_HEADERS["User-Agent"], "Accept": "application/json" };
  const res = await fetchWithTimeout(url, headers, 10_000);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return JSON.parse(await readLimited(res));
}

// Discourse forums (ethresear.ch, ethereum-magicians.org, gov.optimism.io …)
// render topics with JavaScript, but every topic URL has a JSON twin.
export function discourseJsonUrl(url) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/t\/([^/]+)\/(\d+)(?:\/\d+)?\/?$/);
    return match ? `${parsed.origin}/t/${match[1]}/${match[2]}.json` : null;
  } catch {
    return null;
  }
}

async function extractDiscourseTopic(url) {
  const jsonUrl = discourseJsonUrl(url);
  if (!jsonUrl) return null;
  try {
    const topic = await fetchJson(jsonUrl);
    return await parse("discourse", null, { topic, url });
  } catch {
    return null;
  }
}

export function youTubeVideoId(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^(www|m|music)\./, "");
    let id = null;
    if (host === "youtu.be") {
      id = parsed.pathname.split("/")[1];
    } else if (host === "youtube.com") {
      if (parsed.pathname === "/watch") id = parsed.searchParams.get("v");
      else id = parsed.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/)?.[1];
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

// Reads `name = {...};` from a page's inline scripts as JSON.
function scriptJson(html, name) {
  const match = new RegExp(`${name}"?\\]?\\s*=\\s*\\{`).exec(html);
  if (!match) return null;
  const start = match.index + match[0].length - 1;
  let depth = 0;
  let inString = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
    } else if (c === "{") {
      depth++;
    } else if (c === "}" && --depth === 0) {
      try {
        return JSON.parse(html.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

// Title, channel and description of a watch page. The player response has
// them unless YouTube asks to sign in (as it does for datacenter IPs); the
// watch-next data still has them then.
export function parseYouTubePage(html) {
  const details = scriptJson(html, "ytInitialPlayerResponse")?.videoDetails;
  const contents =
    scriptJson(html, "ytInitialData")?.contents?.twoColumnWatchNextResults?.results?.results?.contents || [];
  const primary = contents.find((c) => c.videoPrimaryInfoRenderer)?.videoPrimaryInfoRenderer;
  const secondary = contents.find((c) => c.videoSecondaryInfoRenderer)?.videoSecondaryInfoRenderer;
  const runs = (value) => value?.simpleText || value?.runs?.map((r) => r.text).join("") || "";
  return {
    title: details?.title || runs(primary?.title),
    channel: details?.author || runs(secondary?.owner?.videoOwnerRenderer?.title),
    description: details?.shortDescription || secondary?.attributedDescription?.content || "",
  };
}

export function youTubeArticle({ title, channel, description }) {
  // Link lines ("Spotify: https://…", sponsors, socials) carry nothing to
  // summarize.
  const lines = (description || "")
    .split("\n")
    .filter((line) => !/https?:\/\//.test(line) || line.replace(/https?:\/\/\S+/g, "").trim().split(/\s+/).length > 3);
  const paragraphs = lines.join("\n").split(/\n\s*\n/).map((p) => p.trim());
  return fromParagraphs(title, [title, channel ? `Video by ${channel} on YouTube` : "", ...paragraphs]);
}

async function extractYouTubeVideo(id) {
  const watchUrl = `https://www.youtube.com/watch?v=${id}`;
  let video = { title: "", channel: "", description: "" };
  try {
    const body = await fetchPage(watchUrl);
    if (body) video = parseYouTubePage(body);
  } catch {}
  if (!video.title || !video.channel) {
    try {
      const oembed = await fetchJson(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`);
      video.title ||= oembed.title || "";
      video.channel ||= oembed.author_name || "";
    } catch {}
  }
  if (!video.title) throw new Error("Could not fetch YouTube video details");
  return youTubeArticle(video);
}

// arxiv.org/pdf/<id> links get the abstract page instead of the PDF.
export function arxivAbsUrl(url) {
  try {
    const parsed = new URL(url);
    if (!/^(www\.|export\.)?arxiv\.org$/.test(parsed.hostname)) return null;
    const id = parsed.pathname.match(/^\/(?:abs|pdf)\/(.+?)(?:\.pdf)?\/?$/)?.[1];
    return id ? `https://arxiv.org/abs/${id}` : null;
  } catch {
    return null;
  }
}

async function extractArxiv(url) {
  const absUrl = arxivAbsUrl(url);
  if (!absUrl) return null;
  try {
    const body = await fetchPage(absUrl);
    return body ? await parse("arxiv", body) : null;
  } catch {
    return null;
  }
}

export async function extractArticle(url) {
  if (isFarcasterUrl(url)) {
    return extractFarcasterArticle(url);
  }

  if (isXUrl(url)) {
    return extractXArticle(url);
  }

  if (isBlueskyUrl(url)) {
    return extractBlueskyPost(url);
  }

  const videoId = youTubeVideoId(url);
  if (videoId) {
    return extractYouTubeVideo(videoId);
  }

  const special = (await extractArxiv(url)) || (await extractDiscourseTopic(url));
  if (special) return special;

  const res = await fetchWithTimeout(url);

  if (!res.ok) {
    if (res.status === 403) throw new Error("Access denied - site blocks automated requests");
    if (res.status === 401) throw new Error("Article requires login");
    throw new Error(`Failed to fetch: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
    if (contentType.includes("image/")) throw new Error("URL points to an image, not an article");
    if (contentType.includes("application/pdf")) throw new Error("PDF files are not supported");
    if (contentType.includes("video/") || contentType.includes("audio/")) throw new Error("Media files are not supported");
  }

  const html = await readLimited(res, { truncate: true });
  return parse("article", html, { url });
}

export async function extractArticleCached(url) {
  const cached = extractionCache.get(url);
  if (cached) {
    if (cached.failed) return null;
    return cached;
  }

  const result = await extractArticle(url);
  extractionCache.set(url, { ...result, extractedAt: Date.now() });
  return result;
}
