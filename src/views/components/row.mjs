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

const pin = html`<svg
  style="height: 17px; vertical-align: -3px;"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 256 256"
>
  <rect width="256" height="256" fill="none" />
  <path d="M136,127.42V232a8,8,0,0,1-16,0V127.42a56,56,0,1,1,16,0Z" />
</svg> `;

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
  pinned = false,
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
    const clicks = countOutbounds(
      story.href,
      outboundsLookbackHours,
    );
    const extractedDomain = extractDomain(DOMPurify.sanitize(story.href));
    // Use the twitterFrontends list from parser.mjs for comprehensive coverage
    const isTweet = twitterFrontends.some((domain) => {
      return (
        extractedDomain === domain || extractedDomain.endsWith(`.${domain}`)
      );
    });

    // Check if this is a Farcaster cast (only actual cast URLs)
    const isFarcasterCast = (extractedDomain === "warpcast.com" && story.href.includes("/~/conversations/")) || 
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
    const isCloudflare = isCloudflareImage(story.href);

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
      isCloudflare;

    // Check if tweet contains an X.com article link in its content
    const tweetContainsXArticle = story.metadata && 
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

    const displayMobileImage =
      !canRenderTweetPreview && // Don't use regular mobile image if we can render a tweet preview
      !canRenderFarcasterPreview && // Don't use regular mobile image if we can render a Farcaster preview
      hasImageData &&
      !interactive &&
      (path === "/" || 
        path === "/stories" ||
        path === "/new" ||
        path === "/best");

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
              : ""} ${displayMobileImage || canRenderTweetPreview || canRenderFarcasterPreview
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
                  onclick="event.preventDefault(); navigator.sendBeacon && navigator.sendBeacon('/outbound?url=' + encodeURIComponent('${DOMPurify.sanitize(story.href)}')); if (window.ReactNativeWebView || window !== window.parent) { window.sdk.actions.openUrl('${DOMPurify.sanitize(story.href)}'); } else { window.open('${DOMPurify.sanitize(story.href)}', event.currentTarget.getAttribute('target')); }"
                  style="text-decoration:none; color:inherit; display:block;"
                >
                  <div class="tweet-embed-container">
                    <div>
                      <div class="tweet-embed-header">
                        <div style="display:flex; align-items:center; margin-bottom:12px;">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="#000" style="margin-right:8px;">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                          </svg>
                          <span style="font-weight:500; color:var(--contrast-color); font-size:14px;">${story.metadata.twitterCreator || "Tweet"}</span>
                          <span style="margin-left:auto; opacity:0.5; font-size:12px;">${formatDistanceToNowStrict(new Date(story.timestamp * 1000))}</span>
                        </div>
                      </div>
                      <div class="tweet-embed-body">
                        <p>${DOMPurify.sanitize(story.metadata.ogDescription || "")
                          .slice(0, 280)
                          .split(/(\bhttps?:\/\/[^\s]+)/g)
                          .map((part) => {
                            if (part.match(/^\bhttps?:\/\//)) {
                              return part.length > 30 ? part.substring(0, 30) + "..." : part;
                            }
                            return part;
                          })
                          .join("")}${(story.metadata.ogDescription || "").length > 280 ? "..." : ""}</p>
                      </div>
                    </div>
                  </div>
                </a>`
              : canRenderFarcasterPreview
              ? html`<a
                  class="farcaster-preview-container farcaster-cast-link"
                  data-no-instant
                  href="${DOMPurify.sanitize(story.href)}"
                  data-cast-hash="${story.metadata.farcasterCast && story.metadata.farcasterCast.hash ? DOMPurify.sanitize(story.metadata.farcasterCast.hash) : ''}"
                  target="_blank"
                  onclick="event.preventDefault(); navigator.sendBeacon && navigator.sendBeacon('/outbound?url=' + encodeURIComponent('${DOMPurify.sanitize(story.href)}')); if (window.ReactNativeWebView || window !== window.parent) { ${story.metadata.farcasterCast && story.metadata.farcasterCast.hash ? `(async function() { try { var context = await window.sdk.context; if (context && context.client && context.client.clientFid === 309857) { window.sdk.actions.openUrl('https://wallet.coinbase.com/post/${DOMPurify.sanitize(story.metadata.farcasterCast.hash)}'); return; } } catch(e) {} window.sdk.actions.openUrl('${DOMPurify.sanitize(story.href)}'); })()` : `window.sdk.actions.openUrl('${DOMPurify.sanitize(story.href)}')`}; } else { window.open('${DOMPurify.sanitize(story.href)}', event.currentTarget.getAttribute('target')); }"
                  style="text-decoration:none; color:inherit; display:block;"
                >
                  <div class="farcaster-embed-container">
                    <div>
                      <div class="farcaster-embed-metadata">
                        <div class="farcaster-embed-author-avatar-container">
                          ${story.metadata.farcasterCast?.author?.pfp 
                            ? html`<img
                                src="${DOMPurify.sanitize(story.metadata.farcasterCast.author.pfp)}"
                                alt="${DOMPurify.sanitize(story.metadata.farcasterCast.author.displayName || story.metadata.farcasterCast.author.username)}"
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
                          <p class="farcaster-embed-author-display-name">${story.metadata.farcasterCast?.author?.displayName || story.metadata.ogTitle || "Cast"}</p>
                          <p class="farcaster-embed-author-username">@${story.metadata.farcasterCast?.author?.username || "farcaster"}</p>
                        </div>
                      </div>
                      <div class="farcaster-embed-body">
                        <p>${story.metadata.farcasterCast?.text 
                          ? DOMPurify.sanitize(story.metadata.farcasterCast.text)
                              .slice(0, 280)
                              .split(/(\bhttps?:\/\/[^\s]+)/g)
                              .map((part) => {
                                if (part.match(/^\bhttps?:\/\//)) {
                                  return part.length > 30 ? part.substring(0, 30) + "..." : part;
                                }
                                return part;
                              })
                              .join("") + (story.metadata.farcasterCast.text.length > 280 ? "..." : "")
                          : DOMPurify.sanitize(story.metadata.ogDescription || "")
                              .slice(0, 280)
                              .split(/(\bhttps?:\/\/[^\s]+)/g)
                              .map((part) => {
                                if (part.match(/^\bhttps?:\/\//)) {
                                  return part.length > 30 ? part.substring(0, 30) + "..." : part;
                                }
                                return part;
                              })
                              .join("") + ((story.metadata.ogDescription || "").length > 280 ? "..." : "")}</p>
                      </div>
                    </div>
                  </div>
                </a>`
              : displayMobileImage
              ? html` <a
                  data-no-instant
                  style="display: block; width: 100%;"
                  class="mobile-row-image"
                  href="${DOMPurify.sanitize(story.href)}"
                  onclick="event.preventDefault(); navigator.sendBeacon && navigator.sendBeacon('/outbound?url=' + encodeURIComponent('${DOMPurify.sanitize(story.href)}')); if (window.ReactNativeWebView || window !== window.parent) { window.sdk.actions.openUrl('${DOMPurify.sanitize(story.href)}'); } else { window.open('${DOMPurify.sanitize(story.href)}', event.currentTarget.getAttribute('target')); }"
                >
                  <div style="position: relative;">
                    <img
                      loading="lazy"
                      width="600"
                      height="300"
                      style="aspect-ratio: 2 / 1; object-fit:${isCloudflare
                        ? "contain"
                        : "cover"}; margin: 0 11px; border-radius: 2px; width: calc(100% - 24px); height: auto;"
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
                    ${isCloudflare
                      ? null
                      : html`<div
                          style="position: absolute; bottom: 8px; left: 19px; background: rgba(255,255,255,0.9); padding: 2px 6px; border-radius: 2px; font-size: 9pt; display: flex; align-items: center;"
                        >
                          ${!["farcaster.xyz", "warpcast.com", "hey.xyz", "lens.xyz", "zora.co", "etherscan.io", "basescan.org", "arbiscan.io"].includes(extractedDomain)
                            ? html`<img 
                                src="https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(extractedDomain)}"
                                width="12"
                                height="12"
                                style="margin-right: 4px; display: inline-block;"
                                loading="lazy"
                                onerror="this.style.display='none'"
                              />`
                            : ''}
                          ${extractedDomain}
                        </div>`}
                  </div>
                </a>`
              : null}
            <div
              class="information-row ${displayCommentPreview
                ? "with-comment-preview"
                : `without-comment-preview without-comment-preview-0x${story.index}`} ${displayMobileImage ||
              canRenderTweetPreview || canRenderFarcasterPreview
                ? "elevating-row"
                : ""}"
              style="display: flex; align-items: center; padding: 3px 0;"
            >
              <div
                data-title="${DOMPurify.sanitize(story.title)}"
                data-href="${DOMPurify.sanitize(story.href)}"
                data-upvoters="${JSON.stringify(story.upvoters)}"
                class="${displayMobileImage || canRenderTweetPreview || canRenderFarcasterPreview
                  ? "vote-button-container interaction-container-with-image"
                  : "vote-button-container"}"
                style="display: flex; align-self: stretch;"
              >
                <div
                  onclick="const key='--kiwi-news-upvoted-stories';const href=this.parentElement.parentElement.getAttribute('data-href');const title=this.parentElement.parentElement.getAttribute('data-title');const stories=JSON.parse(localStorage.getItem(key)||'[]');stories.push({href,title});localStorage.setItem(key,JSON.stringify(stories));window.dispatchEvent(new Event('upvote-storage'));"
                >
                  <div
                    class="interaction-element"
                    style="border-radius: 2px; border: var(--border-thin); background-color: var(--bg-off-white); display: flex; align-items: center; justify-content: center; min-width: 49px; margin: 5px 8px 5px 6px; align-self: stretch;"
                  >
                    <div style="min-height: 42px; display:block;">
                      <div class="votearrowcontainer">
                        <div>
                          <div
                            class="votearrow"
                            style="color: rgb(130, 130, 130); cursor: pointer;"
                            title="upvote"
                          >
                            ${iconSVG}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                class="content-container"
                style="display: flex; align-items: start; flex-grow: 1; gap: 8px;"
              >
                ${hasImageData &&
                !interactive &&
                !isSubstackDomain(extractedDomain) // Keep substack check specific to desktop?
                  ? html`<a
                      data-no-instant
                      href="${DOMPurify.sanitize(story.href)}"
                      class="row-image"
                      target="_blank"
                      style="user-select:text; align-self: stretch; margin: 5px 0;"
                      onclick="event.preventDefault(); navigator.sendBeacon && navigator.sendBeacon('/outbound?url=' + encodeURIComponent('${DOMPurify.sanitize(story.href)}')); if (window.ReactNativeWebView || window !== window.parent) { window.sdk.actions.openUrl('${DOMPurify.sanitize(story.href)}'); } else { window.open('${DOMPurify.sanitize(story.href)}', event.currentTarget.getAttribute('target')); }"
                    >
                      <img
                        loading="lazy"
                        width="110"
                        height="61"
                        style="max-height: 61px; border: var(--border-line); border-radius: 2px; width: 110px; height: 61px; object-fit: ${isCloudflare
                          ? "contain"
                          : "cover"};"
                        src="${isCloudflare
                          ? DOMPurify.sanitize(
                              story.href.endsWith("/public")
                                ? story.href.replace(
                                    "/public",
                                    "/w=220,q=80,fit=cover,f=auto",
                                  )
                                : story.href + "/w=220,q=80,fit=cover,f=auto",
                            )
                          : DOMPurify.sanitize(story.metadata.image)}"
                    /></a>`
                  : null}
                <div
                  class="story-link-container-wrapper"
                  style="min-height: 59px; display:flex; justify-content: center; flex-direction: column; flex-grow: 1; line-height: 1.3; padding: 4px 3px 5px 0;"
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
                          : `event.preventDefault(); navigator.sendBeacon && navigator.sendBeacon('/outbound?url=' + encodeURIComponent('${DOMPurify.sanitize(story.href)}')); if (window.ReactNativeWebView || window !== window.parent) { ${isFarcasterCast && story.metadata && story.metadata.farcasterCast && story.metadata.farcasterCast.hash ? `(async function() { try { var context = await window.sdk.context; if (context && context.client && context.client.clientFid === 309857) { window.sdk.actions.openUrl('https://wallet.coinbase.com/post/${DOMPurify.sanitize(story.metadata.farcasterCast.hash)}'); return; } } catch(e) {} window.sdk.actions.openUrl('${DOMPurify.sanitize(story.href)}'); })()` : `window.sdk.actions.openUrl('${DOMPurify.sanitize(story.href)}')`}; } else { window.open('${DOMPurify.sanitize(story.href)}', event.currentTarget.getAttribute('target')); }`}"
                        data-story-link="/stories/${getSlug(
                          story.title,
                        )}?index=0x${story.index}"
                        data-external-link="${DOMPurify.sanitize(story.href)}"
                        ${isFarcasterCast && story.metadata && story.metadata.farcasterCast && story.metadata.farcasterCast.hash ? `data-cast-hash="${DOMPurify.sanitize(story.metadata.farcasterCast.hash)}"` : ''}
                        ${isFarcasterCast ? 'class="story-link farcaster-cast-link"' : 'class="story-link"'}
                        target="${path === "/submit" ||
                        path === "/demonstration" ||
                        (isCloudflare && story.index)
                          ? "_self"
                          : "_blank"}"
                        style="user-select: text; line-height: 15pt; font-size: 13pt;"
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
                          : html`${pinned
                              ? html`${pin} `
                              : ""}${truncateLongWords(
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
                            ${story.label === "FUD"
                              ? html`<span
                                  style="vertical-align: -2px; font-size: 8pt; background-color:#FFEB3B; color:#000; padding:2px 4px; border-radius:2px; margin-right:4px; display:inline-flex; align-items:center;"
                                  ><svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 256 256"
                                    style="width:12px; height:12px; margin-right:4px;"
                                  >
                                    <rect
                                      width="256"
                                      height="256"
                                      fill="none"
                                    />
                                    <path
                                      d="M109.77,97,83.82,52a8,8,0,0,0-11.55-2.54A95.94,95.94,0,0,0,32,119.14,8.1,8.1,0,0,0,40,128H92"
                                      fill="none"
                                      stroke="currentColor"
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                      stroke-width="16"
                                    />
                                    <path
                                      d="M146.23,97l26-44.94a8,8,0,0,1,11.55-2.54A95.94,95.94,0,0,1,224,119.14a8.1,8.1,0,0,1-8,8.86H164"
                                      fill="none"
                                      stroke="currentColor"
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                      stroke-width="16"
                                    />
                                    <path
                                      d="M146,159.18l25.83,44.73a8,8,0,0,1-3.56,11.26,96.24,96.24,0,0,1-80.54,0,8,8,0,0,1-3.56-11.26L110,159.18"
                                      fill="none"
                                      stroke="currentColor"
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                      stroke-width="16"
                                    />
                                    <circle cx="128" cy="128" r="12" /></svg
                                  >FUD</span
                                >`
                              : ""}
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
                      (path === "/" || path === "/new" || path === "/best" || path === "/stories") &&
                      !isCloudflare
                        ? html`
                            <span class="domain-text">
                              <span style="opacity:0.6"> • </span>
                              ${!["farcaster.xyz", "warpcast.com", "hey.xyz", "lens.xyz", "zora.co", "etherscan.io", "basescan.org", "arbiscan.io"].includes(extractedDomain)
                                ? html`<img 
                                    src="https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(extractedDomain)}"
                                    width="10"
                                    height="10"
                                    style="vertical-align: middle; position: relative; top: -1px; margin-right: 3px; opacity: 0.7; display: inline-block;"
                                    loading="lazy"
                                    onerror="this.style.display='none'"
                                  />`
                                : ''}
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
                        : story.displayName === "Feedbot"
                        ? html`<span
                            class="meta-link"
                            style="touch-action: manipulation; user-select: none; display: inline-flex; align-items: center; vertical-align: -1px;"
                          >
                            <svg
                              style="width: 12px; height: 12px; margin-right: 4px; vertical-align: -1px;"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 256 256"
                            >
                              <rect width="256" height="256" fill="none" />
                              <path
                                d="M88,64a.12.12,0,0,0-.12.12A.12.12,0,0,0,88,64Z"
                                opacity="0.2"
                              />
                              <path
                                d="M216,48H40A16,16,0,0,0,24,64V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48ZM40,64H216v32H40ZM216,192H40V112H216v80Zm-16-24a8,8,0,0,1-8,8H152a8,8,0,0,1,0-16h40A8,8,0,0,1,200,168Zm0-32a8,8,0,0,1-8,8H104a8,8,0,0,1,0-16h88A8,8,0,0,1,200,136Z"
                              />
                            </svg>
                            ${story.displayName}
                          </span>`
                        : html`<a
                            target="_blank"
                            class="meta-link"
                            style="touch-action: manipulation; user-select: none;"
                            href="https://paragraph.xyz/@kiwi-updates/kiwi-feedbot-submissions-open"
                            >${story.displayName}</a
                          >`}
                      <span>
                        ${path === "/" ||
                        path === "/new" ||
                        interactive ||
                        hideCast
                          ? null
                          : html`
                              <span class="share-container">
                                <span style="opacity:0.6"> • </span>
                                <a
                                  href="#"
                                  class="caster-link share-link"
                                  title="Share"
                                  data-story-slug="${getSlug(story.title)}"
                                  data-story-index="0x${story.index}"
                                  style="color: var(--contrast-color); touch-action: manipulation; user-select: none; white-space: nowrap;"
                                  onclick="event.preventDefault(); const slug = this.getAttribute('data-story-slug'); const index = this.getAttribute('data-story-index'); const url = 'https://news.kiwistand.com/stories/' + slug + '?index=' + index; navigator.sendBeacon && navigator.sendBeacon('/share?url=' + encodeURIComponent('${DOMPurify.sanitize(story.href)}') + '&type=native'); navigator.share({url: url});"
                                >
                                  ${ShareIcon(
                                    "padding: 0 3px 1px 0; vertical-align: bottom; height: 13px; width: 13px;",
                                  )}
                                  Share Kiwi link
                                </a>
                              </span>
                            `}
                        ${interactive ||
                        hideCast ||
                        story.displayName === "Feedbot"
                          ? null
                          : html`
                              <span class="inverse-share-container">
                                <span style="opacity:0.6"> • </span>
                                <a
                                  href="https://news.kiwistand.com/stories/${getSlug(
                                    story.title,
                                  )}?index=0x${story.index}"
                                  class="meta-link share-link"
                                  title="Share"
                                  data-story-slug="${getSlug(story.title)}"
                                  data-story-index="0x${story.index}"
                                  style="color: var(--contrast-color); touch-action: manipulation; user-select: none; white-space: nowrap;"
                                  onclick="event.preventDefault(); const slug = this.getAttribute('data-story-slug'); const index = this.getAttribute('data-story-index'); const url = 'https://news.kiwistand.com/stories/' + slug + '?index=' + index; navigator.sendBeacon && navigator.sendBeacon('/share?url=' + encodeURIComponent('${DOMPurify.sanitize(story.href)}') + '&type=copy'); navigator.clipboard.writeText(url); window.toast.success('Link copied!');"
                                >
                                  ${CopyIcon(
                                    "padding: 0 3px 1px 0; vertical-align: bottom; height: 13px; width: 13px;",
                                  )}
                                  Copy Kiwi link
                                </a>
                              </span>
                            `}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
              ${path === "/stories"
                ? html`<div
                    class="${displayMobileImage || canRenderTweetPreview || canRenderFarcasterPreview
                      ? "interaction-container-with-image"
                      : ""}"
                    style="display: flex; align-self: stretch;"
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
                      class="interaction-element"
                      title="Share to Farcaster"
                      data-story-title="${DOMPurify.sanitize(story.title)}"
                      data-story-slug="${getSlug(story.title)}"
                      data-story-index="0x${story.index}"
                      style="border-radius: 2px; border: var(--border-thin); background-color: rgba(124, 101, 193, 0.5); display: flex; align-items: center; justify-content: center; min-width: 49px; margin: 5px 8px 5px 6px; align-self: stretch; cursor: pointer; text-decoration: none;"
                      onclick="event.preventDefault(); const title = this.getAttribute('data-story-title'); const slug = this.getAttribute('data-story-slug'); const index = this.getAttribute('data-story-index'); const kiwiUrl = 'https://news.kiwistand.com/stories/' + slug + '?index=' + index; navigator.sendBeacon && navigator.sendBeacon('/share?url=' + encodeURIComponent('${DOMPurify.sanitize(story.href)}') + '&type=farcaster'); if (window.isInFarcasterMiniApp && window.sdk && window.sdk.actions && window.sdk.actions.composeCast) { window.sdk.actions.composeCast({ text: title, embeds: [kiwiUrl] }); } else if (window.ReactNativeWebView || window !== window.parent) { const url = 'https://warpcast.com/~/compose?text=' + encodeURIComponent(title) + '&embeds[]=' + encodeURIComponent(kiwiUrl); window.sdk.actions.openUrl(url); } else { const url = 'https://warpcast.com/~/compose?text=' + encodeURIComponent(title) + '&embeds[]=' + encodeURIComponent(kiwiUrl); window.open(url, '_blank'); }"
                    >
                      <div style="min-height: 42px; display:block;">
                        <div
                          style="display: flex; align-items: center; justify-content: center; height: 100%;"
                        >
                          ${warpcastSvg(
                            "width: 24px; height: 24px; color: white;",
                          )}
                        </div>
                      </div>
                    </a>
                  </div>`
                : ""}
              ${path !== "/stories" &&
              path !== "/demonstration" &&
              path !== "/submit"
                ? html`<div
                    data-story-index="0x${story.index}"
                    data-comment-count="${commentCount}"
                    class="${displayMobileImage || canRenderTweetPreview || canRenderFarcasterPreview
                      ? "interaction-container-with-image chat-bubble-container"
                      : "chat-bubble-container"}"
                    style="display: flex; align-self: stretch;"
                  >
                    <a
                      class="chat-bubble interaction-element"
                      id="chat-bubble-${story.index}"
                      href="/stories/${getSlug(
                        story.title,
                      )}?index=0x${story.index}"
                      onclick="if(!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button !== 1) document.getElementById('spinner-overlay').style.display='block'"
                      style="margin: 5px; border: var(--border-thin); background-color: var(--bg-off-white); border-radius: 2px; display: ${path ===
                      "/stories"
                        ? "none"
                        : "flex"}; justify-content: center; min-width: 49px; align-items: center; flex-direction: column;"
                    >
                      ${ChatsSVG()}
                      <span
                        id="comment-count-${story.index}"
                        style="color: rgba(0,0,0,0.65); font-size: 8pt; font-weight: bold;"
                        >${commentCount}</span
                      >
                    </a>
                  </div>`
                : ""}
            </div>
            ${displayCommentPreview
              ? html` <div
                  class="comment-preview comment-preview-0x${story.index} ${displayMobileImage ||
                  canRenderTweetPreview || canRenderFarcasterPreview
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
                    style="margin: 0 5px 5px 5px; padding: 11px; border: var(--border); border-top: rgba(166, 110, 78, 0.075); display: flex;width: 100%; background-color: var(--bg-off-white); border-radius: 2px;"
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
                          html`<div style="width: 32px; flex-shrink: 0; margin-right: 14px;">
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
            ${// Show full Farcaster cast content for Farcaster/Warpcast links only on /stories page
            (isFarcasterCast && story.metadata && story.metadata.farcasterCast && path === "/stories")
              ? html`<div style="margin: 0;">
                  ${FarcasterFullCast({ cast: story.metadata.farcasterCast })}
                </div>`
              : null}
            ${// Show full Paragraph post content for Paragraph.xyz links only on /stories page
            (isParagraphPost && story.metadata && story.metadata.paragraphPost && path === "/stories")
              ? html`<div style="margin: 0;">
                  ${ParagraphFullPost({ post: { ...story.metadata.paragraphPost, url: story.href } })}
                </div>`
              : null}
            ${path !== "/stories"
              ? html`<div
                  class="comment-section"
                  data-comment-count="${commentCount}"
                  data-story-index="0x${story.index}"
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
