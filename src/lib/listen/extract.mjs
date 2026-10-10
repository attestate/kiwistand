//@format
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { LRUCache } from "lru-cache";
import { extractWarpcastContent, extractBlueskyContent } from "../../parser.mjs";

// Minimum characters for a valid article (filters out landing pages)
const MIN_ARTICLE_LENGTH = 500;

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

function fetchWithTimeout(url, headers = BROWSER_HEADERS, timeout = FETCH_TIMEOUT) {
  return fetch(url, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(timeout),
  });
}

// Reads at most maxBytes of a response. Larger HTML pages are cut off (the
// article is usually near the top), other bodies throw.
async function readLimited(res, { maxBytes = MAX_PAGE_BYTES, truncate = false } = {}) {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      if (!truncate) throw new Error(`Response larger than ${maxBytes} bytes`);
      chunks.push(value.subarray(0, value.byteLength - (size - maxBytes)));
      break;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
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

function fromParagraphs(title, paragraphs) {
  const texts = paragraphs.map((p) => p.trim()).filter(Boolean);
  const elements = texts.map((content) => ({ type: "text", content }));
  return { title, plainText: texts.join("\n\n"), wrappedHtml: wrapParagraphs(elements) };
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

// Turns a Discourse topic's JSON into an article from its first post.
export function parseDiscourseTopic(topic, url) {
  const cooked = topic?.post_stream?.posts?.[0]?.cooked;
  if (typeof cooked !== "string" || !cooked.trim()) return null;
  const doc = new JSDOM(cooked).window.document;
  // Image size captions, emoji, polls and link previews of other sites.
  doc.querySelectorAll(".lightbox-wrapper .meta, img.emoji, aside.onebox, div.poll").forEach((n) => n.remove());
  const title = typeof topic.title === "string" ? topic.title : "";
  const elements = extractParagraphs(doc.body.innerHTML, url);
  // Many posts open with the title as a heading.
  const first = elements.findIndex((e) => e.type === "text");
  if (first >= 0 && elements[first].content === title) elements.splice(first, 1);
  const texts = elements.filter((e) => e.type === "text").map((e) => e.content);
  if (texts.length === 0) return null;
  return {
    title,
    plainText: [title, ...texts].filter(Boolean).join("\n\n"),
    wrappedHtml: wrapParagraphs(elements, url),
  };
}

async function extractDiscourseTopic(url) {
  const jsonUrl = discourseJsonUrl(url);
  if (!jsonUrl) return null;
  try {
    return parseDiscourseTopic(await fetchJson(jsonUrl), url);
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

export function parseArxivAbs(html) {
  const doc = new JSDOM(html).window.document;
  const text = (selector) => {
    const node = doc.querySelector(selector);
    if (!node) return "";
    node.querySelectorAll(".descriptor").forEach((n) => n.remove());
    node.querySelectorAll("br").forEach((n) => n.replaceWith("\n"));
    return node.textContent.trim();
  };
  const title = text("h1.title").replace(/\s+/g, " ");
  const abstract = text("blockquote.abstract");
  if (!title || !abstract) return null;
  const authors = text(".authors").replace(/\s+/g, " ");
  const paragraphs = abstract.split(/\n/).map((p) => p.replace(/\s+/g, " "));
  return fromParagraphs(title, [title, authors ? `Authors: ${authors}` : "", ...paragraphs]);
}

async function extractArxiv(url) {
  const absUrl = arxivAbsUrl(url);
  if (!absUrl) return null;
  try {
    const body = await fetchPage(absUrl);
    return body ? parseArxivAbs(body) : null;
  } catch {
    return null;
  }
}

// Bot challenge pages. Only visible text and known challenge markup count:
// many normal pages mention "captcha" in their scripts.
const CHALLENGE_MARKUP = [
  /<title>\s*(Just a moment\.\.\.|Attention Required! \| Cloudflare)/i,
  /cf_chl_opt|id="challenge-form"/,
  /class="(g-recaptcha|h-captcha)"/,
  /captcha-delivery\.com|px-captcha/,
];

export function requiresCaptcha(html, doc) {
  if (CHALLENGE_MARKUP.some((re) => re.test(html))) return true;
  const body = doc.body?.cloneNode(true);
  if (!body) return false;
  body.querySelectorAll("script, style, template").forEach((n) => n.remove());
  const text = body.textContent.toLowerCase();
  return /captcha|verify you are human|are you a robot|not a robot/.test(text);
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
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  const ogType = doc.querySelector('meta[property="og:type"]')?.getAttribute("content");
  const isArticleType = !ogType || ogType === "article" || ogType.startsWith("article");

  const reader = new Readability(doc.cloneNode(true));
  const article = reader.parse();
  if (!article) {
    const pageText = doc.body?.textContent?.toLowerCase() || "";
    if (requiresCaptcha(html, doc)) {
      throw new Error("Site requires CAPTCHA verification");
    }
    if (pageText.includes("subscribe") && pageText.includes("paywall")) {
      throw new Error("Article appears to be behind a paywall");
    }
    if (pageText.includes("enable javascript") || pageText.includes("javascript required")) {
      throw new Error("Site requires JavaScript to display content");
    }
    throw new Error("Could not extract article content");
  }

  const elements = stripBoilerplate(extractParagraphs(article.content, url), url);
  const textElements = elements.filter((e) => e.type === "text");
  const plainText = textElements.map((e) => e.content.trim()).join("\n\n");

  if (plainText.length < MIN_ARTICLE_LENGTH) {
    const hint = !isArticleType ? ` (og:type is "${ogType}")` : "";
    throw new Error(
      `Content too short (${plainText.length} chars, need ${MIN_ARTICLE_LENGTH})${hint}.`
    );
  }

  const wrappedHtml = wrapParagraphs(elements, url);

  return { title: article.title, plainText, wrappedHtml };
}

// Removes site chrome that Readability keeps at the end of articles. Each
// rule is narrow on purpose: when in doubt, the text stays.
export function stripBoilerplate(elements, url) {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {}

  let result = elements
    .map((e) =>
      e.type === "text" ? { ...e, content: e.content.replace(/Copy link to heading/g, "").trim() } : e,
    )
    .filter((e) => e.type !== "text" || e.content);

  // Substack: comments and "Ready for more?" follow this heading.
  const discussion = result.findIndex((e) => e.type === "text" && e.content === "Discussion about this post");
  if (discussion > 0) result = result.slice(0, discussion);

  const trailing = [
    host === "cointelegraph.com" && /^Cointelegraph is committed to independent, transparent journalism\./,
    host === "cointelegraph.com" && /^Magazine: /,
    // Pagination, "1 2 3 … 10" or its numbers one by one.
    host === "coindesk.com" && /^\d+( \d+)*$/,
    // "Daily Debrief Newsletter" and its pitch.
    host === "decrypt.co" && /^[\w ]{1,40} Newsletter$/,
    host === "decrypt.co" && /^(Start every day with|Get the latest|Your weekly|A weekly)\b.{0,160}$/,
  ].filter(Boolean);
  while (result.length > 1) {
    const last = result[result.length - 1];
    if (last.type !== "text" || !trailing.some((re) => re.test(last.content))) break;
    result.pop();
  }
  return result;
}

function extractParagraphs(htmlContent, baseUrl) {
  const dom = new JSDOM(htmlContent);
  const doc = dom.window.document;

  const blocks = new Set([
    "P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6",
    "LI", "BLOCKQUOTE", "PRE", "TR", "DT", "DD",
    "SECTION", "ARTICLE", "HEADER", "FOOTER", "FIGCAPTION",
  ]);

  const elements = [];
  let current = [];

  function flush() {
    const text = current.join("").replace(/\s+/g, " ").trim();
    if (text.length > 0) elements.push({ type: "text", content: text });
    current = [];
  }

  function resolveUrl(src) {
    if (!src || src.startsWith("data:")) return src;
    if (src.startsWith("http://") || src.startsWith("https://")) return src;
    try { return new URL(src, baseUrl).href; } catch { return src; }
  }

  function walk(node) {
    if (node.nodeType === 3) {
      current.push(node.textContent);
    } else if (node.nodeType === 1) {
      if (node.tagName === "BR") { current.push(" "); return; }
      if (node.tagName === "IMG") {
        flush();
        const src = node.getAttribute("src");
        const alt = node.getAttribute("alt") || "";
        if (src && !src.startsWith("data:")) {
          elements.push({ type: "image", src: resolveUrl(src), alt });
        }
        return;
      }
      if (blocks.has(node.tagName)) flush();
      for (const child of node.childNodes) walk(child);
      if (blocks.has(node.tagName)) flush();
    }
  }

  walk(doc.body);
  flush();
  return elements;
}

function wrapParagraphs(elements, baseUrl) {
  return elements
    .map((elem) => {
      if (elem.type === "image") {
        const caption = elem.alt ? `<figcaption style="font-size: 0.85em; color: var(--text-secondary); margin-top: 0.5em;">${escapeHtml(elem.alt)}</figcaption>` : "";
        return `<figure style="margin: 1em 0; text-align: center;"><img src="${escapeHtml(elem.src)}" alt="${escapeHtml(elem.alt)}" style="max-width: 100%; height: auto; border-radius: 4px;" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.style.display='none';" />${caption}</figure>`;
      }
      return `<p>${escapeHtml(elem.content)}</p>`;
    })
    .join("\n");
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getCachedExtraction(url) {
  return extractionCache.get(url) || null;
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
