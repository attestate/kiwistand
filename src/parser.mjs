import { env } from "process";
import path from "path";

import DOMPurify from "isomorphic-dompurify";
import ogs from "open-graph-scraper-lite";
import htm from "htm";
import vhtml from "vhtml";
import { parse as parser } from "node-html-parser";
import { fetchBuilder, FileSystemCache } from "node-fetch-cache";
import { useAgent } from "request-filtering-agent";

import cache from "./cache.mjs";
import log from "./logger.mjs";

const fetch = fetchBuilder.withCache(
  new FileSystemCache({
    cacheDirectory: path.resolve(env.CACHE_DIR),
    ttl: 86400000, // 24 hours
  }),
);

const html = htm.bind(vhtml);

const filtered = [
  "kiwistand.com",
  "kiwinews.xyz",
  "kiwinews.io",
  "instagram.com",
];

async function extractCanonicalLink(html) {
  const dom = parser(html);
  const node = dom.querySelector('link[rel="canonical"]');
  if (!node) return;

  let response;
  try {
    const signal = AbortSignal.timeout(5000);
    response = await fetch(node._attrs.href, {
      agent: useAgent(node._attrs.href),
      headers: {
        "User-Agent": env.USER_AGENT,
      },
      signal,
    });
  } catch (err) {
    return;
  }

  if (response.status !== 200) {
    return;
  }

  return DOMPurify.sanitize(node.href);
}

const checkOgImage = async (url) => {
  const signal = AbortSignal.timeout(5000);
  try {
    const res = await fetch(url, {
      agent: useAgent(url),
      signal,
      method: "HEAD",
      headers: {
        "User-Agent": env.USER_AGENT,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
};

const getYTId = (url) => {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1);
    if (u.hostname === "youtube.com" || u.hostname === "www.youtube.com") {
      return u.searchParams.get("v");
    }
    return null;
  } catch {
    return null;
  }
};

export const metadata = async (url) => {
  let urlObj;
  try {
    urlObj = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }

  const { hostname } = urlObj;

  if (hostname === "twitter.com" || hostname === "x.com") {
    urlObj.hostname = "fxtwitter.com";
    url = urlObj.toString();
  }

  let result, html;
  if (cache.has(url)) {
    const fromCache = cache.get(url);
    result = fromCache.result;
    html = fromCache.html;
  } else {
    const signal = AbortSignal.timeout(5000);
    const response = await fetch(url, {
      headers: {
        "User-Agent": env.USER_AGENT,
      },
      agent: useAgent(url),
      signal,
    });

    html = await response.text();
    const parsed = await ogs({ html });
    result = parsed.result;

    if (result && html) {
      cache.set(url, { result, html });
    }
  }

  const domain = safeExtractDomain(url);
  if (filtered.includes(domain) || (result && !result.success)) {
    throw new Error("Link from excluded domain");
  }

  let image;
  if (result.ogImage && result.ogImage.length >= 1) {
    image = result.ogImage[0].url;
  }
  if (result.twitterImage && result.twitterImage.length >= 1) {
    image = result.twitterImage[0].url;
  }
  if (hostname === "youtu.be" || hostname.endsWith("youtube.com")) {
    const id = getYTId(url);
    if (id) {
      image = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
    }
  }

  const { ogTitle } = result;
  let { ogDescription } = result;

  let canonicalLink;
  // NOTE: Hey's and Rekt News's canonical link implementation is wrong and
  // always links back to the root
  if (domain !== "hey.xyz" || domain !== "rekt.news") {
    try {
      canonicalLink = await extractCanonicalLink(html);
    } catch (err) {
      log(`Failed to extract canonical link ${err.stack}`);
    }
  }

  // NOTE: For some domains, adding the title to the submit form is actually
  // counter productive as these pages' titles are just some filler text, but
  // not the title we want users to submit.
  const bannedTitleDomains = [
    "fxtwitter.com",
    "twitter.com",
    "x.com",
    "youtube.com",
    "youtu.be",
  ];
  let output = {};
  if (ogTitle && !bannedTitleDomains.includes(domain)) {
    output.ogTitle = DOMPurify.sanitize(ogTitle);
  }
  if (domain) {
    output.domain = DOMPurify.sanitize(domain);
  }
  if (image && image.startsWith("https://")) {
    const exists = await checkOgImage(image);
    if (exists) {
      output.image = DOMPurify.sanitize(image);
    }
  }
  if (ogDescription) {
    output.ogDescription = DOMPurify.sanitize(
      `${ogDescription.substring(0, 150)}...`,
    );
  }
  if (canonicalLink) {
    output.canonicalLink = DOMPurify.sanitize(canonicalLink);
  }

  if (Object.keys(output).length === 0) {
    throw new Error("Insufficient metadata");
  }

  return output;
};

function safeExtractDomain(link) {
  let parsedUrl;
  try {
    parsedUrl = new URL(link);
  } catch (err) {
    return "";
  }

  const parts = parsedUrl.hostname.split(".");
  const tld = parts.slice(-2).join(".");
  return tld;
}
const empty = html``;
// NOTE: All inputs into render from metadata are XSS-sanitized by the metadata
// function.
export const render = (ogTitle, domain, ogDescription, image) => html`
  <div
    onclick="navigator.clipboard.writeText('${ogTitle}')"
    style="cursor:pointer; display: flex; flex-direction: column; border: 1px solid #828282;
  border-radius: 2px; overflow: hidden;"
  >
    <div style="background-color: #e6e6df; padding: 1rem; color: #777;">
      <div style="font-size: 0.7rem; margin-bottom: 0.5rem;">${domain}</div>
      <div style="font-size: 0.9rem; color: #000; margin-bottom: 0.5rem;">
        ${ogTitle}
      </div>
      <div style="font-size: 0.7rem;">${ogDescription}</div>
    </div>
    ${image
      ? html`<div
          style="width: 100%; height: 0; padding-bottom: 50%; position: relative;"
        >
          <img
            src="${image}"
            style="width: 100%; height: 100%; position: absolute; object-fit:
 cover;"
          />
        </div>`
      : null}
  </div>
`;

export const parse = async (url) => {
  let data;
  try {
    data = await metadata(url);
  } catch (err) {
    return empty;
  }
  const { ogTitle, domain, ogDescription, image } = data;
  return render(ogTitle, domain, ogDescription, image);
};
