import htm from "htm";
import vhtml from "vhtml";
import {
  differenceInHours,
  formatDistanceToNowStrict as originalFormatDistance,
} from "date-fns";
import { URL } from "url";
import DOMPurify from "isomorphic-dompurify";
import ethers from "ethers";
import { getSlug, isCloudflareImage } from "../../utils.mjs";

import { commentCounts } from "../../store.mjs";
import ShareIcon from "./shareicon.mjs";
import CopyIcon from "./copyicon.mjs";
import FCIcon from "./farcastericon.mjs";
import { warpcastSvg } from "./socialNetworkIcons.mjs";
import theme from "../../theme.mjs";
import { countOutbounds } from "../../cache.mjs";
import log from "../../logger.mjs";
import { twitterFrontends } from "../../parser.mjs";
import FarcasterFullCast from "./farcaster-full-cast.mjs";
import ParagraphFullPost from "./paragraph-full-post.mjs";

const html = htm.bind(vhtml);

export const iconSVG = html`
  <svg
    style="width: 35px;"
    viewBox="0 0 200 200"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M99.84 52.0801L55.04 96.8001L68.44 110.04L90.36 88.0401L90.3747 148H109.8V88.0401L131.84 110.04L144.96 96.8001L100.24 52.0801H99.84Z"
    />
  </svg>
`;

const heartSVG = html`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="none" />
    <path
      d="M128,224S24,168,24,102A54,54,0,0,1,78,48c22.59,0,41.94,12.31,50,32,8.06-19.69,27.41-32,50-32a54,54,0,0,1,54,54C232,168,128,224,128,224Z"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;

const shareSVG = html`
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
    width="20"
    height="20"
  >
    <rect width="256" height="256" fill="none" />
    <polyline
      points="176 152 224 104 176 56"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <polyline
      points="192 216 32 216 32 88"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M72,176a96,96,0,0,1,93-72h59"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;

const heartFilledSVG = html`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="none" />
    <path
      d="M240,102c0,70-103.79,126.66-108.21,129a8,8,0,0,1-7.58,0C119.79,228.66,16,172,16,102A62.07,62.07,0,0,1,78,40c20.65,0,38.73,8.88,50,23.89C139.27,48.88,157.35,40,178,40A62.07,62.07,0,0,1,240,102Z"
    />
  </svg>
`;

const expandSVG = html`
  <svg
    style="color:black; height: 1rem;"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <line
      x1="216"
      y1="128"
      x2="40"
      y2="128"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <line
      x1="128"
      y1="96"
      x2="128"
      y2="16"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <polyline
      points="96 48 128 16 160 48"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <line
      x1="128"
      y1="160"
      x2="128"
      y2="240"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <polyline
      points="160 208 128 240 96 208"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;


const formatDistanceToNowStrict = (date) => {
  return originalFormatDistance(date)
    .replace(/ years?/, "y")
    .replace(/ months?/, "mo")
    .replace(/ weeks?/, "w")
    .replace(/ days?/, "d")
    .replace(/ hours?/, "h")
    .replace(/ minutes?/, "m")
    .replace(/ seconds?/, "s");
};

const ShuffleSVG = html`<svg
  style="width: 24px; color: black;"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 256 256"
>
  <rect width="256" height="256" fill="none" />
  <path
    d="M32,72H55.06a64,64,0,0,1,52.08,26.8l41.72,58.4A64,64,0,0,0,200.94,184H232"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="16"
  />
  <polyline
    points="208 48 232 72 208 96"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="16"
  />
  <polyline
    points="208 160 232 184 208 208"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="16"
  />
  <path
    d="M147.66,100.47l1.2-1.67A64,64,0,0,1,200.94,72H232"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="16"
  />
  <path
    d="M32,184H55.06a64,64,0,0,0,52.08-26.8l1.2-1.67"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="16"
  />
</svg>`;

export function extractDomain(link) {
  const parsedUrl = new URL(link);
  const parts = parsedUrl.hostname.split(".");
  const tld = parts.slice(-2).join(".");
  return tld;
}

const truncateLongWords = (text, maxLength = 20) => {
  const words = text.split(" ");
  const truncatedWords = words.map((word) =>
    word.length > maxLength ? `${word.substring(0, maxLength)}...` : word,
  );
  return truncatedWords.join(" ");
};

export function truncateComment(comment, maxLength = 180) {
  const emptyLineIndex = comment.indexOf("\n\n");
  if (emptyLineIndex !== -1 && emptyLineIndex < maxLength)
    return truncateLongWords(comment.slice(0, emptyLineIndex)) + "\n...";

  const lastLinkStart = comment.lastIndexOf("https://", maxLength);
  if (lastLinkStart !== -1 && lastLinkStart < maxLength) {
    const nextSpace = comment.indexOf(" ", lastLinkStart);
    const linkEnd = nextSpace === -1 ? comment.length : nextSpace;
    const fullLink = comment.slice(lastLinkStart, linkEnd);
    const truncatedLink =
      fullLink.length > 60 ? fullLink.substring(0, 60) + "..." : fullLink;

    const beforeLink = truncateLongWords(
      comment.slice(0, lastLinkStart).trim(),
    );
    if (beforeLink && beforeLink.length > 0) {
      return beforeLink + " " + truncateLongWords(truncatedLink) + "...";
    } else {
      return truncatedLink + "...";
    }
  }

  if (comment.length <= maxLength) return truncateLongWords(comment);
  return truncateLongWords(
    comment.slice(0, comment.lastIndexOf(" ", maxLength)) + "...",
  );
}

// NOTE: Some sites have awful OG images that we don't want to show. Notion for
// example always have the same generic ogImages, but many people often share
// Notion documents.
const blockedOGImageDomains = [
  "notion.site",
  "abs.xyz",
  "github.com",
  "https://www.railway.xyz/",
  "t.me",
  "soliditylang.org",
  "hey.xyz",
  "warpcast.com",
  "farcaster.xyz",
  "xcancel.com",
  "hackmd.io",
  "ethresear.ch",
  "paulgraham.com",
];

// Helper function to check if domain is a substack subdomain
const isSubstackDomain = (domain) => domain.endsWith("substack.com");
const knownBadOgImages = [
  "https://paragraph.xyz/share/share_img.jpg",
  "https://s.turbifycdn.com/aah/paulgraham/essays-5.gif",
];

const row = (
  start = 0,
  path,
  style = "",
  interactive,
  hideCast,
  period,
  invert = false,
  // NOTE: query is currently only used when we want to mark a comment preview
  // as visited, and so since comment previews are only active on / and /new, we
  // don't have to properly set query anywhere else.
  query = "",
  debugMode = false,
) => {
  const size = 12;
  return (story, i) => {
    try {
      // NOTE: Normally it can't happen, but when we deploy a new ad contract
      // then story can indeed be empty, and so this made several functions in
      // the row component panic, which is why we now check before we continue
      // the rendering.
      new URL(story.href);
    } catch (err) {
      log(`Fault during row render for story href: ${story.href}`);
      return;
    }

    const submissionId = `kiwi:0x${story.index}`;
    const commentCount = commentCounts.get(submissionId) || 0;
    const outboundsLookbackHours = 24 * 5;
    const clicks = countOutbounds(story.href, outboundsLookbackHours);
    const extractedDomain = extractDomain(DOMPurify.sanitize(story.href));
    // Use the twitterFrontends list from parser.mjs for comprehensive coverage
    const isTweet = twitterFrontends.some((domain) => {
      return (
        extractedDomain === domain || extractedDomain.endsWith(`.${domain}`)
      );
    });

    // Check if this is a Farcaster cast (only actual cast URLs)
    const isFarcasterCast =
      (extractedDomain === "warpcast.com" &&
        story.href.includes("/~/conversations/")) ||
      extractedDomain === "warpcast.com" ||
      extractedDomain === "farcaster.xyz" ||
      (story.href.includes("farcaster.xyz/") &&
        !story.href.includes("miniapps.farcaster.xyz") &&
        !story.href.includes("docs.farcaster.xyz") &&
        !story.href.includes("api.farcaster.xyz"));

    // Check if this is a Paragraph.xyz post
    const isParagraphPost = extractedDomain === "paragraph.xyz";

    // Check if the story itself is older than 12 hours
    const isStoryOlderThan12Hours =
      differenceInHours(new Date(), new Date(story.timestamp * 1000)) > 12;

    // Check if the image is a Cloudflare image
    const isCloudflare = isCloudflareImage(story.href) || (debugMode && story.href && story.href.includes("placehold.co"));

    // Condition for displaying mobile image:
    // - Must have image data (metadata or cloudflare)
    // - Must not be interactive
    // - Must not be a blocked domain/image
    // - Must be on allowed paths
    // - If on main feed ('/'), story must NOT be older than 12 hours UNLESS it's a Cloudflare image
    const hasImageData =
      (story.metadata &&
        story.metadata.image &&
        !blockedOGImageDomains.includes(extractedDomain) &&
        !knownBadOgImages.includes(story.metadata.image)) ||
      isCloudflare ||
      (debugMode && story.metadata && story.metadata.image);

    // Check if tweet contains an X.com article link in its content
    const tweetContainsXArticle =
      story.metadata &&
      story.metadata.ogDescription &&
      (story.metadata.ogDescription.includes("x.com/i/article/") ||
        story.metadata.ogDescription.includes("twitter.com/i/article/"));

    // Check if we have what we need to render a tweet preview
    // Exclude tweets containing article links
    const canRenderTweetPreview =
      isTweet &&
      story.metadata &&
      story.metadata.ogDescription &&
      !tweetContainsXArticle;

    // Check if we have what we need to render a Farcaster cast preview
    // Only show preview on non-stories pages
    const canRenderFarcasterPreview =
      isFarcasterCast &&
      story.metadata &&
      (story.metadata.farcasterCast || story.metadata.ogDescription) &&
      path !== "/stories"; // Don't show preview on stories page since we show full cast there

    // Extract first image from Farcaster cast embeds
    let farcasterImageUrl = null;
    if (canRenderFarcasterPreview && story.metadata.farcasterCast?.embeds) {
      const imageExtensions = [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".webp",
        ".svg",
      ];
      const imageEmbed = story.metadata.farcasterCast.embeds.find((embed) => {
        if (!embed || !embed.url) return false;
        const isDirectImage = imageExtensions.some((ext) =>
          embed.url.toLowerCase().includes(ext),
        );
        const hasImageMetadata = embed.metadata && embed.metadata.image;
        return isDirectImage || hasImageMetadata;
      });

      if (imageEmbed) {
        farcasterImageUrl = imageEmbed.metadata?.image?.url || imageEmbed.url;
      }
    }

    const displayImage =
      !canRenderTweetPreview && // Don't use regular image if we can render a tweet preview
      !canRenderFarcasterPreview && // Don't use regular image if we can render a Farcaster preview
      hasImageData &&
      !interactive &&
      (path === "/" ||
        path === "/stories" ||
        path === "/new" ||
        path === "/best" ||
        (debugMode && path === "/debug"));

    // Condition for displaying comment preview:
    // - Must have a last comment
    // - Last comment must have a resolved identity (ens/fc/lens)
    // - Must not be inverted
    const displayCommentPreview =
      story.lastComment &&
      (story.lastComment.identity.ens ||
        story.lastComment.identity.farcaster ||
        story.lastComment.identity.lens) &&
      !invert;

    return html`
      <tr style="${invert ? "background-color: black;" : ""}">
        <td>
          <div
            class="${interactive ? "" : "content-row"} ${invert
              ? "inverted-row"
              : ""} ${displayImage ||
            canRenderTweetPreview ||
            canRenderFarcasterPreview
              ? "content-row-elevated"
              : ""}"
            style="${invert ? "display:none;" : ""} ${style}"
          >
            ${canRenderTweetPreview
              ? html`<a
                  class="tweet-preview-container"
                  data-no-instant
                  href="${DOMPurify.sanitize(story.href)}"
                  target="_blank"
                  onclick="event.preventDefault(); navigator.sendBeacon && navigator.sendBeacon('/outbound?url=' + encodeURIComponent('${DOMPurify.sanitize(
                    story.href,
                  )}')); if (window.ReactNativeWebView || window !== window.parent) { 
                    (function() {
                      var targetUrl = '${DOMPurify.sanitize(story.href)}';
                      var canIframe = ${story.metadata && story.metadata.canIframe !== undefined ? story.metadata.canIframe : true};
                      
                      try {
                        var urlObj = new window.URL(targetUrl);
                        var hostname = urlObj.hostname.toLowerCase();
                        
                        // Domains that should always use openUrl
                        var alwaysOpenDomains = [
                          'x.com',
                          'twitter.com',
                          'www.x.com',
                          'www.twitter.com'
                        ];
                        
                        // Check if it's a Substack domain
                        var isSubstack = hostname.endsWith('.substack.com');
                        
                        var shouldAlwaysOpen = isSubstack || alwaysOpenDomains.some(function(domain) {
                          return hostname === domain || hostname.endsWith('.' + domain);
                        });
                        
                        if (shouldAlwaysOpen) {
                          if (window.sdk && window.sdk.actions && window.sdk.actions.openUrl) {
                            window.sdk.actions.openUrl(targetUrl);
                          } else {
                            window.open(targetUrl, '_blank');
                          }
                        } else if (!canIframe && window.sdk && window.sdk.actions && window.sdk.actions.openUrl) {
                          window.sdk.actions.openUrl(targetUrl);
                        } else {
                          if (window.openEmbedDrawer) {
                            window.openEmbedDrawer(targetUrl);
                          } else {
                            // Fallback if drawer not ready yet
                            window.open(targetUrl, '_blank');
                          }
                        }
                      } catch (e) {
                        // Fallback to embed on error
                        if (window.openEmbedDrawer) {
                          window.openEmbedDrawer(targetUrl);
                        } else {
                          window.open(targetUrl, '_blank');
                        }
                      }
                    })();
                  } else { window.open('${DOMPurify.sanitize(
                    story.href,
                  )}', event.currentTarget.getAttribute('target')); }"
                  style="text-decoration:none; color:inherit; display:block;"
                >
                  <div class="tweet-embed-container">
                    <div>
                      <div class="tweet-embed-header">
                        <div
                          style="display:flex; align-items:center; margin-bottom:12px;"
                        >
                          ${story.metadata.twitterAuthorAvatar
                            ? html`<img
                                src="${DOMPurify.sanitize(
                                  story.metadata.twitterAuthorAvatar,
                                )}"
                                alt="${DOMPurify.sanitize(
                                  story.metadata.twitterCreator || "Author",
                                )}"
                                width="40"
                                height="40"
                                loading="lazy"
                                style="border-radius: 50%; margin-right: 12px;"
                              />`
                            : html`<div
                                style="width: 40px; height: 40px; border-radius: 50%; background-color: #e1e8ed; margin-right: 12px; display: flex; align-items: center; justify-content: center;"
                              >
                                <svg
                                  width="24"
                                  height="24"
                                  viewBox="0 0 24 24"
                                  fill="#657786"
                                >
                                  <path
                                    d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
                                  />
                                </svg>
                              </div>`}
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="#000"
                            style="margin-right:8px;"
                          >
                            <path
                              d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
                            />
                          </svg>
                          <span
                            style="font-weight:600; color:#000000; font-size:14px;"
                            >${story.metadata.twitterCreator || "Tweet"}</span
                          >
                        </div>
                      </div>
                      <div class="tweet-embed-body">
                        <p>
                          ${DOMPurify.sanitize(
                            story.metadata.ogDescription || "",
                          )
                            .slice(0, 280)
                            .split(/(\bhttps?:\/\/[^\s]+)/g)
                            .map((part) => {
                              if (part.match(/^\bhttps?:\/\//)) {
                                return part.length > 30
                                  ? part.substring(0, 30) + "..."
                                  : part;
                              }
                              return part;
                            })
                            .join("")}${(story.metadata.ogDescription || "")
                            .length > 280
                            ? "..."
                            : ""}
                        </p>
                        ${story.metadata.image
                          ? html`
                              <div style="margin-top: 12px;">
                                <img
                                  src="${DOMPurify.sanitize(story.metadata.image)}"
                                  alt="Tweet image"
                                  style="display: block; max-width: 100%; height: auto; border-radius: 2px; max-height: 300px; object-fit: contain;"
                                  loading="lazy"
                                />
                              </div>
                            `
                          : null}
                      </div>
                    </div>
                  </div>
                </a>`
              : canRenderFarcasterPreview
              ? html`<a
                  class="farcaster-preview-container farcaster-cast-link"
                  data-no-instant
                  href="${DOMPurify.sanitize(story.href)}"
                  data-cast-hash="${story.metadata.farcasterCast &&
                  story.metadata.farcasterCast.hash
                    ? DOMPurify.sanitize(story.metadata.farcasterCast.hash)
                    : ""}"
                  target="_blank"
                  onclick="event.preventDefault(); navigator.sendBeacon && navigator.sendBeacon('/outbound?url=' + encodeURIComponent('${DOMPurify.sanitize(
                    story.href,
                  )}')); if (window.ReactNativeWebView || window !== window.parent) { 
                    (function() {
                      var targetUrl = '${DOMPurify.sanitize(story.href)}';
                      var canIframe = ${story.metadata && story.metadata.canIframe !== undefined ? story.metadata.canIframe : true};
                      
                      try {
                        var urlObj = new window.URL(targetUrl);
                        var hostname = urlObj.hostname.toLowerCase();
                        
                        // Domains that should always use openUrl
                        var alwaysOpenDomains = [
                          'x.com',
                          'twitter.com',
                          'www.x.com',
                          'www.twitter.com'
                        ];
                        
                        // Check if it's a Substack domain
                        var isSubstack = hostname.endsWith('.substack.com');
                        
                        var shouldAlwaysOpen = isSubstack || alwaysOpenDomains.some(function(domain) {
                          return hostname === domain || hostname.endsWith('.' + domain);
                        });
                        
                        if (shouldAlwaysOpen) {
                          if (window.sdk && window.sdk.actions && window.sdk.actions.openUrl) {
                            window.sdk.actions.openUrl(targetUrl);
                          } else {
                            window.open(targetUrl, '_blank');
                          }
                        } else if (!canIframe && window.sdk && window.sdk.actions && window.sdk.actions.openUrl) {
                          window.sdk.actions.openUrl(targetUrl);
                        } else {
                          if (window.openEmbedDrawer) {
                            window.openEmbedDrawer(targetUrl);
                          } else {
                            // Fallback if drawer not ready yet
                            window.open(targetUrl, '_blank');
                          }
                        }
                      } catch (e) {
                        // Fallback to embed on error
                        if (window.openEmbedDrawer) {
                          window.openEmbedDrawer(targetUrl);
                        } else {
                          window.open(targetUrl, '_blank');
                        }
                      }
                    })();
                  } else { window.open('${DOMPurify.sanitize(
                    story.href,
                  )}', event.currentTarget.getAttribute('target')); }"
                  style="text-decoration:none; color:inherit; display:block;"
                >
                  <div class="farcaster-embed-container">
                    <div>
                      <div class="farcaster-embed-metadata">
                        <div class="farcaster-embed-author-avatar-container">
                          ${story.metadata.farcasterCast?.author?.pfp
                            ? html`<img
                                src="${DOMPurify.sanitize(
                                  story.metadata.farcasterCast.author.pfp,
                                )}"
                                alt="${DOMPurify.sanitize(
                                  story.metadata.farcasterCast.author
                                    .displayName ||
                                    story.metadata.farcasterCast.author
                                      .username,
                                )}"
                                width="40"
                                height="40"
                                loading="lazy"
                                class="farcaster-embed-author-avatar"
                              />`
                            : html`<svg
                                width="24"
                                height="24"
                                viewBox="0 0 1000 1000"
                                xmlns="http://www.w3.org/2000/svg"
                                style="color: #8A63D2;"
                              >
                                <path
                                  d="M257.778 155.556H742.222V844.444H671.111V528.889H257.778V155.556Z"
                                  fill="currentColor"
                                />
                                <path
                                  d="M128.889 528.889H257.778V844.444H128.889V528.889Z"
                                  fill="currentColor"
                                />
                              </svg>`}
                        </div>
                        <div class="farcaster-embed-author">
                          <p class="farcaster-embed-author-display-name">
                            ${story.metadata.farcasterCast?.author
                              ?.displayName ||
                            story.metadata.ogTitle ||
                            "Cast"}
                          </p>
                          <p
                            class="farcaster-embed-author-username"
                            style="opacity: 0.6;"
                          >
                            @${story.metadata.farcasterCast?.author?.username ||
                            "farcaster"}
                          </p>
                        </div>
                      </div>
                      <div class="farcaster-embed-body">
                        <p>
                          ${story.metadata.farcasterCast?.text
                            ? DOMPurify.sanitize(
                                story.metadata.farcasterCast.text,
                              )
                                .slice(0, 280)
                                .split(/(\bhttps?:\/\/[^\s]+)/g)
                                .map((part) => {
                                  if (part.match(/^\bhttps?:\/\//)) {
                                    return part.length > 30
                                      ? part.substring(0, 30) + "..."
                                      : part;
                                  }
                                  return part;
                                })
                                .join("") +
                              (story.metadata.farcasterCast.text.length > 280
                                ? "..."
                                : "")
                            : DOMPurify.sanitize(
                                story.metadata.ogDescription || "",
                              )
                                .slice(0, 280)
                                .split(/(\bhttps?:\/\/[^\s]+)/g)
                                .map((part) => {
                                  if (part.match(/^\bhttps?:\/\//)) {
                                    return part.length > 30
                                      ? part.substring(0, 30) + "..."
                                      : part;
                                  }
                                  return part;
                                })
                                .join("") +
                              ((story.metadata.ogDescription || "").length > 280
                                ? "..."
                                : "")}
                        </p>
                        ${farcasterImageUrl
                          ? html`
                              <div style="height: 16px;"></div>
                              <img
                                src="${DOMPurify.sanitize(farcasterImageUrl)}"
                                alt="Cast image"
                                style="display: block; max-width: 100%; height: auto; border-radius: 2px; max-height: 300px; object-fit: contain;"
                                loading="lazy"
                              />
                            `
                          : null}
                      </div>
                    </div>
                  </div>
                </a>`
              : displayImage
              ? html` <a
                  data-no-instant
                  style="display: block; width: 100%;"
                  class="row-image-preview"
                  href="${DOMPurify.sanitize(story.href)}"
                  onclick="event.preventDefault(); navigator.sendBeacon && navigator.sendBeacon('/outbound?url=' + encodeURIComponent('${DOMPurify.sanitize(
                    story.href,
                  )}')); if (window.ReactNativeWebView || window !== window.parent) { 
                    (function() {
                      var targetUrl = '${DOMPurify.sanitize(story.href)}';
                      var canIframe = ${story.metadata && story.metadata.canIframe !== undefined ? story.metadata.canIframe : true};
                      
                      try {
                        var urlObj = new window.URL(targetUrl);
                        var hostname = urlObj.hostname.toLowerCase();
                        
                        // Domains that should always use openUrl
                        var alwaysOpenDomains = [
                          'x.com',
                          'twitter.com',
                          'www.x.com',
                          'www.twitter.com'
                        ];
                        
                        // Check if it's a Substack domain
                        var isSubstack = hostname.endsWith('.substack.com');
                        
                        var shouldAlwaysOpen = isSubstack || alwaysOpenDomains.some(function(domain) {
                          return hostname === domain || hostname.endsWith('.' + domain);
                        });
                        
                        if (shouldAlwaysOpen) {
                          if (window.sdk && window.sdk.actions && window.sdk.actions.openUrl) {
                            window.sdk.actions.openUrl(targetUrl);
                          } else {
                            window.open(targetUrl, '_blank');
                          }
                        } else if (!canIframe && window.sdk && window.sdk.actions && window.sdk.actions.openUrl) {
                          window.sdk.actions.openUrl(targetUrl);
                        } else {
                          if (window.openEmbedDrawer) {
                            window.openEmbedDrawer(targetUrl);
                          } else {
                            // Fallback if drawer not ready yet
                            window.open(targetUrl, '_blank');
                          }
                        }
                      } catch (e) {
                        // Fallback to embed on error
                        window.openEmbedDrawer(targetUrl);
                      }
                    })();
                  } else { window.open('${DOMPurify.sanitize(
                    story.href,
                  )}', event.currentTarget.getAttribute('target')); }"
                >
                  <div style="position: relative;">
                    <img
                      loading="lazy"
                      width="600"
                      height="300"
                      style="aspect-ratio: 2 / 1; object-fit:${isCloudflare
                        ? "contain"
                        : "cover"}; border-radius: 2px; width: 100%; height: auto;"
                      src="${isCloudflare
                        ? DOMPurify.sanitize(
                            story.href.endsWith("/public")
                              ? story.href.replace(
                                  "/public",
                                  "/w=600,q=80,fit=cover,f=auto",
                                )
                              : story.href + "/w=600,q=80,fit=cover,f=auto",
                          )
                        : DOMPurify.sanitize(story.metadata.image)}"
                    />
                    <span
                      style="gap: 5px; position: absolute; bottom: 8px; left: 16px; background: rgba(255,255,255,0.85); padding: 2px 4px; border-radius: 2px; font-size: 10px !important; line-height: 1; display: inline-flex; align-items: center; font-weight: normal; transform: none; z-index: 5; height: 18px;"
                    >
                      ${![
                        "farcaster.xyz",
                        "warpcast.com",
                        "hey.xyz",
                        "lens.xyz",
                        "zora.co",
                        "etherscan.io",
                        "basescan.org",
                        "arbiscan.io",
                      ].includes(extractedDomain)
                        ? html`<img
                            src="https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(
                              extractedDomain,
                            )}"
                            width="10"
                            height="10"
                            style="margin-right: 5px; display: inline-block; vertical-align: middle; width: 10px; height: 10px;"
                            loading="lazy"
                            onerror="this.style.display='none'"
                          />`
                        : ""}
                      <span style="font-size: 10px !important;"
                        >${extractedDomain}</span
                      >
                    </span>
                  </div>
                </a>`
              : null}
            <div
              class="${displayCommentPreview
                ? "with-comment-preview"
                : `without-comment-preview without-comment-preview-0x${story.index}`}"
              style="display: flex; flex-direction: column; padding: 12px 16px;"
              class:mobile-information-row
            >
              <div
                class="content-container"
                style="display: flex; align-items: start; gap: 12px; margin-bottom: 8px; width: 100%;"
              >
                <div
                  class="story-link-container-wrapper"
                  style="display:flex; justify-content: center; flex-direction: column; flex-grow: 1; line-height: 1.3;"
                >
                  <span>
                    <span class="story-link-container">
                      <a
                        data-no-instant
                        href="${path === "/submit" || path === "/demonstration"
                          ? "javascript:void(0);"
                          : isCloudflare && story.index
                          ? `/stories/${getSlug(story.title)}?index=0x${
                              story.index
                            }`
                          : DOMPurify.sanitize(story.href)}"
                        onclick="${isCloudflare && story.index
                          ? "if(!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button !== 1) document.getElementById('spinner-overlay').style.display='block'"
                          : `event.preventDefault(); navigator.sendBeacon && navigator.sendBeacon('/outbound?url=' + encodeURIComponent('${DOMPurify.sanitize(
                              story.href,
                            )}')); if (window.ReactNativeWebView || window !== window.parent) { 
                              (function() {
                                var targetUrl = '${DOMPurify.sanitize(story.href)}';
                                var canIframe = ${story.metadata && story.metadata.canIframe !== undefined ? story.metadata.canIframe : true};
                                
                                try {
                                  var urlObj = new window.URL(targetUrl);
                                  var hostname = urlObj.hostname.toLowerCase();
                                  
                                  // Domains that should always use openUrl
                                  var alwaysOpenDomains = [
                                    'x.com',
                                    'twitter.com',
                                    'www.x.com',
                                    'www.twitter.com'
                                  ];
                                  
                                  var shouldAlwaysOpen = alwaysOpenDomains.some(function(domain) {
                                    return hostname === domain || hostname.endsWith('.' + domain);
                                  });
                                  
                                  if (shouldAlwaysOpen) {
                                    if (window.sdk && window.sdk.actions && window.sdk.actions.openUrl) {
                                      window.sdk.actions.openUrl(targetUrl);
                                    } else {
                                      window.open(targetUrl, '_blank');
                                    }
                                  } else if (!canIframe && window.sdk && window.sdk.actions && window.sdk.actions.openUrl) {
                                    window.sdk.actions.openUrl(targetUrl);
                                  } else {
                                    if (window.openEmbedDrawer) {
                                      window.openEmbedDrawer(targetUrl);
                                    } else {
                                      window.open(targetUrl, '_blank');
                                    }
                                  }
                                } catch (e) {
                                  // Fallback to embed on error
                                  if (window.openEmbedDrawer) {
                                    window.openEmbedDrawer(targetUrl);
                                  } else {
                                    window.open(targetUrl, '_blank');
                                  }
                                }
                              })();
                            } else { window.open('${DOMPurify.sanitize(
                              story.href,
                            )}', event.currentTarget.getAttribute('target')); }`}"
                        data-story-link="/stories/${getSlug(
                          story.title,
                        )}?index=0x${story.index}"
                        data-external-link="${DOMPurify.sanitize(story.href)}"
                        ${isFarcasterCast &&
                        story.metadata &&
                        story.metadata.farcasterCast &&
                        story.metadata.farcasterCast.hash
                          ? `data-cast-hash="${DOMPurify.sanitize(
                              story.metadata.farcasterCast.hash,
                            )}"`
                          : ""}
                        ${isFarcasterCast
                          ? 'class="story-link farcaster-cast-link"'
                          : 'class="story-link"'}
                        target="${path === "/submit" ||
                        path === "/demonstration" ||
                        (isCloudflare && story.index)
                          ? "_self"
                          : "_blank"}"
                        style="user-select: text; line-height: 15pt; font-size: 13pt;${canRenderFarcasterPreview || canRenderTweetPreview ? ' color: rgba(0, 0, 0, 0.35);' : ''}"
                      >
                        ${story.isOriginal
                          ? html`<mark
                              style="background-color: rgba(255,255,0, 0.05); padding: 0px 2px;"
                              >${truncateLongWords(
                                DOMPurify.sanitize(
                                  story.metadata &&
                                    story.metadata.compliantTitle
                                    ? story.metadata.compliantTitle
                                    : story.title,
                                ),
                              )}</mark
                            >`
                          : html`${truncateLongWords(
                              DOMPurify.sanitize(
                                story.metadata && story.metadata.compliantTitle
                                  ? story.metadata.compliantTitle
                                  : story.title,
                              ),
                            )}`}
                      </a>
                      <span> </span>
                    </span>
                  </span>
                  <div
                    class="story-subtitle"
                    style="font-size: 9pt; margin-top: 3px;"
                  >
                    <span style="opacity: 0.8">
                      ${path !== "/stories" &&
                      story.avatars &&
                      story.avatars.length > 3 &&
                      html`
                        <span>
                          <div
                            style="margin-left: ${size /
                            2}; top: 2px; display: inline-flex; position:relative;"
                          >
                            ${story.avatars.slice(0, 5).map(
                              (avatar, index) => html`
                                <img
                                  loading="lazy"
                                  src="${avatar}"
                                  alt="avatar"
                                  width="${size}"
                                  height="${size}"
                                  style="z-index: ${index}; width: ${size}px; height:
 ${size}px; border: 1px solid #828282; border-radius: 2px; margin-left: -${size /
                                  2}px;"
                                />
                              `,
                            )}
                          </div>
                          <span style="opacity:0.6"> • </span>
                        </span>
                      `}
                      ${story.index
                        ? html`
                            <a
                              class="meta-link"
                              style="user-select: text;"
                              href="/stories/${getSlug(
                                story.title,
                              )}?index=0x${story.index}"
                              onclick="if(!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button !== 1) document.getElementById('spinner-overlay').style.display='block'"
                            >
                              ${formatDistanceToNowStrict(
                                new Date(story.timestamp * 1000),
                              )}
                            </a>
                          `
                        : html`
                            ${formatDistanceToNowStrict(
                              new Date(story.timestamp * 1000),
                            )}
                          `}
                      ${!interactive &&
                      (path === "/" ||
                        path === "/new" ||
                        path === "/best" ||
                        path === "/stories") &&
                      !isCloudflare &&
                      !displayImage
                        ? html`
                            <span class="domain-text">
                              <span style="opacity:0.6"> • </span>
                              ${![
                                "farcaster.xyz",
                                "warpcast.com",
                                "hey.xyz",
                                "lens.xyz",
                                "zora.co",
                                "etherscan.io",
                                "basescan.org",
                                "arbiscan.io",
                              ].includes(extractedDomain)
                                ? html`<img
                                    src="https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(
                                      extractedDomain,
                                    )}"
                                    width="10"
                                    height="10"
                                    style="vertical-align: middle; position: relative; top: -1px; margin-right: 3px; opacity: 0.7; display: inline-block;"
                                    loading="lazy"
                                    onerror="this.style.display='none'"
                                  />`
                                : ""}
                              <span>${extractedDomain}</span>
                            </span>
                          `
                        : ""}
                      ${story.impressions && story.impressions > 100
                        ? html`
                            <span style="opacity:0.6"> • </span>
                            <span>${story.impressions} views</span>
                          `
                        : ""}
                      <span style="opacity:0.6"> • </span>
                      ${story.identity
                        ? html`<a
                            href="${interactive
                              ? ""
                              : `/upvotes?address=${story.identity}`}"
                            class="meta-link"
                            onclick="if(!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button !== 1) document.getElementById('spinner-overlay').style.display='block'"
                            style="font-weight: 500; user-select: text;"
                          >
                            ${story.displayName}
                          </a>`
                        : path === "/demonstration"
                        ? html`<a class="meta-link" href="javascript:void(0);"
                            >${story.displayName}</a
                          >`
                        : html`<span class="meta-link">${story.displayName}</span>`}
                    </span>
                  </div>
                </div>
              </div>
              ${!interactive
                ? html`<div
                    class="interaction-bar"
                    style="display: flex; gap: 0; margin-top: 8px; padding: 0; justify-content: space-between;"
                  >
                    <div
                      data-title="${DOMPurify.sanitize(story.title)}"
                      data-href="${DOMPurify.sanitize(story.href)}"
                      data-upvoters="${JSON.stringify(story.upvoters)}"
                      class="like-button-container"
                      style="flex: 1; display: flex; justify-content: center;"
                    >
                      <button
                        class="interaction-button like-button"
                        style="min-width: 60px; padding: 8px 12px; border: none; background: transparent; border-radius: 999px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.15s ease;"
                        onmouseover="this.style.backgroundColor='rgba(249, 24, 128, 0.1)'"
                        onmouseout="this.style.backgroundColor='transparent'"
                      >
                        <span
                          class="heart-icon"
                          style="width: 20px; height: 20px; color: rgba(83, 100, 113, 1); display: flex; align-items: center; justify-content: center;"
                          >${heartSVG}</span
                        >
                        <span
                          style="font-size: 13px; color: rgba(83, 100, 113, 1); font-weight: 400;"
                          >${story.upvoters ? story.upvoters.length : 0}</span
                        >
                      </button>
                    </div>
                    ${path !== "/stories" &&
                    path !== "/demonstration" &&
                    path !== "/submit"
                      ? html`<div
                          data-story-index="0x${story.index}"
                          data-comment-count="${commentCount}"
                          class="comment-button-container"
                          style="flex: 1; display: flex; justify-content: center;"
                        >
                          <a
                            class="interaction-button comment-button"
                            id="chat-bubble-${story.index}"
                            href="/stories/${getSlug(
                              story.title,
                            )}?index=0x${story.index}"
                            onclick="event.preventDefault(); window.dispatchEvent(new CustomEvent('open-comments-0x${story.index}', { detail: { source: 'chat-bubble' } })); window.dispatchEvent(new HashChangeEvent('hashchange')); const commentPreview = document.querySelector('.comment-preview-0x${story.index}'); if (commentPreview) { commentPreview.style.opacity = 1; } const borderElem = document.querySelector('.without-comment-preview-0x${story.index}'); if (borderElem) { borderElem.classList.toggle('no-border'); }"
                            style="min-width: 60px; padding: 8px 12px; border: none; background: transparent; border-radius: 999px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.15s ease; text-decoration: none; color: inherit;"
                            onmouseover="this.style.backgroundColor='rgba(29, 155, 240, 0.1)'"
                            onmouseout="this.style.backgroundColor='transparent'"
                          >
                            <span
                              style="width: 20px; height: 20px; color: rgba(83, 100, 113, 1); display: flex; align-items: center; justify-content: center;"
                            >
                              <svg
                                style="width: 20px; height: 20px; color: rgba(83, 100, 113, 1);"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 256 256"
                              >
                                <rect width="256" height="256" fill="none" />
                                <path
                                  d="M71.58,144,32,176V48a8,8,0,0,1,8-8H168a8,8,0,0,1,8,8v88a8,8,0,0,1-8,8Z"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="16"
                                />
                                <path
                                  d="M80,144v40a8,8,0,0,0,8,8h96.42L224,224V96a8,8,0,0,0-8-8H176"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="16"
                                />
                              </svg>
                            </span>
                            ${commentCount > 0
                              ? html`<span
                                  style="font-size: 13px; color: rgba(83, 100, 113, 1); font-weight: 400;"
                                  >${commentCount}</span
                                >`
                              : ""}
                          </a>
                        </div>`
                      : ""}
                    <div
                      class="share-button-container"
                      style="flex: 1; display: flex; justify-content: center;"
                    >
                      <button
                        class="interaction-button share-button"
                        data-story-title="${DOMPurify.sanitize(story.title)}"
                        data-story-slug="${getSlug(story.title)}"
                        data-story-index="0x${story.index}"
                        style="min-width: 40px; padding: 8px; border: none; background: transparent; border-radius: 999px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;"
                        onclick="event.preventDefault(); const slug = this.getAttribute('data-story-slug'); const index = this.getAttribute('data-story-index'); const url = 'https://news.kiwistand.com/stories/' + slug + '?index=' + index; navigator.sendBeacon && navigator.sendBeacon('/share?url=' + encodeURIComponent('${DOMPurify.sanitize(
                          story.href,
                        )}') + '&type=native'); if (window.innerWidth <= 640 && navigator.share) { navigator.share({url: url}); } else { const dropdown = this.nextElementSibling; if (dropdown) { dropdown.classList.toggle('active'); document.addEventListener('click', function closeDropdown(e) { if (!e.target.closest('.share-button-container')) { dropdown.classList.remove('active'); document.removeEventListener('click', closeDropdown); } }); } }"
                        onmouseover="this.style.backgroundColor='rgba(0, 186, 124, 0.1)'"
                        onmouseout="this.style.backgroundColor='transparent'"
                      >
                        <span
                          style="width: 20px; height: 20px; color: rgba(83, 100, 113, 1); display: flex; align-items: center; justify-content: center;"
                          >${shareSVG}</span
                        >
                      </button>
                      <div class="share-dropdown">
                        <button
                          class="share-dropdown-item"
                          onclick="event.preventDefault(); event.stopPropagation(); const container = this.closest('.share-button-container'); const slug = container.querySelector('.share-button').getAttribute('data-story-slug'); const index = container.querySelector('.share-button').getAttribute('data-story-index'); const url = 'https://news.kiwistand.com/stories/' + slug + '?index=' + index; navigator.clipboard.writeText(url).then(() => { window.toast.success('Link copied!'); this.closest('.share-dropdown').classList.remove('active'); });"
                        >
                          ${CopyIcon(
                            "width: 20px; height: 20px; margin-right: 12px; color: rgba(83, 100, 113, 1);",
                          )}
                          Copy link
                        </button>
                      </div>
                    </div>
                    ${path === "/stories"
                      ? html`<div
                          class="farcaster-share-button-container"
                          style="flex: 1; display: flex; justify-content: center;"
                        >
                          <a
                            href="https://warpcast.com/~/compose?text=${encodeURIComponent(
                              DOMPurify.sanitize(story.title),
                            )}&embeds[]=${encodeURIComponent(
                              `https://news.kiwistand.com/stories/${getSlug(
                                story.title,
                              )}?index=0x${story.index}`,
                            )}"
                            target="_blank"
                            class="interaction-button farcaster-share-button"
                            data-story-title="${DOMPurify.sanitize(
                              story.title,
                            )}"
                            data-story-slug="${getSlug(story.title)}"
                            data-story-index="0x${story.index}"
                            style="min-width: 40px; padding: 8px; border: none; background: transparent; border-radius: 999px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; text-decoration: none; color: inherit;"
                            onclick="event.preventDefault(); const title = this.getAttribute('data-story-title'); const slug = this.getAttribute('data-story-slug'); const index = this.getAttribute('data-story-index'); const kiwiUrl = 'https://news.kiwistand.com/stories/' + slug + '?index=' + index; navigator.sendBeacon && navigator.sendBeacon('/share?url=' + encodeURIComponent('${DOMPurify.sanitize(
                              story.href,
                            )}') + '&type=farcaster'); if (window.isInFarcasterMiniApp && window.sdk && window.sdk.actions && window.sdk.actions.composeCast) { window.sdk.actions.composeCast({ text: title, embeds: [kiwiUrl] }); } else { const url = 'https://warpcast.com/~/compose?text=' + encodeURIComponent(title) + '&embeds[]=' + encodeURIComponent(kiwiUrl); window.open(url, '_blank'); }"
                            onmouseover="this.style.backgroundColor='rgba(124, 101, 193, 0.1)'"
                            onmouseout="this.style.backgroundColor='transparent'"
                          >
                            <span
                              style="width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;"
                              >${warpcastSvg(
                                "width: 20px; height: 20px; color: rgb(124, 101, 193);",
                              )}</span
                            >
                          </a>
                        </div>`
                      : ""}
                  </div>`
                : ""}
            </div>
            ${displayCommentPreview
              ? html` <div
                  class="comment-preview comment-preview-0x${story.index} ${displayImage ||
                  canRenderTweetPreview ||
                  canRenderFarcasterPreview
                    ? "elevating-comment-preview"
                    : "comment-preview-no-mobile-image"}"
                  style="touch-action: manipulation; user-select: none; cursor: pointer; display: flex;"
                >
                  <div
                    class="interaction-element"
                    onclick="(function(){history.replaceState(null,'','${path ===
                    "/"
                      ? `/new?cached=true#0x${story.lastComment.index}`
                      : `/#0x${story.lastComment.index}`}');history.replaceState(null,'','${path ===
                    "/"
                      ? `/#0x${story.lastComment.index}`
                      : `/new?cached=true#0x${story.lastComment.index}`}');})(),document.querySelector('.comment-preview-0x${story.index}').style.opacity = 0.5,window.addToQueue(new
 CustomEvent('open-comments-0x${story.index}',{detail:{source:'comment-preview'}}));window.dispatchEvent(new HashChangeEvent('hashchange'));"
                    style="margin: 0; padding: 12px 16px; display: flex; width: 100%; background-color: rgba(166, 110, 78, 0.03);"
                  >
                    <a
                      class="comment-preview-anchor"
                      href="${path === "/" ? "" : path}${query}#0x${story
                        .lastComment.index}"
                      style="width: 100%; display: flex; pointer-events: none;"
                    >
                      <div style="width:90%;">
                        ${story.lastComment.previousParticipants &&
                        story.lastComment.previousParticipants.length > 0 &&
                        html`
                          <div
                            style="opacity: 0.7; margin-bottom: 8px; display: flex; align-items: center;"
                          >
                            <div
                              style="display: inline-flex; position:relative;"
                            >
                              ${story.lastComment.previousParticipants.map(
                                (participant, index) => html`
                                  <img
                                    loading="lazy"
                                    src="${DOMPurify.sanitize(
                                      participant.safeAvatar,
                                    )}"
                                    alt="previous participant"
                                    width="${size}"
                                    height="${size}"
                                    style="z-index: ${index}; width: ${size}px; height: ${size}px; border: 1px solid #828282; border-radius: 2px; margin-left: ${index ===
                                    0
                                      ? "0"
                                      : "5px"};"
                                  />
                                `,
                              )}
                            </div>
                            <span
                              style="margin-left: 10px; font-size: 9pt; color: #666;"
                            >
                              Previous in thread
                            </span>
                          </div>
                        `}
                        <div style="display: flex; align-items: flex-start;">
                          ${story.lastComment.identity.safeAvatar &&
                          html`<div
                            style="width: 32px; flex-shrink: 0; margin-right: 14px;"
                          >
                            <img
                              loading="lazy"
                              src="${DOMPurify.sanitize(
                                story.lastComment.identity.safeAvatar,
                              )}"
                              alt="avatar"
                              width="32"
                              height="32"
                              style="width: 32px; height: 32px; border: 1px solid #828282; border-radius: 0;"
                            />
                          </div>`}
                          <div style="flex: 1; min-width: 0;">
                            <div
                              style="display: flex; align-items: center; gap: 5px; margin-bottom: 3px;"
                            >
                              <span
                                style="font-size: 10pt; touch-action: manipulation;user-select: none; font-weight: 500;"
                                >${DOMPurify.sanitize(
                                  story.lastComment.identity.displayName,
                                )}</span
                              >
                              <span style="opacity:0.6"> • </span>
                              <span style="font-size: 9pt; opacity: 0.9;">
                                ${formatDistanceToNowStrict(
                                  new Date(story.lastComment.timestamp * 1000),
                                )}
                                <span> </span>
                                ago
                              </span>
                            </div>
                            <span
                              class="comment-preview-text"
                              style="display: block; white-space: pre-wrap; word-break: break-word; touch-action: manipulation;user-select: none;"
                              >${truncateComment(
                                DOMPurify.sanitize(story.lastComment.title),
                              )}</span
                            >
                          </div>
                        </div>
                        <span> </span>
                      </div>
                      <div
                        style="width:10%; display: flex; align-items: center; justify-content: end; padding-right: 7px;"
                      >
                        ${expandSVG}
                      </div>
                    </a>
                  </div>
                </div>`
              : null}
            ${
              // Show full Farcaster cast content for Farcaster/Warpcast links only on /stories page
              isFarcasterCast &&
              story.metadata &&
              story.metadata.farcasterCast &&
              path === "/stories"
                ? html`<div style="margin: 0;">
                    ${FarcasterFullCast({ cast: story.metadata.farcasterCast })}
                  </div>`
                : null
            }
            ${
              // Show full Paragraph post content for Paragraph.xyz links only on /stories page
              isParagraphPost &&
              story.metadata &&
              story.metadata.paragraphPost &&
              path === "/stories"
                ? html`<div style="margin: 0;">
                    ${ParagraphFullPost({
                      post: {
                        ...story.metadata.paragraphPost,
                        url: story.href,
                      },
                    })}
                  </div>`
                : null
            }
            ${path !== "/stories"
              ? html`<div
                  class="comment-section"
                  data-comment-count="${commentCount}"
                  data-story-index="0x${story.index}"
                  data-has-preview="${displayImage ||
                  canRenderTweetPreview ||
                  canRenderFarcasterPreview
                    ? "true"
                    : "false"}"
                ></div>`
              : null}
          </div>
        </td>
      </tr>
    `;
  };
};

export const ChatsSVG = (
  style = "color: rgba(0,0,0,0.65); width: 25px;",
) => html`
  <svg
    style="${style}"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <path
      d="M71.58,144,32,176V48a8,8,0,0,1,8-8H168a8,8,0,0,1,8,8v88a8,8,0,0,1-8,8Z"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M80,144v40a8,8,0,0,0,8,8h96.42L224,224V96a8,8,0,0,0-8-8H176"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;
export default row;
