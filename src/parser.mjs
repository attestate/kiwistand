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
import sharp from "sharp";
import Arweave from "arweave";

import { fetchCache as fetchCacheFactory } from "./utils.mjs";

import cache, { lifetimeCache } from "./cache.mjs";
import log from "./logger.mjs";

const fetchCache = new FileSystemCache({
  cacheDirectory: path.resolve(env.CACHE_DIR),
  ttl: 86400000, // 24 hours
});

const fetch = fetchBuilder.withCache(fetchCache);
const fetchStaleWhileRevalidate = fetchCacheFactory(fetch, fetchCache);

// Initialize Arweave client
const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https'
});

export async function getPageSpeedScore(url) {
  const apiKey = env.PAGESPEED_INSIGHTS_KEY;
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
    url,
  )}&strategy=MOBILE${apiKey ? `&key=${apiKey}` : ''}`;

  try {
    const response = await fetchStaleWhileRevalidate(apiUrl);
    
    // Check for rate limiting
    if (response.status === 429) {
      log(`PageSpeed Insights rate limit hit for ${url}`);
      // Return a default score when rate limited
      return 30;
    }
    
    if (!response.ok) {
      log(`PageSpeed Insights API error ${response.status} for ${url}`);
      return 30;
    }
    
    const data = await response.json();
    const score = data?.lighthouseResult?.categories?.performance?.score || 0;
    return Math.round(score * 100);
  } catch (err) {
    log(`PageSpeed Insights fetch error for ${url}: ${err.message}`);
    return 30;
  }
}

const html = htm.bind(vhtml);

// Helper function to detect Cloudflare challenge pages
function isCloudflareChallengePage(title) {
  if (!title) return false;
  const lowercaseTitle = title.toLowerCase();
  return (
    lowercaseTitle.includes("just a moment") ||
    lowercaseTitle.includes("attention required") ||
    lowercaseTitle.includes("checking your browser") ||
    lowercaseTitle.includes("cloudflare") ||
    lowercaseTitle === "please wait..." ||
    lowercaseTitle.includes("ddos protection")
  );
}

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
export const twitterFrontends = [
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
const CLAUDE_DOMAINS = ["farcaster.xyz", "warpcast.com", "fxtwitter.com", ...twitterFrontends];

const TITLE_COMPLIANCE = `
Format this title according to these rules:
 1. Use sentence case (capitalize first word only)
 2. Remove any emojis
 3. Maximum 80 characters
 4. No trailing period
 5. Keep any existing dash (-) or colon (:) formatting
 6. Format dates as YYYY-MM-DD
 7. Don't include the hosting platform in titles (e.g., "GitHub - bitcoin/bitcoin") as we already show the domain (DO: e.g. "bitcoin/bitcoin")
`;

// Added Kiwi News Submission Guidelines
const KIWI_NEWS_GUIDELINES = `
Why guidelines are important
We have an opportunity to build our own corner of the onchain internet. With awesome people, links, resources, and learning. To ensure this corner is valuable, we need to follow some submission guidelines.

What to submit?
On topic:
Anything that gratifies the intellectual curiosities of builders, engineers, hackers.
We are an Ethereum-first community, but other resources are interesting to us as well.

That includes:

Technical resources, hacking, and awesome git repos
Dune dashboards, reports, data-driven articles
Startups, cryptocurrencies, cryptography
Networking, privacy, decentralization
Hardware, open source, economics, game theory, privacy

For tweet-style content, it'll come from multiple places: ${twitterFrontends.join(
  " ",
)}. Tweet-style content that is super short should most likely NOT be submitted. Usually if it is low effort r just a random person's point of view.
Consider the above rules. We are a tech, hacker community. We don't want everyone's random thoughts. Especially not if they're low-effort.


Other off topic submissions include: 
Sensationalist journalism for the sake of ad revenue (including overly optimized click-bait, rage-bait, fluff headlines, clickthrough optimized headlines, cliffhanger headlines, posts with no substance)
Mediocre resources
Old stories we all read and that have been widely shared elsewhere
Shilling if it's for the wrong projects, e.g., HYPE, HYPERLIQUID, Cardano, BNB, centralized projects, scams, KOL-promoted fake projects
Fund raise announcements of projects which are not closely associated with Ethereum

# Are promotional/shilling links allowed?

Generally no. But for Ethereum and Ethereum-based projects which have a long standing history of legitimacy, it's fine. But it's really
important that we only allow promotions of the right projects: Projects

Bitcoin, Ethereum, USDT, Solana, USDC, Lido, Chainlink, Sky, USDT, Circle, USDC, Monero, Coinbase, Base, Farcaster, Warpcast, Uniswap, Aave, TRUMP, Arbitrum, Worldcoin, Maker, Optimism, Railgun, Railway, Curve, ENS, Paragraph, Zora, Flashbots, Unichain, ZKsync, Starknet, Scroll, Gnosis, GHO, EURC, Monerium, Gnosis Pay, Celo, It's super important to strictly adhere to this list and only diverge if it happens to be non exhaustive with regards to Ethereum-related projects which haven't accidentially been mentioned.
It may also be fine if highly trustworthy individuals from the Ethereum community say something.

For shilling more generally: No content that is specifically direct to retards
in the Crypto Twitter community which tend to just use false advertisement to
promote bad articles.
`;

const GUIDELINES = `We have an opportunity to build our own corner of the onchain internet. With awesome people, links, resources, and learning.

Our content focuses on:
- Technical resources, hacking, and awesome git repos
- Dune dashboards, reports, data-driven articles
- Startups, cryptocurrencies, cryptography
- Networking, privacy, decentralization
- Hardware, open source, art, economics, game theory
- AI, if it directly helps devs ship faster (code‑, infra‑, or data‑related) or impacts crypto or core web infra
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
      model: "claude-sonnet-4-20250514",
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
    const generatedTitle = toolUse.input.title;
    
    // Check if the generated title is from a Cloudflare challenge page
    if (isCloudflareChallengePage(generatedTitle)) {
      console.error("Generated title appears to be from Cloudflare challenge page");
      return null;
    }
    
    return generatedTitle;
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
      model: "claude-sonnet-4-20250514",
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
    let fixedTitle = null;
    
    if (toolUse && toolUse.input && toolUse.input.title) {
      fixedTitle = toolUse.input.title;
    } else if (response.completion && response.completion.trim().length > 0) {
      console.warn(
        "No tool_use block found, falling back to response.completion",
      );
      fixedTitle = response.completion.trim();
    } else {
      console.error("No title found in fixTitle response");
      return null;
    }
    
    // Check if the fixed title is from a Cloudflare challenge page
    if (isCloudflareChallengePage(fixedTitle)) {
      console.error("Fixed title appears to be from Cloudflare challenge page");
      return null;
    }
    
    return fixedTitle;
  } catch (error) {
    console.error("Error extracting title in fixTitle:", error);
    return null;
  }
}

export async function extractWarpcastContent(identifier, type = "url") {
  try {
    const apiUrl = `https://api.neynar.com/v2/farcaster/cast?identifier=${identifier}&type=${type}`;

    const response = await fetch(apiUrl, {
      headers: {
        accept: "application/json",
        "X-Api-Key": env.NEYNAR_API_KEY,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    });

    const data = await response.json();
    if (!data?.cast) return null;
    return {
      text: data.cast.text,
      author: {
        username: data.cast.author.username,
        displayName: data.cast.author.display_name,
        pfp: data.cast.author.pfp_url,
      },
      timestamp: data.cast.timestamp,
      embeds: data.cast.embeds || [],
      hash: data.cast.hash || null,
    };
  } catch (error) {
    console.error("Neynar API error:", error);
    return null;
  }
}

export async function getCastByHashAndConstructUrl(castHash) {
  // Fetch cast data from Neynar API and construct proper Farcaster URL
  // Format: https://farcaster.xyz/{username}/{shortHash}
  if (!castHash) return null;

  const cast = await extractWarpcastContent(castHash, "hash");

  if (cast && cast.author.username) {
    // Truncate hash to first 8 chars after 0x for Farcaster URL format
    const shortHash = castHash.slice(0, 10);
    return `https://farcaster.xyz/${cast.author.username}/${shortHash}`;
  }

  return null;
}

// Convert TipTap JSON to HTML
function convertTipTapToHTML(doc) {
  if (!doc || !doc.content) return '';
  
  const convertNode = (node) => {
    if (!node) return '';
    
    // Handle text nodes
    if (node.type === 'text') {
      let text = node.text || '';
      // Apply marks (bold, italic, links, etc.)
      if (node.marks && node.marks.length > 0) {
        node.marks.forEach(mark => {
          switch (mark.type) {
            case 'bold':
              text = `<strong>${text}</strong>`;
              break;
            case 'italic':
              text = `<em>${text}</em>`;
              break;
            case 'underline':
              text = `<u>${text}</u>`;
              break;
            case 'link':
              text = `<a href="${mark.attrs.href}" target="${mark.attrs.target || '_blank'}" rel="${mark.attrs.rel || 'noopener noreferrer'}">${text}</a>`;
              break;
          }
        });
      }
      return text;
    }
    
    // Handle different node types
    const children = node.content ? node.content.map(convertNode).join('') : '';
    
    switch (node.type) {
      case 'doc':
        return children;
      case 'paragraph':
        return `<p>${children}</p>`;
      case 'heading':
        const level = node.attrs?.level || 2;
        return `<h${level}>${children}</h${level}>`;
      case 'blockquote':
        return `<blockquote>${children}</blockquote>`;
      case 'bulletList':
        return `<ul>${children}</ul>`;
      case 'orderedList':
        return `<ol>${children}</ol>`;
      case 'listItem':
        return `<li>${children}</li>`;
      case 'codeBlock':
        return `<pre><code>${children}</code></pre>`;
      case 'image':
        const imgAttrs = node.attrs || {};
        // Ensure we have a valid image source
        if (imgAttrs.src) {
          return `<img src="${imgAttrs.src}" alt="${imgAttrs.alt || ''}" ${imgAttrs.title ? `title="${imgAttrs.title}"` : ''} style="max-width: 100%; height: auto;">`;
        }
        return '';
      case 'figure':
        // Figures often contain images, ensure proper styling
        return `<figure style="margin: 1em 0; text-align: center;">${children}</figure>`;
      case 'figcaption':
        return `<figcaption style="margin-top: 0.5em; font-style: italic; color: #666;">${children}</figcaption>`;
      case 'hardBreak':
        return '<br>';
      default:
        // For unknown types, just return the children
        return children;
    }
  };
  
  return convertNode(doc);
}

export async function extractParagraphContent(url) {
  try {
    // Extract the post slug from Paragraph.xyz URL
    // URLs are typically in format: https://paragraph.xyz/@username/post-slug
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    
    if (pathParts.length < 2 || !pathParts[0].startsWith('@')) {
      log(`Invalid Paragraph URL format: ${url}`);
      return null;
    }
    
    const username = pathParts[0].substring(1); // Remove @ prefix
    const postSlug = pathParts[1];
    
    // Fetch the HTML page
    const signal = AbortSignal.timeout(10000);
    const response = await fetch(url, {
      headers: {
        "User-Agent": env.USER_AGENT,
      },
      agent: useAgent(url),
      signal,
    });
    
    if (!response.ok) {
      log(`Failed to fetch Paragraph page: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    const dom = parser(html);
    
    // Try to extract Arweave transaction ID from meta tags or script tags
    let arweaveId = null;
    const metaTags = dom.querySelectorAll('meta');
    for (const meta of metaTags) {
      const property = meta.getAttribute('property') || meta.getAttribute('name');
      if (property && property.includes('arweave')) {
        arweaveId = meta.getAttribute('content');
        break;
      }
    }
    
    // If no Arweave ID in meta tags, look in script tags
    if (!arweaveId) {
      const scriptTags = dom.querySelectorAll('script');
      for (const script of scriptTags) {
        const content = script.innerHTML;
        // Look for Arweave transaction ID patterns (43 character base64url strings)
        const arweaveMatch = content.match(/["']([a-zA-Z0-9_-]{43})["']/);
        if (arweaveMatch && content.includes('arweave')) {
          arweaveId = arweaveMatch[1];
          break;
        }
      }
    }
    
    // Extract basic metadata from the page
    const title = dom.querySelector('meta[property="og:title"]')?.getAttribute('content') || 
                  dom.querySelector('title')?.text || '';
    const description = dom.querySelector('meta[property="og:description"]')?.getAttribute('content') || 
                        dom.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    
    // Try to extract article content
    let content = '';
    // Common selectors for article content in blog platforms
    const contentSelectors = [
      // Paragraph.xyz specific selectors
      'div.prose.prose-lg',
      'div[class*="prose"]',
      '#__next main div.prose',
      '#main-post-body',
      // Generic selectors
      'article[class*="prose"]',
      'article',
      '[class*="article-content"]',
      '[class*="post-content"]',
      'main article',
      'main',
      '.content'
    ];
    
    log(`Attempting to extract content from page...`);
    for (const selector of contentSelectors) {
      const contentElement = dom.querySelector(selector);
      if (contentElement) {
        content = contentElement.innerHTML;
        log(`Found content using selector: "${selector}", content length: ${content.length}, first 200 chars: ${content.substring(0, 200).replace(/\n/g, '\\n')}`);
        
        // If content looks like it's just plain text without HTML tags, check if we need to look deeper
        if (content.length < 500 && !content.includes('<p>') && !content.includes('<br>')) {
          log(`Content seems too short or lacks HTML, continuing search...`);
          continue;
        }
        break;
      }
    }
    
    if (!content) {
      log(`No content found with selectors, trying to find any div with substantial text...`);
      // Last resort: find any div with substantial text content
      const allDivs = dom.querySelectorAll('div');
      for (const div of allDivs) {
        const text = div.textContent || '';
        if (text.length > 1000 && div.innerHTML.includes('<p>')) {
          content = div.innerHTML;
          log(`Found content in generic div, length: ${content.length}`);
          break;
        }
      }
    }
    
    // If we have an Arweave ID, try to fetch from Arweave
    if (arweaveId) {
      try {
        log(`Found Arweave ID: ${arweaveId}, attempting to fetch...`);
        const data = await arweave.transactions.getData(arweaveId, {
          decode: true,
          string: true
        });
        
        log(`Arweave data fetched, length: ${data.length}, first 200 chars: ${data.substring(0, 200)}`);
        
        // Try to parse as JSON
        try {
          const arweaveData = JSON.parse(data);
          log(`Arweave data is JSON with keys: ${Object.keys(arweaveData).join(', ')}`);
          
          // Return the raw data - let the component handle rendering
          return {
            title: arweaveData.title || title,
            content: arweaveData.staticHtml || '',
            tiptapJson: arweaveData.json || null,
            markdown: arweaveData.markdown || null,
            author: {
              username: username,
              displayName: arweaveData.authors?.[1]?.name || username,
            },
            publishedAt: arweaveData.publishedAt || arweaveData.createdAt,
            description: arweaveData.post_preview || arweaveData.description || description,
            arweaveId: arweaveId,
            coverImage: arweaveData.cover_img || null,
          };
        } catch (jsonError) {
          // If not JSON, it might be HTML or plain text
          log(`Arweave data is not JSON, checking if it's HTML...`);
          
          // Check if it looks like HTML
          if (data.includes('<p>') || data.includes('<div>') || data.includes('<article>')) {
            log(`Arweave data appears to be HTML`);
            return {
              title: title,
              content: data,
              author: {
                username: username,
                displayName: username,
              },
              publishedAt: null,
              description: description,
              arweaveId: arweaveId,
            };
          } else {
            // If it's plain text, we need to preserve line breaks
            log(`Arweave data appears to be plain text`);
            return {
              title: title,
              content: data,
              author: {
                username: username,
                displayName: username,
              },
              publishedAt: null,
              description: description,
              arweaveId: arweaveId,
            };
          }
        }
      } catch (arweaveError) {
        log(`Failed to fetch from Arweave: ${arweaveError.message}`);
        // Continue with scraped data
      }
    }
    
    // Return scraped data
    return {
      title: title,
      content: content,
      author: {
        username: username,
        displayName: username,
      },
      publishedAt: null,
      description: description,
      arweaveId: null,
    };
    
  } catch (error) {
    log(`Error extracting Paragraph content: ${error.message}`);
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
    
    if (!res.ok) return false;
    
    // Check image size from Content-Length header
    const contentLength = res.headers.get('content-length');
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength);
      const sizeInMB = sizeInBytes / (1024 * 1024);
      
      // Reject images larger than 2MB
      if (sizeInMB > 2) {
        log(`Rejecting oversized image (${sizeInMB.toFixed(1)}MB): ${url}`);
        return false;
      }
    }
    
    return true;
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

// Track URLs currently being fetched to prevent duplicate processing
const inFlightFetches = new Map();

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

  // Check if another worker is already fetching this URL
  if (inFlightFetches.get(normalizedUrl)) {
    log(`Skipping duplicate fetch for ${normalizedUrl} - already in flight`);
    return {}; // Someone else is fetching, just return empty
  }

  // Mark that we're fetching this URL
  inFlightFetches.set(normalizedUrl, true);

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
    })
    .finally(() => {
      // Clear the in-flight flag
      inFlightFetches.delete(normalizedUrl);
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

  let result, html, canIframe;
  if (cache.has(url)) {
    const fromCache = cache.get(url);
    result = fromCache.result;
    html = fromCache.html;
    canIframe = fromCache.canIframe !== undefined ? fromCache.canIframe : true; // Default to true for old cache entries
  } else {
    const signal = AbortSignal.timeout(5000);
    const response = await fetch(url, {
      headers: {
        "User-Agent": env.USER_AGENT,
      },
      agent: useAgent(url),
      signal,
    });

    // Check iframe compatibility
    const xFrameOptions = response.headers.get('x-frame-options');
    const csp = response.headers.get('content-security-policy');
    
    canIframe = true;
    if (xFrameOptions && (xFrameOptions.toLowerCase() === 'deny' || xFrameOptions.toLowerCase() === 'sameorigin')) {
      canIframe = false;
    }
    if (csp) {
      // Check for frame-ancestors directive
      if (csp.includes('frame-ancestors')) {
        // Extract the frame-ancestors value
        const frameAncestorsMatch = csp.match(/frame-ancestors\s+([^;]+)/);
        if (frameAncestorsMatch) {
          const frameAncestorsValue = frameAncestorsMatch[1].trim();
          // Default to blocking unless explicitly allowed
          canIframe = false;
          
          // Only allow if it explicitly allows all origins
          if (frameAncestorsValue.includes('*') && !frameAncestorsValue.includes("'self'")) {
            canIframe = true;
          }
          // Check if it only allows specific domains (like Substack allowing only *.substack.com)
          else if (frameAncestorsValue.includes('https://') || frameAncestorsValue.includes('http://')) {
            // If it specifies specific domains, it won't work from kiwistand.com
            canIframe = false;
          }
        } else {
          // If frame-ancestors is present but we can't parse it, block to be safe
          canIframe = false;
        }
      }
    }

    html = await response.text();
    const parsed = await ogs({ html });
    result = parsed.result;

    if (result && html) {
      cache.set(url, { result, html, canIframe });
    }
  }

  const domain = safeExtractDomain(url);
  if (filtered.includes(domain) || (result && !result.success)) {
    throw new Error("Link from excluded domain");
  }

  // Check if result is undefined or invalid
  if (!result) {
    log(`No metadata result for URL: ${url}`);
    return {
      domain: DOMPurify.sanitize(domain),
      ogTitle: "",
      ogDescription: "",
      canIframe: false
    };
  }

  let image;
  if (result.ogImage && result.ogImage.length >= 1) {
    image = result.ogImage[0].url;
  }
  if (result.twitterImage && result.twitterImage.length >= 1) {
    image = result.twitterImage[0].url;
  }
  // Detect if the target has video content (used to avoid rendering text-only previews)
  const hasVideoContent = Boolean(
    (result.ogVideo && result.ogVideo.length >= 1) ||
      (result.twitterPlayer && result.twitterPlayer.length >= 1) ||
      (result.twitterCard && String(result.twitterCard).toLowerCase() === "player") ||
      (result.ogType && String(result.ogType).toLowerCase().includes("video"))
  );
  if (hostname === "youtu.be" || hostname.endsWith("youtube.com")) {
    const id = getYTId(url);
    if (id) {
      image = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
    }
  }

  const { ogTitle } = result;
  let { ogDescription } = result;
  
  // Check if the title is a Cloudflare challenge page
  if (isCloudflareChallengePage(ogTitle)) {
    log(`Cloudflare challenge page detected for URL: ${url}`);
    // Return minimal metadata to prevent using the cloudflare title
    return {
      domain: DOMPurify.sanitize(domain),
      ogTitle: "", // Empty title to force user to enter one manually
      ogDescription: "",
      canIframe: false,
      isCloudflareChallenge: true // Flag to indicate this is a Cloudflare page
    };
  }

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
    "farcaster.xyz",
    "warpcast.com",
    "medium.com",
    "paragraph.xyz",
    ...twitterFrontends,
  ];
  let output = {};

  // Always extract Farcaster cast data for preview, regardless of generateTitle
  if (hostname === "farcaster.xyz" || hostname === "warpcast.com") {
    const cast = await extractWarpcastContent(url, "url");
    if (cast) {
      // Store cast data for preview component
      output.farcasterCast = {
        author: cast.author,
        text: cast.text,
        embeds: cast.embeds,
        hash: cast.hash,
      };

      // Only generate title if requested
      if (generateTitle) {
        const castContent = `Cast by ${cast.author.username}: ${cast.text}`;
        const claudeTitle = await generateClaudeTitle(castContent);
        if (claudeTitle) {
          output.ogTitle = claudeTitle;
        }
      }
    } else {
      log(`No cast data returned for URL: ${url}`);
    }
  }

  // Extract Paragraph.xyz content from Arweave
  if (hostname === "paragraph.xyz") {
    const paragraphPost = await extractParagraphContent(url);
    if (paragraphPost) {
      // Store post data for preview component
      output.paragraphPost = {
        author: paragraphPost.author,
        title: paragraphPost.title,
        description: paragraphPost.description,
        content: paragraphPost.content,
        publishedAt: paragraphPost.publishedAt,
        arweaveId: paragraphPost.arweaveId,
      };

      // Override og metadata with Paragraph data
      if (paragraphPost.title) {
        output.ogTitle = paragraphPost.title;
      }
      if (paragraphPost.description) {
        ogDescription = paragraphPost.description;
        output.ogDescription = DOMPurify.sanitize(paragraphPost.description);
      }
      
      // Generate better title if requested
      if (generateTitle && paragraphPost.content) {
        const postContent = `${paragraphPost.title}: ${paragraphPost.description || paragraphPost.content.substring(0, 500)}`;
        const claudeTitle = await generateClaudeTitle(postContent);
        if (claudeTitle) {
          output.ogTitle = claudeTitle;
        }
      }
    } else {
      log(`No Paragraph data returned for URL: ${url}`);
    }
  }

  if (generateTitle) {
    if (
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
    // Check if the title is from a Cloudflare challenge page
    if (isCloudflareChallengePage(ogTitle)) {
      log(`Cloudflare challenge page title detected, skipping title assignment for URL: ${url}`);
      output.isCloudflareChallenge = true; // Flag to indicate this is a Cloudflare page
      // Don't set the title, leave it empty
    } else {
      output.ogTitle = ogTitle;
    }
  }

  if (domain) {
    output.domain = DOMPurify.sanitize(domain);
  }
  if (image && image.startsWith("https://")) {
    const exists = await checkOgImage(image);
    if (exists) {
      // Skip quality assessment for Twitter/X images as they often contain valuable screenshots/text
      const isTwitterImage = twitterFrontends.some(frontend => 
        hostname === frontend || hostname === "fxtwitter.com"
      );
      
      if (isTwitterImage) {
        // Always show Twitter/X images as they're usually relevant content
        output.image = DOMPurify.sanitize(image);
      } else {
        // Check if image is meaningful before including it for non-Twitter sources
        const isMeaningful = await isImageMeaningful(
          image,
          output.ogTitle || ogTitle,
          ogDescription
        );
        if (isMeaningful) {
          output.image = DOMPurify.sanitize(image);
        } else {
          log(`Image rejected by quality assessment: ${image}`);
        }
      }
    }
  }
  if (result.twitterCreator) {
    output.twitterCreator = DOMPurify.sanitize(result.twitterCreator);
  }
  // Forward useful media hints to the UI layer
  if (hasVideoContent) {
    output.hasVideo = true;
  }
  if (ogDescription) {
    // Store the original, potentially longer description in the output object
    output.ogDescription = DOMPurify.sanitize(ogDescription);
  }
  
  // For tweets, extract author info and fetch their profile for avatar
  if (twitterFrontends.includes(hostname) && !ogDescription?.includes("x.com/i/article/")) {
    try {
      // Extract username from the tweet URL (format: /username/status/id)
      const pathParts = urlObj.pathname.split('/');
      if (pathParts.length >= 3 && pathParts[2] === 'status') {
        const username = pathParts[1];
        
        // Fetch the author's profile page to get their avatar
        const profileUrl = `https://x.com/${username}`;
        const profileResponse = await fetch(profileUrl, {
          headers: {
            "User-Agent": env.USER_AGENT,
          },
          agent: useAgent(profileUrl),
          signal: AbortSignal.timeout(3000),
        });
        
        if (profileResponse.ok) {
          const profileHtml = await profileResponse.text();
          const profileParsed = await ogs({ html: profileHtml });
          
          if (profileParsed.result && profileParsed.result.ogImage && profileParsed.result.ogImage.length > 0) {
            output.twitterAuthorAvatar = DOMPurify.sanitize(profileParsed.result.ogImage[0].url);
          }
        }
      }
    } catch (err) {
      log(`Failed to fetch Twitter author avatar: ${err.message}`);
    }
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

  // Add iframe compatibility info
  output.canIframe = canIframe;

  return output;
};

/**
 * Checks if a link is relevant to Kiwi News using Claude Haiku.
 * @param {string} link - The URL to check.
 * @param {object} [metadataContext] - Optional metadata context from the caller (e.g., Telegram).
 * @param {string} [metadataContext.title] - Title from OG, Telegram, etc.
 * @param {string} [metadataContext.description] - Description from OG, Telegram, etc.
 * @returns {Promise<boolean>} - True if the link is deemed relevant.
 */
export async function isRelevantToKiwiNews(link, metadataContext = {}) {
  const normalizedUrl = normalizeUrl(link, { stripWWW: false });
  const cacheKey = `relevance-${normalizedUrl}`;

  // Check LRU cache first
  const cachedRelevance = cache.get(cacheKey);
  if (cachedRelevance !== undefined) {
    // LRUCache returns undefined for a cache miss
    log(`Relevance LRU cache hit for ${link}: ${cachedRelevance}`);
    return cachedRelevance;
  }

  // Fetch metadata, generating title and processing submittedTitle (from metadataContext.title)
  let fetchedMeta = {};
  try {
    // Pass metadataContext.title as submittedTitle to the metadata function
    fetchedMeta = await metadata(link, true, metadataContext.title);
  } catch (error) {
    log(
      `Error fetching metadata in isRelevantToKiwiNews for ${link}: ${error.message}`,
    );
    // Proceed with empty fetchedMeta, fallbacks will be used
  }

  let context = `URL: ${link}\n`;

  // Prioritize title from fetchedMeta (compliantTitle, then ogTitle), then fallback to metadataContext.title
  const titleForClaude =
    fetchedMeta.compliantTitle || fetchedMeta.ogTitle || metadataContext.title;
  if (titleForClaude) {
    context += `Title: ${titleForClaude}\n`;
  }

  // Prioritize description from fetchedMeta, then fallback to metadataContext.description
  const descriptionForClaude =
    fetchedMeta.ogDescription || metadataContext.description;
  if (descriptionForClaude) {
    const descSnippet = descriptionForClaude.substring(0, 300);
    context += `Description: ${descSnippet}${
      descriptionForClaude.length > 300 ? "..." : ""
    }\n`;
  }
  log(
    `Relevance LRU cache miss. Checking relevance with Claude for: ${JSON.stringify(
      context,
    )}`,
  );

  // Simple prompt asking for a yes/no decision based on guidelines
  const prompt = `Here are the Kiwi News submission guidelines:\n\n${KIWI_NEWS_GUIDELINES}\n\nBased *only* on these guidelines, is the content described below likely to be "On topic" and suitable for submission to Kiwi News? Answer with only "YES" or "NO".\n\nContent Context:\n${context}`;

  let responseText = "NO"; // Default to NO if anything fails
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200, // Just need YES or NO
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

  // Cache the result in LRU cache
  cache.set(cacheKey, isRelevant);

  return isRelevant;
}

/**
 * Assesses if an image meaningfully adds to an article using Claude.
 * Resizes image to 200x200px to minimize API costs.
 * @param {string} imageUrl - The URL of the image to assess.
 * @param {string} articleTitle - The title of the article.
 * @param {string} articleDescription - The description of the article.
 * @returns {Promise<boolean>} - True if the image is meaningful and should be shown.
 */
export async function isImageMeaningful(imageUrl, articleTitle, articleDescription) {
  const normalizedUrl = normalizeUrl(imageUrl, { stripWWW: false });
  const cacheKey = `image-quality-${normalizedUrl}`;

  // Check cache first
  const cachedResult = cache.get(cacheKey);
  if (cachedResult !== undefined) {
    log(`Image quality cache hit for ${imageUrl}: ${cachedResult}`);
    return cachedResult;
  }

  try {
    // Fetch the image
    const signal = AbortSignal.timeout(10000);
    const response = await fetch(imageUrl, {
      agent: useAgent(imageUrl),
      signal,
      headers: {
        "User-Agent": env.USER_AGENT,
      },
    });

    if (!response.ok) {
      log(`Failed to fetch image ${imageUrl}: ${response.status}`);
      cache.set(cacheKey, false);
      return false;
    }

    const buffer = await response.arrayBuffer();
    log(`Fetched image ${imageUrl}, size: ${buffer.byteLength} bytes`);
    
    // Resize image to 200x200px to minimize Claude API costs
    const resizedBuffer = await sharp(Buffer.from(buffer))
      .resize(200, 200, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toBuffer();
    
    log(`Resized image to ${resizedBuffer.length} bytes`);

    // Convert to base64
    const base64Image = resizedBuffer.toString('base64');

    // Prepare context for Claude
    let context = "";
    if (articleTitle) {
      context += `Article Title: ${articleTitle}\n`;
    }
    if (articleDescription) {
      const descSnippet = articleDescription.substring(0, 200);
      context += `Article Description: ${descSnippet}${articleDescription.length > 200 ? "..." : ""}\n`;
    }

    const prompt = `You are curating images for a beautiful tech/crypto news feed. We want a visually appealing feed with meaningful, high-quality images.

${context}

Consider:
1. Does this image make the feed more beautiful and engaging?
2. Is it visually appealing and high-quality?
3. Does it add meaningful visual context to the article?

REJECT these ugly/low-value images:
- Company logos as the main image (extremely ugly in feeds!)
- Generic icons or app icons
- Low-resolution or pixelated images
- Generic abstract patterns or backgrounds
- Default forum avatars or profile pictures
- Bland technical diagrams that are just decorative
- Screenshots of walls of text
- Generic stock photos that don't relate to content

ACCEPT these beautiful/meaningful images:
- High-quality photos related to the article
- Beautiful artwork or game visuals when relevant
- Clean, informative infographics or diagrams
- Compelling screenshots that show interesting UI/features
- Photos of people/events mentioned in the article
- Visually striking images that enhance the story
- Well-designed technical illustrations

Think: "Would this image make someone want to click and read more?" If it's just a boring logo or generic image, reject it.

Answer with only "YES" (show the image) or "NO" (hide the image).`;

    const response_claude = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 10,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: base64Image
              }
            },
            {
              type: "text",
              text: prompt
            }
          ]
        }
      ]
    });

    // Extract response
    let responseText = "NO"; // Default to NO if parsing fails
    if (response_claude.content && response_claude.content.length > 0 && response_claude.content[0].type === "text") {
      responseText = response_claude.content[0].text.trim().toUpperCase();
    }

    const isMeaningful = responseText.startsWith("YES");
    log(`Claude image assessment for ${imageUrl}: ${responseText} -> ${isMeaningful}`);

    // Cache the result
    cache.set(cacheKey, isMeaningful);
    return isMeaningful;

  } catch (error) {
    log(`Error assessing image ${imageUrl}: ${error.message}`);
    // On error, default to not showing the image
    cache.set(cacheKey, false);
    return false;
  }
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
