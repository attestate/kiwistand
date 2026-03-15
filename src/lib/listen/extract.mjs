//@format
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { LRUCache } from "lru-cache";
import { extractWarpcastContent } from "../../parser.mjs";

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
    return parsed.hostname === "warpcast.com" || parsed.hostname === "farcaster.xyz";
  } catch {
    return false;
  }
}

async function extractFarcasterArticle(url) {
  const cast = await extractWarpcastContent(url, "url");
  if (!cast || !cast.text) {
    throw new Error("Could not fetch Farcaster post");
  }

  const plainText = cast.text.trim();

  if (plainText.length < MIN_ARTICLE_LENGTH) {
    throw new Error(
      `Farcaster post too short (${plainText.length} chars, need ${MIN_ARTICLE_LENGTH}).`
    );
  }

  const paragraphs = plainText.split(/\n\n+|\n/).filter(p => p.trim());
  const elements = paragraphs.map(p => ({ type: "text", content: p }));
  const wrappedHtml = wrapParagraphs(elements);
  const title = `${cast.author.displayName || cast.author.username} on Farcaster`;

  return { title, plainText, wrappedHtml };
}

export async function extractArticle(url) {
  if (isFarcasterUrl(url)) {
    return extractFarcasterArticle(url);
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
