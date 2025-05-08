import { env } from "process";
import path from "path";
import normalizeUrl from "normalize-url";

import DOMPurify from "isomorphic-dompurify";
import ogs from "open-graph-scraper-lite";
import htm from "htm";
import vhtml from "vhtml";
import { parse as parser } from "node-html-parser";
import { fetchBuilder, FileSystemCache } from "node-fetch-cache";
import { useAgent } from "request-filtering-agent";
import Anthropic from "@anthropic-ai/sdk";

import { fetchCache as fetchCacheFactory } from "./utils.mjs";

import cache, { lifetimeCache } from "./cache.mjs";
import log from "./logger.mjs";

const fetchCache = new FileSystemCache({
  cacheDirectory: path.resolve(env.CACHE_DIR),
  ttl: 86400000, // 24 hours
});

const fetch = fetchBuilder.withCache(fetchCache);
const fetchStaleWhileRevalidate = fetchCacheFactory(fetch, fetchCache);

export async function getPageSpeedScore(url) {
  const apiUrl = `https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
    url,
  )}&strategy=MOBILE`;

  try {
    const response = await fetchStaleWhileRevalidate(apiUrl);
    const data = await response.json();
    const score = data?.lighthouseResult?.categories?.performance?.score || 0;
    return Math.round(score * 100);
  } catch (err) {
    return 30;
  }
}

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
// Added fxtwitter.com here so Claude title‐gen runs on fxtwitter links too
const twitterFrontends = [
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
const CLAUDE_DOMAINS = ["warpcast.com", "fxtwitter.com", ...twitterFrontends];

const TITLE_COMPLIANCE = `
Format this title according to these rules:
 1. Use sentence case (capitalize first word only)
 2. Remove any emojis
 3. Maximum 80 characters
 4. No trailing period
 5. Keep any existing dash (-) or colon (:) formatting
 6. Format dates as YYYY-MM-DD
`;

// Added Kiwi News Submission Guidelines
const KIWI_NEWS_GUIDELINES = `
Why guidelines are important
We have an opportunity to build our own corner of the onchain internet. With awesome people, links, resources, and learning. To ensure this corner is valuable, we need to follow some submission guidelines.

What to submit?
On topic:
Anything that gratifies the intellectual curiosities of builders, engineers, hackers, and craftspeople in the community.

That includes:

Technical resources, hacking, and awesome git repos
Dune dashboards, reports, data-driven articles
Startups, cryptocurrencies, cryptography
Networking, privacy, decentralization
Hardware, open source, art, economics, game theory
Anything else our community might find fascinating, covering any subject from philosophy, literature, and pop culture, through science, and health, up to society and infrastructure
Off topic:
Sensationalist journalism for the sake of ad revenue (including overly optimized click-bait, rage-bait, fluff headlines, clickthrough optimized headlines, cliffhanger headlines, posts with no substance)
Mediocre resources
Old stories we all read and that have been widely shared elsewhere
Shilling (you know what this means)
Fund raise announcements of projects which are not closely associated with Ethereum

How to submit?
A good headline tells you exactly what to expect without embellishing or optimizing for clickthrough. Some recommendations:

No emojis in titles
Attempt to submit the original title
Trim the title if it's too long without losing substance
Avoid Title Casing Because It Looks Like Spam (and it's terrible to read)
Avoid Upworthy and Buzzfeed style titles along the lines of, "Fiat Crisis with Balaji (shocking!)" - there's no need to add the last part
Consider NOT submitting pay-walled articles
Don't end a title with a period or dot
When introducing a new project or concept, you can use either:
A dash (-): "ETHStrategy - fully onchain Microstrategy for Ethereum"
A colon (:): "Farcaster 2026: The Game-Changing Potential of AI Agents"
Don't include the hosting platform in titles (e.g., "GitHub - bitcoin/bitcoin") as we already show the domain
Open Graph Images
Open Graph images are a crucial part of the submission. They're not an afterthought - they're often the first thing users see.

Images should be visually appealing and professionally designed
Low-quality, poorly designed, or hastily created images will be moderated
The image should meaningfully represent the content
Submitter Requirements
To maintain quality and accountability in our community, we have specific requirements for story submissions:

Stories will be removed from the front page if the submitter hasn't connected at least one of:
Farcaster account
ENS name
Lens profile
Submissions from accounts showing only a truncated address (e.g., 0xA9D2...1A87) will not appear on the front page
Connect your social accounts to ensure your submissions remain visible to the community.
`;

const GUIDELINES = `We have an opportunity to build our own corner of the onchain internet. With awesome people, links, resources, and learning.

Our content focuses on:
- Technical resources, hacking, and awesome git repos
- Dune dashboards, reports, data-driven articles
- Startups, cryptocurrencies, cryptography
- Networking, privacy, decentralization
- Hardware, open source, art, economics, game theory
- Anything else our community finds fascinating, from philosophy through science to infrastructure

Title Guidelines:
- Maximum 80 characters, not one character more as this will block submission!!!
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
- Make it: "@handle: {what person said on Farcaster or X}"

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

async function fixTitle(title) {
  const prompt = `Here are our submission guidelines:\n\n${TITLE_COMPLIANCE}\n\nModify the following title minimally so that it fully complies with these guidelines. Keep all information in the title. Only modify syntactically. Return only a JSON object with a "title" property containing the modified title.\nTitle: "${title}"`;
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
          content: prompt,
        },
      ],
    });
  } catch (error) {
    console.error("fixTitle API request failed:", error);
    return null;
  }
  try {
    let toolUse = response.content.find((c) => c.type === "tool_use");
    if (toolUse && toolUse.input && toolUse.input.title) {
      return toolUse.input.title;
    } else if (response.completion && response.completion.trim().length > 0) {
      console.warn(
        "No tool_use block found, falling back to response.completion",
      );
      return response.completion.trim();
    } else {
      console.error("No title found in fixTitle response");
      return null;
    }
  } catch (error) {
    console.error("Error extracting title in fixTitle:", error);
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
    if (!data?.cast) return null;
    return {
      text: data.cast.text,
      author: data.cast.author.username,
    };
  } catch (error) {
    console.error("Neynar API error:", error);
    return null;
  }
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

export const cachedMetadata = (
  url,
  generateTitle = false,
  submittedTitle = undefined,
) => {
  // Normalize the URL for consistent cache keys
  const normalizedUrl = normalizeUrl(url, { stripWWW: false });

  // Check if we have the data in cache
  if (cache.has(normalizedUrl)) {
    // Return cached data without fetching again
    return cache.get(normalizedUrl);
  }

  // If not in cache, return empty object and trigger background fetch
  metadata(url, generateTitle, submittedTitle)
    .then((freshData) => {
      if (freshData) {
        cache.set(normalizedUrl, freshData);
        log(`Stored metadata in cache for ${normalizedUrl}`);
      }
    })
    .catch((err) => {
      log(`Metadata fetch failed for ${url}: ${err}`);
    });

  // Return empty object immediately since we have nothing cached
  return {};
};

export const metadata = async (
  url,
  generateTitle = false,
  submittedTitle = undefined,
) => {
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
    "www.youtube.com",
    "youtu.be",
    "reuters.com",
    "www.reuters.com",
    "warpcast.com",
    "medium.com",
    ...twitterFrontends,
  ];
  let output = {};
  if (generateTitle) {
    if (hostname === "warpcast.com") {
      const cast = await extractWarpcastContent(url);
      if (cast) {
        const castContent = `Cast by ${cast.author}: ${cast.text}`;
        const claudeTitle = await generateClaudeTitle(castContent);
        if (claudeTitle) {
          output.ogTitle = claudeTitle;
        }
      }
    } else if (
      twitterFrontends.includes(hostname) &&
      !ogDescription?.includes("x.com/i/article/")
    ) {
      const tweetAuthor = result.ogTitle || result.twitterCreator;
      const tweetContent = `Tweet by ${tweetAuthor}: ${ogDescription}`;
      const claudeTitle = await generateClaudeTitle(tweetContent);
      if (claudeTitle) {
        output.ogTitle = claudeTitle;
      }
    }
  }

  if (!output.ogTitle && ogTitle && !bannedTitleDomains.includes(hostname)) {
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
    // Store the original, potentially longer description in the output object
    output.ogDescription = DOMPurify.sanitize(ogDescription);
  }
  if (canonicalLink) {
    output.canonicalLink = DOMPurify.sanitize(canonicalLink);
  }

  if (Object.keys(output).length === 0) {
    throw new Error("Insufficient metadata");
  }

  const pagespeed = await getPageSpeedScore(url);
  output.pagespeed = pagespeed;

  if (submittedTitle) {
    const normalized = normalizeUrl(url, { stripWWW: false });
    const cacheKey = `compliantTitle-${normalized}`;
    if (lifetimeCache.has(cacheKey)) {
      output.compliantTitle = lifetimeCache.get(cacheKey);
    } else {
      fixTitle(submittedTitle)
        .then((compliant) => {
          if (compliant) {
            lifetimeCache.set(cacheKey, compliant);
          }
        })
        .catch((err) => log(`fixTitle background error: ${err}`));
    }
  }

  return output;
};

/**
 * Checks if a link is relevant to Kiwi News using Claude Haiku.
 * @param {string} link - The URL to check.
 * @param {object} [metadataContext] - Optional metadata context.
 * @param {string} [metadataContext.title] - Title from OG, Telegram, etc.
 * @param {string} [metadataContext.description] - Description from OG, Telegram, etc.
 * @returns {Promise<boolean>} - True if the link is deemed relevant.
 */
export async function isRelevantToKiwiNews(link, metadataContext = {}) {
  // Changed parameter name
  const normalizedUrl = normalizeUrl(link, { stripWWW: false });
  const cacheKey = `relevance-${normalizedUrl}`;

  // Check cache first
  const cachedRelevance = lifetimeCache.get(cacheKey);
  if (cachedRelevance !== null) {
    log(`Relevance cache hit for ${link}: ${cachedRelevance}`);
    return cachedRelevance;
  }

  log(`Checking relevance with Claude for: ${link}`);

  let context = `URL: ${link}\n`;
  // Use the generic metadataContext object
  if (metadataContext?.title) {
    context += `Title: ${metadataContext.title}\n`; // Use generic 'Title'
  }
  if (metadataContext?.description) {
    // Use the potentially longer description for better context
    const descSnippet = metadataContext.description.substring(0, 300); // Take more context
    context += `Description: ${descSnippet}${
      metadataContext.description.length > 300 ? "..." : ""
    }\n`; // Use generic 'Description'
  }

  // Simple prompt asking for a yes/no decision based on guidelines
  const prompt = `Here are the Kiwi News submission guidelines:\n\n${KIWI_NEWS_GUIDELINES}\n\nBased *only* on these guidelines, is the content described below likely to be "On topic" and suitable for submission to Kiwi News? Answer with only "YES" or "NO".\n\nContent Context:\n${context}`;

  let responseText = "NO"; // Default to NO if anything fails
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 10, // Just need YES or NO
      temperature: 0, // Deterministic
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract the text content, expecting "YES" or "NO"
    if (
      response.content &&
      response.content.length > 0 &&
      response.content[0].type === "text"
    ) {
      responseText = response.content[0].text.trim().toUpperCase();
    } else {
      log(
        `Claude relevance check for ${link} produced unexpected response format: ${JSON.stringify(
          response,
        )}`,
      );
    }
  } catch (error) {
    log(`Claude relevance check API request failed for ${link}: ${error}`);
    // Keep default "NO"
  }

  // *** FIX: Check if the response STARTS WITH "YES" ***
  const isRelevant = responseText.startsWith("YES");
  // Add clear log before returning
  log(
    `Claude relevance raw response: "${responseText}". Final decision for ${link}: ${isRelevant}`,
  );

  // Cache the result
  lifetimeCache.set(cacheKey, isRelevant);

  return isRelevant;
}

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
      <div style="font-size: 0.7rem;">
        ${ogDescription ? `${ogDescription.substring(0, 150)}...` : ""}
      </div>
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
