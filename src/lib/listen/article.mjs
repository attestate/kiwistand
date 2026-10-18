//@format
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

// The pure HTML -> article half of extract.mjs. It runs in articleWorker.mjs,
// so it must not import parser.mjs or anything else that opens databases.

// Minimum characters for a valid article (filters out landing pages)
const MIN_ARTICLE_LENGTH = 500;

export function fromParagraphs(title, paragraphs) {
  const texts = paragraphs.map((p) => p.trim()).filter(Boolean);
  const elements = texts.map((content) => ({ type: "text", content }));
  return { title, plainText: texts.join("\n\n"), wrappedHtml: wrapParagraphs(elements) };
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

export function parseArticle(html, url) {
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

export function wrapParagraphs(elements, baseUrl) {
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
