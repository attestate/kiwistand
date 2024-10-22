import { env } from "process";
import path from "path";

import DOMPurify from "isomorphic-dompurify";
import ogs from "open-graph-scraper-lite";
import htm from "htm";
import vhtml from "vhtml";
import { JSDOM } from "jsdom";
import { fetchBuilder, FileSystemCache } from "node-fetch-cache";
import { useAgent } from "request-filtering-agent";

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
  "warpcast.com",
  "twitter.com",
  "x.com",
];

async function extractCanonicalLink(html) {
  const dom = new JSDOM(html);
  const node = dom.window.document.querySelector('link[rel="canonical"]');
  if (!node) return;

  let response;
  try {
    response = await fetch(node.href, {
      agent: useAgent(node.href),
    });
  } catch (err) {
    return;
  }

  if (response.status !== 200) {
    return;
  }

  return DOMPurify.sanitize(node.href);
}

export const metadata = async (url) => {
  const response = await fetch(url, {
    agent: useAgent(url),
  });

  const html = await response.text();
  const parsed = await ogs({ html });
  const result = parsed.result;

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
  const { ogTitle } = result;
  let { ogDescription } = result;

  let canonicalLink;
  // NOTE: Hey's and Rekt News's canonical link implementation is wrong and
  // always links back to the root
  if (domain !== "hey.xyz" || domain !== "rekt.news") {
    canonicalLink = await extractCanonicalLink(html);
  }

  let output = {};
  if (ogTitle) {
    output.ogTitle = DOMPurify.sanitize(ogTitle);
  }
  if (domain) {
    output.domain = DOMPurify.sanitize(domain);
  }
  if (image && image.startsWith("https://")) {
    output.image = DOMPurify.sanitize(image);
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
