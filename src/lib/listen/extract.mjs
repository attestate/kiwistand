//@format
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { LRUCache } from "lru-cache";
import { extractWarpcastContent, extractBlueskyContent } from "../../parser.mjs";

// Minimum characters for a valid article (filters out landing pages)
const MIN_ARTICLE_LENGTH = 500;

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

function isXUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "x.com" || parsed.hostname === "twitter.com") return true;
    if (parsed.hostname === "firefly.social" && parsed.pathname.startsWith("/post/x/")) return true;
    return false;
  } catch {
    return false;
  }
}

async function extractXArticle(url) {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  const tweetId = parts[parts.length - 1];
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

  const res = await fetch(url, {
    headers: {
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
    },
    redirect: "follow",
  });

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

  const html = await res.text();
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  const ogType = doc.querySelector('meta[property="og:type"]')?.getAttribute("content");
  const isArticleType = !ogType || ogType === "article" || ogType.startsWith("article");

  const reader = new Readability(doc.cloneNode(true));
  const article = reader.parse();
  if (!article) {
    const pageText = doc.body?.textContent?.toLowerCase() || "";
    if (pageText.includes("captcha") || pageText.includes("robot")) {
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

  const elements = extractParagraphs(article.content, url);
  const textElements = elements.filter((e) => e.type === "text");
  const plainText = textElements.map((e) => e.content.trim()).join(" ");

  if (plainText.length < MIN_ARTICLE_LENGTH) {
    const hint = !isArticleType ? ` (og:type is "${ogType}")` : "";
    throw new Error(
      `Content too short (${plainText.length} chars, need ${MIN_ARTICLE_LENGTH})${hint}.`
    );
  }

  const wrappedHtml = wrapParagraphs(elements, url);

  return { title: article.title, plainText, wrappedHtml };
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
