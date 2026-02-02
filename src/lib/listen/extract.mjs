//@format
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { LRUCache } from "lru-cache";
import { extractWarpcastContent, extractTwitterContent, twitterFrontends } from "../../parser.mjs";

// Minimum characters for a valid article (filters out landing pages)
const MIN_ARTICLE_LENGTH = 500;

// LRU cache for pre-extracted articles with size limit to prevent memory leaks
const extractionCache = new LRUCache({
  max: 500, // Max 500 articles
  maxSize: 50 * 1024 * 1024, // 50MB max
  sizeCalculation: (value) => {
    // Estimate size: title + plainText + wrappedHtml
    return (value.title?.length || 0) +
           (value.plainText?.length || 0) +
           (value.wrappedHtml?.length || 0);
  },
  ttl: 1000 * 60 * 60 * 24, // 24 hour TTL
});
// URLs currently being extracted (prevent duplicate work)
const extractionInProgress = new Set();

// Check if URL is a Farcaster/Warpcast post
function isFarcasterUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "warpcast.com" || parsed.hostname === "farcaster.xyz";
  } catch {
    return false;
  }
}

// Check if URL is a Twitter/X post
function isTwitterUrl(url) {
  try {
    const parsed = new URL(url);
    return twitterFrontends.includes(parsed.hostname);
  } catch {
    return false;
  }
}

// Extract Farcaster post content via Neynar API
async function extractFarcasterArticle(url) {
  const cast = await extractWarpcastContent(url, "url");
  if (!cast || !cast.text) {
    throw new Error("Could not fetch Farcaster post");
  }

  const plainText = cast.text.trim();

  // Check minimum content length
  if (plainText.length < MIN_ARTICLE_LENGTH) {
    throw new Error(
      `Farcaster post too short (${plainText.length} chars, need ${MIN_ARTICLE_LENGTH}). Only long-form posts are supported.`
    );
  }

  // Split into paragraphs by double newlines or single newlines
  const paragraphs = plainText.split(/\n\n+|\n/).filter(p => p.trim());
  // Convert to element format expected by wrapParagraphs
  const elements = paragraphs.map(p => ({ type: "text", content: p }));
  const wrappedHtml = wrapParagraphs(elements);
  const title = `${cast.author.displayName || cast.author.username} on Farcaster`;

  return {
    title,
    plainText,
    wrappedHtml,
  };
}

// Extract Twitter/X post content via fxtwitter
async function extractTwitterArticle(url) {
  const content = await extractTwitterContent(url);
  if (!content || !content.text) {
    throw new Error("Could not fetch Twitter post");
  }

  const plainText = content.text.trim();

  // Check minimum content length
  if (plainText.length < MIN_ARTICLE_LENGTH) {
    throw new Error(
      `Twitter post too short (${plainText.length} chars, need ${MIN_ARTICLE_LENGTH}). Only long-form posts are supported.`
    );
  }

  // Split into paragraphs by double newlines or single newlines
  const paragraphs = plainText.split(/\n\n+|\n/).filter(p => p.trim());
  // Convert to element format expected by wrapParagraphs
  const elements = paragraphs.map(p => ({ type: "text", content: p }));
  const wrappedHtml = wrapParagraphs(elements);

  // Format title based on content type
  let platform = "X";
  if (content.type === "thread") {
    platform = "X Thread";
  } else if (content.type === "article") {
    platform = "X Article";
  }
  const title = `${content.author.displayName || content.author.username} on ${platform}`;

  return {
    title,
    plainText,
    wrappedHtml,
  };
}

export async function extractArticle(url) {
  // Handle Farcaster URLs via Neynar API
  if (isFarcasterUrl(url)) {
    return extractFarcasterArticle(url);
  }
  // Handle Twitter/X URLs via fxtwitter
  if (isTwitterUrl(url)) {
    return extractTwitterArticle(url);
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
    if (res.status === 403) {
      throw new Error("Access denied - site blocks automated requests");
    }
    if (res.status === 401) {
      throw new Error("Article requires login");
    }
    throw new Error(`Failed to fetch: ${res.status}`);
  }

  // Check Content-Type - reject non-HTML content
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
    if (contentType.includes("image/")) {
      throw new Error("URL points to an image, not an article");
    }
    if (contentType.includes("application/pdf")) {
      throw new Error("PDF files are not supported");
    }
    if (contentType.includes("video/") || contentType.includes("audio/")) {
      throw new Error("Media files are not supported");
    }
    // Allow through if content-type is missing or unclear
  }

  const html = await res.text();
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  // Check og:type meta tag - warn if it's not an article type
  const ogType = doc.querySelector('meta[property="og:type"]')?.getAttribute("content");
  const isArticleType = !ogType || ogType === "article" || ogType.startsWith("article");

  const reader = new Readability(doc.cloneNode(true));
  const article = reader.parse();
  if (!article) {
    // Try to detect why extraction failed
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
    throw new Error("Could not extract article content - site may require login or block automated access");
  }

  const elements = extractParagraphs(article.content, url);
  // Get only text elements for TTS
  const textElements = elements.filter((e) => e.type === "text");
  const plainText = textElements.map((e) => e.content.trim()).join(" ");

  // Check minimum content length - filters out landing pages and sparse content
  if (plainText.length < MIN_ARTICLE_LENGTH) {
    const hint = !isArticleType ? ` (og:type is "${ogType}")` : "";
    throw new Error(
      `Content too short (${plainText.length} chars, need ${MIN_ARTICLE_LENGTH})${hint}. This may be a landing page, not an article.`
    );
  }

  const wrappedHtml = wrapParagraphs(elements, url);

  return {
    title: article.title,
    plainText,
    wrappedHtml,
  };
}

function extractParagraphs(htmlContent, baseUrl) {
  const dom = new JSDOM(htmlContent);
  const doc = dom.window.document;

  const blocks = new Set([
    "P",
    "DIV",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "LI",
    "BLOCKQUOTE",
    "PRE",
    "TR",
    "DT",
    "DD",
    "SECTION",
    "ARTICLE",
    "HEADER",
    "FOOTER",
    "FIGCAPTION",
  ]);

  // Elements array: { type: "text", content: string } or { type: "image", src: string, alt: string }
  const elements = [];
  let current = [];

  function flush() {
    const text = current.join("").replace(/\s+/g, " ").trim();
    if (text.length > 0) {
      elements.push({ type: "text", content: text });
    }
    current = [];
  }

  // Resolve relative URLs to absolute
  function resolveUrl(src) {
    if (!src || src.startsWith("data:")) return src;
    if (src.startsWith("http://") || src.startsWith("https://")) return src;
    try {
      return new URL(src, baseUrl).href;
    } catch {
      return src;
    }
  }

  function walk(node) {
    if (node.nodeType === 3) {
      current.push(node.textContent);
    } else if (node.nodeType === 1) {
      if (node.tagName === "BR") {
        current.push(" ");
        return;
      }
      // Capture images
      if (node.tagName === "IMG") {
        flush();
        const src = node.getAttribute("src");
        const alt = node.getAttribute("alt") || "";
        if (src && !src.startsWith("data:")) {
          elements.push({ type: "image", src: resolveUrl(src), alt });
        }
        return;
      }
      if (blocks.has(node.tagName)) {
        flush();
      }
      for (const child of node.childNodes) {
        walk(child);
      }
      if (blocks.has(node.tagName)) {
        flush();
      }
    }
  }

  walk(doc.body);
  flush();

  return elements;
}

function wrapParagraphs(elements, baseUrl) {
  let sentenceIndex = 0;
  let wordIndex = 0;

  return elements
    .map((elem) => {
      // Handle images
      if (elem.type === "image") {
        const caption = elem.alt ? `<figcaption style="font-size: 0.85em; color: var(--text-secondary); margin-top: 0.5em;">${escapeHtml(elem.alt)}</figcaption>` : "";
        // Use referrerpolicy="no-referrer" to avoid CORS issues on some CDNs
        return `<figure style="margin: 1em 0; text-align: center;"><img src="${escapeHtml(elem.src)}" alt="${escapeHtml(elem.alt)}" style="max-width: 100%; height: auto; border-radius: 4px;" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.style.display='none';this.parentElement.innerHTML='<div style=\\'padding: 2em; background: var(--background-color1, #f5f5f5); border-radius: 4px; color: var(--text-secondary, #666); font-style: italic;\\'>Image could not be loaded</div>';" />${caption}</figure>`;
      }

      // Handle text paragraphs
      const para = elem.content;
      // Split paragraph into sentences, but NOT on:
      // - Decimal numbers (2.5, $100.50)
      // - Common abbreviations (Mr., Dr., e.g., i.e., etc.)
      // - Single letters followed by period (A. B. C.)
      const sentences = splitIntoSentences(para);

      const wrappedSentences = sentences
        .map((sentence) => {
          const trimmed = sentence.trim();
          if (!trimmed) return "";

          const wordCount = trimmed.split(/\s+/).length;
          const span = `<span class="s" data-s="${sentenceIndex}" data-start-word="${wordIndex}">${escapeHtml(trimmed)}</span>`;
          sentenceIndex++;
          wordIndex += wordCount;
          return span;
        })
        .filter(Boolean)
        .join(" ");

      return `<p>${wrappedSentences}</p>`;
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

// Split text into sentences, avoiding false splits on:
// - Decimal numbers (2.5, $100.50)
// - Common abbreviations (Mr., Dr., e.g., i.e., etc., vs., ca., approx.)
// - Single letters (A. B. C.)
// - URLs and email addresses
function splitIntoSentences(text) {
  if (!text) return [text];

  // Placeholder markers for things we don't want to split on
  const placeholders = [];
  let processed = text;

  // Protect decimal numbers (including currency like $2.5M, 100.5%, 2.5x)
  processed = processed.replace(/(\d+)\.(\d+)/g, (match) => {
    placeholders.push(match);
    return `\x00${placeholders.length - 1}\x00`;
  });

  // Protect common abbreviations (case-insensitive matching, preserve original case)
  const abbreviations = /\b(Mr|Mrs|Ms|Dr|Prof|Jr|Sr|Inc|Ltd|Corp|vs|etc|e\.g|i\.e|ca|approx|fig|vol|no|pp|p|St|Ave|Blvd|Rd)\./gi;
  processed = processed.replace(abbreviations, (match) => {
    placeholders.push(match);
    return `\x00${placeholders.length - 1}\x00`;
  });

  // Protect single letter abbreviations (A. B. C., common in lists)
  processed = processed.replace(/\b([A-Z])\./g, (match) => {
    placeholders.push(match);
    return `\x00${placeholders.length - 1}\x00`;
  });

  // Now split on sentence-ending punctuation followed by space or end
  const sentences = processed.match(/[^.!?]+[.!?]+[\s]?|[^.!?]+$/g) || [processed];

  // Restore placeholders in each sentence
  return sentences.map(sentence => {
    return sentence.replace(/\x00(\d+)\x00/g, (_, idx) => placeholders[parseInt(idx, 10)]);
  }).filter(s => s.trim());
}

// Get cached extraction if available
export function getCachedExtraction(url) {
  return extractionCache.get(url) || null;
}

// Check if URL is listenable (not images, PDFs, etc.)
export function isListenableUrl(url) {
  if (!url) return false;
  // Skip data: and kiwi: URLs
  if (url.startsWith("data:") || url.startsWith("kiwi:")) return false;

  const lowerUrl = url.toLowerCase();
  // Skip common non-article extensions
  const skipExtensions = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".mp3", ".mp4", ".mov", ".avi"];
  for (const ext of skipExtensions) {
    if (lowerUrl.endsWith(ext)) return false;
  }
  return true;
}

// Eager extract article in background (non-blocking)
export function eagerExtractArticle(url) {
  if (!url || !isListenableUrl(url)) return;

  // Already cached or in progress
  if (extractionCache.has(url) || extractionInProgress.has(url)) return;

  extractionInProgress.add(url);

  // Extract in background
  extractArticle(url)
    .then((result) => {
      extractionCache.set(url, {
        ...result,
        extractedAt: Date.now(),
      });
      console.log(`[listen] Eager extracted: ${url.slice(0, 60)}...`);
    })
    .catch((err) => {
      // Don't log errors for expected failures (paywalls, etc.)
      if (!err.message.includes("too short") && !err.message.includes("paywall")) {
        console.log(`[listen] Eager extract failed for ${url.slice(0, 40)}: ${err.message}`);
      }
    })
    .finally(() => {
      extractionInProgress.delete(url);
    });
}

// Extract with cache check
export async function extractArticleCached(url) {
  const cached = extractionCache.get(url);
  if (cached) {
    console.log(`[listen] Cache hit for extraction: ${url.slice(0, 60)}...`);
    return cached;
  }

  const result = await extractArticle(url);
  extractionCache.set(url, {
    ...result,
    extractedAt: Date.now(),
  });
  return result;
}
