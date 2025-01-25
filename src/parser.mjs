import { env } from "process";
import path from "path";

import DOMPurify from "isomorphic-dompurify";
import ogs from "open-graph-scraper-lite";
import htm from "htm";
import vhtml from "vhtml";
import { parse as parser } from "node-html-parser";
import { fetchBuilder, FileSystemCache } from "node-fetch-cache";
import { useAgent } from "request-filtering-agent";
import Anthropic from "@anthropic-ai/sdk";

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

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});
const twitterFrontends = [
  "xcancel.com",
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
];
const CLAUDE_DOMAINS = ["warpcast.com", "fxtwitter.com", ...twitterFrontends];

const GUIDELINES = `We have an opportunity to build our own corner of the onchain internet. With awesome people, links, resources, and learning.

Our content focuses on:
- Technical resources, hacking, and awesome git repos
- Dune dashboards, reports, data-driven articles
- Startups, cryptocurrencies, cryptography
- Networking, privacy, decentralization
- Hardware, open source, art, economics, game theory
- Anything else our community finds fascinating, from philosophy through science to infrastructure

Title Guidelines:
- Maximum 80 characters
- Use sentence case instead of title case
- Must be clear and descriptive
- No sensationalist journalism or clickbait
- No overly optimized headlines
- No cliffhanger headlines
- No fluff headlines
- No embellishing
- Must tell exactly what to expect
- If an article has a good original title, use that
- If the original title is too long, trim it while keeping the substance
- Avoid pay-walled article titles unless highly relevant
- For technical content, be specific about the technology/protocol involved
- For crypto content, mention relevant chains/protocols where appropriate
- Always make factual statements and say things like they are
- Be precise and direct. Be intentional Name names, name handles etc

`;

async function generateClaudeTitle(content) {
  let response;
  try {
    response = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 100,
      temperature: 0,
      tools: [
        {
          name: "generate_title",
          description:
            "Generate a title following the provided guidelines for our Web3/crypto hacker news platform.",
          input_schema: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description:
                  "The generated title that follows all provided guidelines",
              },
            },
            required: ["title"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "generate_title" },
      messages: [
        {
          role: "user",
          content: `Here are our submission guidelines:\n\n${GUIDELINES}\n\nBased on these guidelines, generate a title for this content:\n\n${content}`,
        },
      ],
    });
  } catch (error) {
    console.error("Claude API request failed:", error);
    return null;
  }

  try {
    const toolUse = response.content.find((c) => c.type === "tool_use");
    if (!toolUse?.input?.title) {
      console.error("No title found in Claude response");
      return null;
    }
    return toolUse.input.title;
  } catch (error) {
    console.error("Error extracting title from response:", error);
    return null;
  }
}

async function extractWarpcastContent(url) {
  try {
    const apiUrl = `https://api.neynar.com/v2/farcaster/cast?identifier=${url}&type=url`;

    const response = await fetch(apiUrl, {
      headers: {
        accept: "application/json",
        "X-Api-Key": "NEYNAR_API_DOCS",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    });

    const data = await response.json();
    return data?.cast?.text || null;
  } catch (error) {
    console.error("Neynar API error:", error);
    return null;
  }
}

function extractTwitterContent(html) {
  const tweetTextMatch = html.match(
    /data-testid="tweetText"[^>]*>(.*?)<\/div>/s,
  );
  if (tweetTextMatch) {
    return tweetTextMatch[1]
      .replace(/<[^>]*>/g, " ") // Remove HTML tags
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();
  }
  return null;
}

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

  if (twitterFrontends.includes(hostname)) {
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
    "reuters.com",
    "warpcast.com",
    ...twitterFrontends,
  ];
  let output = {};
  if (hostname === "warpcast.com") {
    const castContent = await extractWarpcastContent(url);
    if (castContent) {
      //const claudeTitle = await generateClaudeTitle(castContent);
      //if (claudeTitle) {
      //  output.ogTitle = claudeTitle;
      //}
    }
  } else if (bannedTitleDomains.includes(hostname)) {
    //const claudeTitle = await generateClaudeTitle(ogDescription);
    //if (claudeTitle) {
    //  output.ogTitle = claudeTitle;
    //}
  } else if (ogTitle) {
    output.ogTitle = ogTitle;
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
