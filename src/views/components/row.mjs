import { env } from "process";
import htm from "htm";
import vhtml from "vhtml";
import {
  differenceInHours,
  formatDistanceToNowStrict as originalFormatDistance,
} from "date-fns";
import { URL } from "url";
import DOMPurify from "isomorphic-dompurify";
import { getSlug, isCloudflareImage } from "../../utils.mjs";

import { countOutbounds, countComments } from "../../cache.mjs";
import log from "../../logger.mjs";
import { twitterFrontends } from "../../parser.mjs";
import ParagraphFullPost from "./paragraph-full-post.mjs";
import * as karma from "../../karma.mjs";
import {
  getImageLoading,
  sizedImageUrl,
} from "../utils/imageLoading.mjs";
import {
  splitQuote,
  splitReply,
  isDeletedTweet,
  tweetHandle,
} from "../../quote.mjs";
import { ms } from "./icons.mjs";
import { Tag } from "./communities.mjs";

let domain = "https://news.kiwistand.com";
if (env.CUSTOM_PROTOCOL && env.CUSTOM_HOST_NAME) {
  const [hostname] = env.CUSTOM_HOST_NAME.split(":");
  domain = `${env.CUSTOM_PROTOCOL}${hostname}`;
}

const html = htm.bind(vhtml);

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

const aiSparkleSVG = html`
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
    width="20"
    height="20"
  >
    <rect width="256" height="256" fill="none" />
    <path
      d="M84.27,171.73l-55.09-20.3a7.92,7.92,0,0,1,0-14.86l55.09-20.3,20.3-55.09a7.92,7.92,0,0,1,14.86,0l20.3,55.09,55.09,20.3a7.92,7.92,0,0,1,0,14.86l-55.09,20.3-20.3,55.09a7.92,7.92,0,0,1-14.86,0Z"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <line x1="176" y1="16" x2="176" y2="64" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16" />
    <line x1="224" y1="72" x2="224" y2="104" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16" />
    <line x1="152" y1="40" x2="200" y2="40" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16" />
    <line x1="208" y1="88" x2="240" y2="88" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16" />
  </svg>
`;

const expandSVG = html`
  <svg
    style="color: var(--text-primary); height: 1rem;"
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


const spinnerOnclick =
  "if(!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button !== 1) {var el=document.getElementById('spinner-overlay'); if(el) el.style.display='block';}";
const shareOnclick = "event.preventDefault(); const slug = this.getAttribute('data-story-slug'); const index = this.getAttribute('data-story-index'); const href = this.getAttribute('data-story-href'); const url = 'https://news.kiwistand.com/stories/' + slug + '?index=' + index; if (typeof window.kiwiTrackShare === 'function') { window.kiwiTrackShare(href, 'native'); } if (window.innerWidth <= 640 && navigator.share) { navigator.share({url: url}).catch(function(){}); } else { const doCopy = async () => { try { await navigator.clipboard.writeText(url); if (window.toast && window.toast.success) { window.toast.success('Link copied!'); } } catch (err) { try { const ta = document.createElement('textarea'); ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); if (window.toast && window.toast.success) { window.toast.success('Link copied!'); } } catch (e2) { if (window.toast && window.toast.error) { window.toast.error('Could not copy link'); } } } }; doCopy(); }";
const commentOnclick = "event.preventDefault(); var si=this.dataset.storyIdx; this.classList.toggle('comment-button-active'); window.dispatchEvent(new CustomEvent('open-comments-0x'+si, { detail: { source: 'chat-bubble' } })); window.dispatchEvent(new HashChangeEvent('hashchange')); var commentPreview = document.querySelector('.comment-preview-0x'+si); if (commentPreview) { commentPreview.style.opacity = 1; } var borderElem = document.querySelector('.without-comment-preview-0x'+si); if (borderElem) { borderElem.classList.toggle('no-border'); }";

// NOTE: The comment preview under a feed row opens the comments inline, like
// the chat bubble, and lands on the previewed comment (the last one):
// scrolled to and highlighted via its #0x anchor. Cmd/Ctrl/Shift/middle
// click keeps the link to the story page.
const previewOnclick = "if(event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1) return; event.preventDefault(); var si=this.dataset.storyIdx; history.replaceState(null, '', location.pathname + location.search + '#0x' + this.dataset.commentIdx); window.dispatchEvent(new CustomEvent('open-comments-0x'+si, { detail: { source: 'comment-preview' } })); window.dispatchEvent(new HashChangeEvent('hashchange')); var cb=document.getElementById('chat-bubble-'+si); if (cb) cb.classList.add('comment-button-active');";

const commentsSVG = html`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" aria-hidden="true">
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

// Phosphor "bookmark-simple", like the design's save button. The filled
// one shows once the story is saved (bookmarks.mjs in the web bundle).
export const bookmarkSVG = html`
  <svg class="kn-save-off" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" aria-hidden="true">
    <rect width="256" height="256" fill="none" />
    <path
      d="M192,224l-64-40L64,224V48a8,8,0,0,1,8-8H184a8,8,0,0,1,8,8Z"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;
export const bookmarkFullSVG = html`
  <svg class="kn-save-on" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" aria-hidden="true">
    <rect width="256" height="256" fill="none" />
    <path
      d="M192,224l-64-40L64,224V48a8,8,0,0,1,8-8H184a8,8,0,0,1,8,8Z"
      fill="currentColor"
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

const convertBrTagsToNewlines = (text) => {
  if (!text) return text;
  return text.replace(/<br\s*\/?>/gi, '\n');
};

// NOTE: An embed image is rendered at 100% width with height:auto, so its
// width/height attributes set the box the browser reserves before the image
// loads. With a placeholder ratio, a taller image makes the row grow when it
// arrives (layout shift). Use the real size when the metadata has it; older
// cache entries without it keep the 16:9 placeholder.
export function embedImageSize(width, height) {
  const w = Number(width);
  const h = Number(height);
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
    return { width: Math.round(w), height: Math.round(h) };
  }
  return { width: 600, height: 338 };
}

export function extractDomain(link) {
  // Return empty string for text posts (data: and kiwi: URLs)
  if (link.startsWith('data:') || link.startsWith('kiwi:')) {
    return '';
  }
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
  // NOTE: Unused since the comment preview links to the comment on the story
  // page (like notifications do); kept so callers' positional arguments stay.
  query = "",
  debugMode = false,
  isAboveFold = false,
) => {
  const size = 12;
  return (story, i) => {
    // Skip URL validation for text posts (data: and kiwi: URLs)
    if (!story.href.startsWith('data:') && !story.href.startsWith('kiwi:')) {
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
    }

    const submissionId = `kiwi:0x${story.index}`;
    let commentCount;
    try {
      commentCount = countComments(submissionId);
    } catch (err) {
      commentCount = 0;
    }
    const outboundsLookbackHours = 24 * 5;
    const clicks = countOutbounds(story.href, outboundsLookbackHours);
    const extractedDomain = extractDomain(DOMPurify.sanitize(story.href));
    // Use the twitterFrontends list from parser.mjs for comprehensive coverage
    const isTweet =
      twitterFrontends.some((domain) => {
        return (
          extractedDomain === domain || extractedDomain.endsWith(`.${domain}`)
        );
      }) ||
      (extractedDomain === "firefly.social" &&
        story.href.includes("/post/x/"));

    // Check if this is a Farcaster cast (only actual cast URLs)
    const isFarcasterCast =
      (extractedDomain === "warpcast.com" &&
        story.href.includes("/~/conversations/")) ||
      extractedDomain === "warpcast.com" ||
      extractedDomain === "farcaster.xyz" ||
      (story.href.includes("farcaster.xyz/") &&
        !story.href.includes("miniapps.farcaster.xyz") &&
        !story.href.includes("docs.farcaster.xyz") &&
        !story.href.includes("api.farcaster.xyz")) ||
      (extractedDomain === "firefly.social" &&
        story.href.includes("/post/farcaster/"));

    // Check if this is a Bluesky post
    const isBlueskyPost =
      extractedDomain === "bsky.app" && story.href.includes("/post/");

    // Check if this is a Paragraph.xyz post
    const isParagraphPost = extractedDomain === "paragraph.xyz";

    // Check if the story itself is older than 12 hours
    const storyAgeHours = differenceInHours(
      new Date(),
      new Date(story.timestamp * 1000),
    );
    const isStoryOlderThan12Hours = storyAgeHours > 12;
    const isStoryNew = storyAgeHours <= 4;

    // Check if the image is a Cloudflare image
    const isCloudflare = isCloudflareImage(story.href) || (debugMode && story.href && story.href.includes("placehold.co"));

    // Check if this is a text post (data: or kiwi: URL)
    const isTextPost = story.href && (story.href.startsWith('data:') || story.href.startsWith('kiwi:'));

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
    const tweetDeleted = isTweet && isDeletedTweet(story.metadata);
    const canRenderTweetPreview =
      isTweet &&
      !tweetDeleted &&
      story.metadata &&
      story.metadata.ogDescription &&
      !tweetContainsXArticle &&
      !story.metadata.isXArticle &&
      // If the tweet is primarily video, avoid rendering text-only faux screenshot
      !story.metadata.hasVideo;

    // Check if we have what we need to render a Farcaster cast preview
    const canRenderFarcasterPreview =
      isFarcasterCast &&
      story.metadata &&
      story.metadata.farcasterCast;

    // Check if we have what we need to render a Bluesky post preview
    const canRenderBlueskyPreview =
      isBlueskyPost && story.metadata && story.metadata.blueskyPost;

    // Real image sizes from the metadata (see embedImageSize)
    const tweetImageSize = embedImageSize(
      story.metadata?.imageWidth,
      story.metadata?.imageHeight,
    );
    const blueskyImageSize = embedImageSize(
      story.metadata?.blueskyPost?.imageSizes?.[0]?.width,
      story.metadata?.blueskyPost?.imageSizes?.[0]?.height,
    );

    // Extract first image from Farcaster cast embeds
    let farcasterImageUrl = null;
    let farcasterImageSize = embedImageSize();
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
        // Neynar reports the embed's image size as width_px/height_px.
        farcasterImageSize = embedImageSize(
          imageEmbed.metadata?.image?.width_px,
          imageEmbed.metadata?.image?.height_px,
        );
      }
    }

    // Check if we can render a text post preview and extract text content
    // Only show on story page, not on feeds
    let textPostContent = null;
    const canRenderTextPostPreview =
      isTextPost &&
      story.href &&
      story.href.startsWith('data:text/plain,') &&
      path === "/stories";

    if (canRenderTextPostPreview) {
      try {
        textPostContent = decodeURIComponent(story.href.replace('data:text/plain,', ''));
      } catch (err) {
        // If decoding fails, don't render text preview
        textPostContent = null;
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

    // NOTE: NEU 2 story card. Every part is a direct child of .content-row
    // (a flex column), so CSS can put the picture first on phones (like the
    // iOS app) and below the title on desktop.
    const position = (start || 0) + (i || 0) + 1;
    const showRank =
      !interactive && (path === "/" || path === "/new" || path === "/best");
    const sourceLabel = isTextPost ? "text post" : extractedDomain;
    const hasEmbed =
      canRenderTweetPreview ||
      canRenderFarcasterPreview ||
      canRenderBlueskyPreview;
    const storyPath = `/stories/${getSlug(story.title)}?index=0x${story.index}`;
    const outboundOnclick = `var el=this; event.preventDefault(); navigator.sendBeacon && navigator.sendBeacon('/outbound?url=' + encodeURIComponent(el.dataset.href)); if (window.ReactNativeWebView || window !== window.parent) {
                    (function() {
                      var targetUrl = el.dataset.href;
                      var canIframe = el.dataset.canIframe === 'true';

                      try {
                        var urlObj = new window.URL(targetUrl);
                        var hostname = urlObj.hostname.toLowerCase();

                        // Domains that should always use openUrl
                        var alwaysOpenDomains = [
                          'x.com',
                          'twitter.com',
                          'www.x.com',
                          'www.twitter.com',
                          'farcaster.xyz',
                          'warpcast.com'
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
                  } else { window.open(el.dataset.href, el.getAttribute('target') || '_blank'); }`;
    const embedBlock = canRenderTweetPreview
              ? html`<a
                  class="tweet-preview-container"
                  data-no-instant
                  href="${DOMPurify.sanitize(story.href)}"
                  target="_blank"
                  data-href="${DOMPurify.sanitize(story.href)}"
                  data-can-iframe="${story.metadata && story.metadata.canIframe !== undefined ? story.metadata.canIframe : true}"
                  onclick="var el=this; event.preventDefault(); navigator.sendBeacon && navigator.sendBeacon('/outbound?url=' + encodeURIComponent(el.dataset.href)); if (window.ReactNativeWebView || window !== window.parent) {
                    (function() {
                      var targetUrl = el.dataset.href;
                      var canIframe = el.dataset.canIframe === 'true';
                      
                      try {
                        var urlObj = new window.URL(targetUrl);
                        var hostname = urlObj.hostname.toLowerCase();
                        
                        // Domains that should always use openUrl
                        var alwaysOpenDomains = [
                          'x.com',
                          'twitter.com',
                          'www.x.com',
                          'www.twitter.com',
                          'farcaster.xyz',
                          'warpcast.com'
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
                  } else { window.open(el.dataset.href, el.getAttribute('target') || '_blank'); }"
                  style="text-decoration:none; color:inherit; display:block;"
                  aria-label="${DOMPurify.sanitize(story.title)}"
                >
                  <div class="tweet-embed-container">
                    <div>
                      <div style="display: flex; align-items: center; margin-bottom: 12px;">
                        ${story.metadata.twitterAuthorAvatar
                          ? html`<div style="width: 20px; height: 20px; border-radius: 50%; overflow: hidden; margin-right: 8px; flex-shrink: 0;">
                              <img
                                src="${DOMPurify.sanitize(
                                  story.metadata.twitterAuthorAvatar,
                                )}"
                                alt="${DOMPurify.sanitize(
                                  story.metadata.twitterCreator || "Author",
                                )}"
                                width="20"
                                height="20"
                                loading="${getImageLoading(isAboveFold, story.metadata.twitterAuthorAvatar)}"
                                style="object-fit: cover; display: block;"
                              /></div>`
                          : html`<div
                              style="width: 20px; height: 20px; border-radius: 50%; background-color: var(--button-bg); margin-right: 8px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;"
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="#657786"
                              >
                                <path
                                  d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
                                />
                              </svg>
                            </div>`}
                        <span style="font-weight: 600; color: var(--embed-twitter-text); font-size: 14px;">
                          ${story.metadata.twitterCreator || "@tweet"}
                        </span>
                      </div>
                      <div class="tweet-embed-body">
                        ${(() => {
                          const { replyTo } = splitReply(convertBrTagsToNewlines((story.metadata.ogDescription || "").trim()));
                          if (!replyTo) return "";
                          return html`<div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">
                            Replying to ${DOMPurify.sanitize(replyTo.join(" "))}
                          </div>`;
                        })()}
                        <p style="white-space: pre-wrap;">
                          ${(() => {
                            const linkifyNodes = (text) => {
                              const parts = text.split(/(\bhttps?:\/\/[^\s]+)/g);
                              return parts.map((part) => {
                                if (/^\bhttps?:\/\//.test(part)) {
                                  const display = part.length > 40 ? part.substring(0, 40) + "…" : part;
                                  return html`<span style="text-decoration:underline;">${DOMPurify.sanitize(display)}</span>`;
                                }
                                return DOMPurify.sanitize(part);
                              });
                            };
                            const desc = splitQuote(splitReply(convertBrTagsToNewlines((story.metadata.ogDescription || "").trim())).text).text;
                            if (/^https?:\/\/\S+$/i.test(desc)) {
                              return html`<span style="text-decoration:underline;">${DOMPurify.sanitize(desc)}</span>`;
                            }
                            const nodes = linkifyNodes(desc);
                            return html`${nodes}`;
                          })()}
                        </p>
                        ${(() => {
                          const { quote } = splitQuote(splitReply(convertBrTagsToNewlines((story.metadata.ogDescription || "").trim())).text);
                          if (!quote) return "";
                          return html`<div
                            style="margin-top: 10px; padding: 10px; border: 1px solid color-mix(in srgb, var(--embed-twitter-text) 28%, transparent); background: color-mix(in srgb, var(--embed-twitter-text) 5%, transparent); border-radius: 4px;"
                          >
                            <div style="font-weight: 600; font-size: 13px; color: var(--embed-twitter-text); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                              ${DOMPurify.sanitize(quote.author)}
                            </div>
                            <p style="white-space: pre-wrap; margin: 0; font-size: 14px; display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden;">${DOMPurify.sanitize(quote.text)}</p>
                          </div>`;
                        })()}
                        ${story.metadata.image
                          ? html`
                              <div
                                style="margin-top: 12px; width: 100%; container-type: inline-size; background: var(--button-bg); overflow: hidden; border-radius: 2px; border: 1px solid rgba(0,0,0,0.1);"
                              >
                                <img
                                  src="${DOMPurify.sanitize(sizedImageUrl(story.metadata.image, 600))}"
                                  alt="Tweet image"
                                  width="${tweetImageSize.width}"
                                  height="${tweetImageSize.height}"
                                  style="width: 100%; height: auto; max-height: 600px; max-height: 125cqw; object-fit: cover; display: block;"
                                  loading="${getImageLoading(isAboveFold, story.metadata.image)}"
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
                  data-href="${DOMPurify.sanitize(story.href)}"
                  data-can-iframe="${story.metadata && story.metadata.canIframe !== undefined ? story.metadata.canIframe : true}"
                  onclick="var el=this; event.preventDefault(); navigator.sendBeacon && navigator.sendBeacon('/outbound?url=' + encodeURIComponent(el.dataset.href)); if (window.ReactNativeWebView || window !== window.parent) {
                    (function() {
                      var targetUrl = el.dataset.href;
                      var canIframe = el.dataset.canIframe === 'true';
                      
                      try {
                        var urlObj = new window.URL(targetUrl);
                        var hostname = urlObj.hostname.toLowerCase();
                        
                        // Domains that should always use openUrl
                        var alwaysOpenDomains = [
                          'x.com',
                          'twitter.com',
                          'www.x.com',
                          'www.twitter.com',
                          'farcaster.xyz',
                          'warpcast.com'
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
                  } else { window.open(el.dataset.href, el.getAttribute('target') || '_blank'); }"
                  style="text-decoration:none; color:inherit; display:block;"
                >
                  <div class="farcaster-embed-container">
                    <div>
                      <div style="display: flex; align-items: center; margin-bottom: 12px;">
                        ${story.metadata.farcasterCast?.author?.pfp
                          ? html`<img
                              src="${DOMPurify.sanitize(
                                sizedImageUrl(story.metadata.farcasterCast.author.pfp, 72),
                              )}"
                              alt="${DOMPurify.sanitize(
                                story.metadata.farcasterCast.author.username || "farcaster",
                              )}"
                              width="20"
                              height="20"
                              loading="${getImageLoading(isAboveFold, story.metadata.farcasterCast.author.pfp)}"
                              style="border-radius: 9999px; margin-right: 8px;"
                            />`
                          : html`<svg
                              width="20"
                              height="20"
                              viewBox="0 0 1000 1000"
                              xmlns="http://www.w3.org/2000/svg"
                              style="color: var(--color-farcaster-light); margin-right: 8px;"
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
                        <span style="font-weight: 600; color: var(--embed-farcaster-text); font-size: 14px;">
                          @${story.metadata.farcasterCast?.author?.username || "farcaster"}
                        </span>
                      </div>
                      <div class="farcaster-embed-body">
                        <p>
                          ${(() => {
                            const linkifyNodes = (text) => {
                              const parts = text.split(/(\bhttps?:\/\/[^\s]+)/g);
                              return parts.map((part) => {
                                if (/^\bhttps?:\/\//.test(part)) {
                                  const display = part.length > 40 ? part.substring(0, 40) + "…" : part;
                                  return html`<span style="text-decoration:underline;">${DOMPurify.sanitize(display)}</span>`;
                                }
                                return DOMPurify.sanitize(part);
                              });
                            };

                            if (story.metadata.farcasterCast?.text) {
                              const text = story.metadata.farcasterCast.text.trim();
                              if (/^https?:\/\/\S+$/i.test(text)) {
                                return html`<span style="text-decoration:underline;">${DOMPurify.sanitize(text)}</span>`;
                              }
                              return html`${linkifyNodes(text)}`;
                            }
                            const desc = (story.metadata.ogDescription || "").trim();
                            if (/^https?:\/\/\S+$/i.test(desc)) {
                              return html`<span style="text-decoration:underline;">${DOMPurify.sanitize(desc)}</span>`;
                            }
                            if (desc.length <= 280) {
                              const nodes = linkifyNodes(desc);
                              return html`${nodes}`;
                            }
                            const preview = desc.slice(0, 280);
                            const rest = desc.slice(280);
                            return html`<details style="display:inline;"><summary style="display:inline; list-style:none; cursor:pointer;">${linkifyNodes(preview)}<span style="opacity:0.6;">… <span style="text-decoration:underline;">show more</span></span></summary>${linkifyNodes(rest)}</details>`;
                          })()}
                        </p>
                        ${farcasterImageUrl
                          ? html`
                              <div style="margin-top: 12px; width: 100%; container-type: inline-size; background: var(--button-bg); border-radius: 2px; overflow: hidden;">
                                <img
                                  src="${DOMPurify.sanitize(sizedImageUrl(farcasterImageUrl, 600))}"
                                  alt="Cast image"
                                  width="${farcasterImageSize.width}"
                                  height="${farcasterImageSize.height}"
                                  style="width: 100%; height: auto; max-height: 600px; max-height: 125cqw; object-fit: cover; display: block; border-radius: 2px;"
                                  loading="${getImageLoading(isAboveFold, farcasterImageUrl)}"
                                />
                              </div>
                            `
                          : null}
                      </div>
                    </div>
                  </div>
                </a>`
              : canRenderBlueskyPreview
              ? html`<a
                  class="bluesky-preview-container"
                  data-no-instant
                  href="${DOMPurify.sanitize(story.href)}"
                  target="_blank"
                  data-href="${DOMPurify.sanitize(story.href)}"
                  onclick="event.preventDefault(); navigator.sendBeacon && navigator.sendBeacon('/outbound?url=' + encodeURIComponent(this.dataset.href)); window.open(this.dataset.href, '_blank');"
                  style="text-decoration:none; color:inherit; display:block;"
                >
                  <div class="bluesky-embed-container">
                    <div>
                      <div style="display: flex; align-items: center; margin-bottom: 12px;">
                        ${story.metadata.blueskyPost.author.avatar
                          ? html`<img
                              src="${DOMPurify.sanitize(
                                story.metadata.blueskyPost.author.avatar,
                              )}"
                              alt="${DOMPurify.sanitize(
                                story.metadata.blueskyPost.author.handle ||
                                  "bluesky",
                              )}"
                              width="20"
                              height="20"
                              loading="${getImageLoading(isAboveFold, story.metadata.blueskyPost.author.avatar)}"
                              style="border-radius: 9999px; margin-right: 8px;"
                            />`
                          : html`<svg
                              width="20"
                              height="20"
                              viewBox="0 0 600 530"
                              xmlns="http://www.w3.org/2000/svg"
                              style="color: var(--color-bluesky); margin-right: 8px; flex-shrink: 0;"
                            >
                              <path
                                d="m135.72 44.03c66.496 49.921 138.02 151.14 164.28 205.46 26.262-54.316 97.782-155.54 164.28-205.46 47.98-36.021 125.72-63.892 125.72 24.795 0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.3797-3.6904-10.832-3.7077-7.8964-0.0173-2.9357-1.1937 0.51669-3.7077 7.8964-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.4491-163.25-81.433-5.9562-21.282-16.111-152.36-16.111-170.07 0-88.687 77.742-60.816 125.72-24.795z"
                                fill="currentColor"
                              />
                            </svg>`}
                        <span style="font-weight: 600; color: var(--embed-farcaster-text); font-size: 14px;">
                          @${DOMPurify.sanitize(
                            story.metadata.blueskyPost.author.handle ||
                              "bluesky",
                          )}
                        </span>
                      </div>
                      <div class="bluesky-embed-body">
                        <p>
                          ${(() => {
                            const linkifyNodes = (text) => {
                              const parts = text.split(/(\bhttps?:\/\/[^\s]+)/g);
                              return parts.map((part) => {
                                if (/^\bhttps?:\/\//.test(part)) {
                                  const display =
                                    part.length > 40
                                      ? part.substring(0, 40) + "…"
                                      : part;
                                  return html`<span
                                    style="text-decoration:underline;"
                                    >${DOMPurify.sanitize(display)}</span
                                  >`;
                                }
                                return DOMPurify.sanitize(part);
                              });
                            };
                            const text = (
                              story.metadata.blueskyPost.text || ""
                            ).trim();
                            if (/^https?:\/\/\S+$/i.test(text)) {
                              return html`<span
                                style="text-decoration:underline;"
                                >${DOMPurify.sanitize(text)}</span
                              >`;
                            }
                            const sliced = text.slice(0, 300);
                            return html`${linkifyNodes(sliced)}${text.length > 300 ? "…" : ""}`;
                          })()}
                        </p>
                        ${story.metadata.blueskyPost.images &&
                        story.metadata.blueskyPost.images[0]
                          ? html`
                              <div
                                style="margin-top: 12px; width: 100%; container-type: inline-size; background: var(--button-bg); border-radius: 2px; overflow: hidden;"
                              >
                                <img
                                  src="${DOMPurify.sanitize(
                                    story.metadata.blueskyPost.images[0],
                                  )}"
                                  alt="Post image"
                                  width="${blueskyImageSize.width}"
                                  height="${blueskyImageSize.height}"
                                  style="width: 100%; height: auto; max-height: 600px; max-height: 125cqw; object-fit: cover; display: block; border-radius: 2px;"
                                  loading="${getImageLoading(isAboveFold, story.metadata.blueskyPost.images[0])}"
                                />
                              </div>
                            `
                          : null}
                      </div>
                    </div>
                  </div>
                </a>`
              : null;

    // NOTE: Feed pictures keep main's box: 2:1, cropped to fill (uploaded
    // pictures are shown whole), 600px wide files. Only the frame around
    // them follows the NEU 2 design.
    let imageBlock = null;
    if (displayImage) {
      const imageSrc = isCloudflare
        ? DOMPurify.sanitize(
            story.href.endsWith("/public")
              ? story.href.replace("/public", "/w=600,q=80,fit=cover,f=auto")
              : story.href + "/w=600,q=80,fit=cover,f=auto",
          )
        : DOMPurify.sanitize(sizedImageUrl(story.metadata.image, 600));
      imageBlock = html`<a
        data-no-instant
        class="row-image-preview kn-media${isCloudflare ? " kn-media-zoom" : ""}"
        href="${DOMPurify.sanitize(story.href)}"
        data-href="${DOMPurify.sanitize(story.href)}"
        data-can-iframe="${story.metadata && story.metadata.canIframe !== undefined ? story.metadata.canIframe : true}"
        onclick="${isCloudflare
          ? `event.preventDefault(); if(window.openImageViewer) { window.openImageViewer(this.dataset.href); }`
          : outboundOnclick}"
      >
        <div class="kn-media-box">
          <img
            alt="${DOMPurify.sanitize(story.title)}"
            loading="${getImageLoading(isAboveFold, isCloudflare ? story.href : story.metadata.image)}"
            width="600"
            height="300"
            style="object-fit: ${isCloudflare ? "contain" : "cover"};"
            src="${imageSrc}"
          />
          ${isCloudflare ? null : html`<span class="kn-host-badge">${extractedDomain}</span>`}
        </div>
      </a>`;
    } else if (
      !embedBlock &&
      path === "/stories" &&
      story.metadata &&
      story.metadata.image
    ) {
      // NOTE: As on main: an empty 2:1 box where the picture would be.
      imageBlock = html`<div class="row-image-preview" style="display:block; width:100%;">
        <div style="position: relative; width: 100%; aspect-ratio: 2 / 1; background: var(--button-bg); border-radius: 2px; contain: content; contain-intrinsic-size: 600px 300px;"></div>
      </div>`;
    }

    let submitterKarmaPoints = null;
    try {
      submitterKarmaPoints = story.identity ? karma.resolve(story.identity) : null;
    } catch (e) {
      submitterKarmaPoints = null;
    }
    const submitterAvatar = story.submitter && story.submitter.safeAvatar;
    const profileHref = interactive ? "" : `/upvotes?address=${story.identity}`;
    const age = formatDistanceToNowStrict(new Date(story.timestamp * 1000));
    const avatar = submitterAvatar
      ? html`<img
          class="kn-avatar"
          src="${DOMPurify.sanitize(sizedImageUrl(submitterAvatar, 72))}"
          alt=""
          width="24"
          height="24"
          loading="${getImageLoading(isAboveFold, submitterAvatar)}"
        />`
      : html`<span class="kn-avatar kn-avatar-empty">${ms("user", 14)}</span>`;

    const byline = html`<div class="story-subtitle kn-byline">
      ${story.identity
        ? html`<a
            href="${profileHref}"
            class="kn-byline-person"
            onclick="${spinnerOnclick}"
            >${avatar}<span class="kn-by">submitted by</span><span class="meta-link submitter-name"
              >${story.displayName}</span
            ></a
          >`
        : html`<span class="kn-byline-person"
            >${avatar}<span class="kn-by">submitted by</span><span class="meta-link submitter-name"
              >${story.displayName}</span
            ></span
          >`}
      ${submitterKarmaPoints !== null
        ? html`<span class="kn-karma"
            >${Number(submitterKarmaPoints).toLocaleString("en-US")}<span
              aria-hidden="true"
              >🥝</span
            ></span
          >`
        : ""}
      <span class="kn-dot" aria-hidden="true"></span>
      ${story.index
        ? html`<a class="meta-link kn-age${isStoryNew ? " kn-age-new" : ""}" href="${storyPath}" onclick="${spinnerOnclick}">${age}</a>`
        : html`<span class="kn-age${isStoryNew ? " kn-age-new" : ""}">${age}</span>`}
      <span
        class="story-analytics meta-item"
        data-submitter="${story.identity || ""}"
        data-href="${story.href || ""}"
        style="display: none; white-space: nowrap;"
      >
        <span class="kn-dot" aria-hidden="true"></span>
        <span class="analytics-impressions">0</span> views
        <span class="kn-dot" aria-hidden="true"></span>
        <span class="analytics-clicks">0</span> clicks
      </span>
    </div>`;

    const likeButton = html`<div
      data-title="${DOMPurify.sanitize(story.title)}"
      data-href="${DOMPurify.sanitize(story.href)}"
      data-upvoters="${JSON.stringify(story.upvoters)}"
      class="like-button-container kn-action"
    >
      <button class="interaction-button like-button" aria-label="Upvote">
        <span class="heart-icon">${heartSVG}</span>
        <span class="like-count kn-count"
          >${story.upvoters ? story.upvoters.length : 0}</span
        >
      </button>
    </div>`;

    const commentButton =
      path !== "/demonstration" && path !== "/submit"
        ? html`<div
            data-story-index="0x${story.index}"
            data-comment-count="${commentCount}"
            class="comment-button-container kn-action"
          >
            <a
              class="interaction-button comment-button"
              aria-label="${commentCount > 0 ? commentCount + " " : ""}comments"
              id="chat-bubble-${story.index}"
              href="${path === "/stories" ? "#comments" : storyPath}"
              data-story-idx="${story.index}"
              onclick="${path === "/stories" ? "" : commentOnclick}"
            >
              ${commentsSVG}
              ${commentCount > 0
                ? html`<span class="kn-count">${commentCount}</span>`
                : ""}
            </a>
          </div>`
        : "";

    const shareButton = html`<div class="share-button-container kn-action">
      <button
        class="interaction-button share-button"
        aria-label="Share"
        data-story-title="${DOMPurify.sanitize(story.title)}"
        data-story-slug="${getSlug(story.title)}"
        data-story-index="0x${story.index}"
        data-story-href="${DOMPurify.sanitize(story.href)}"
        onclick="${shareOnclick}"
      >
        ${shareSVG}
      </button>
    </div>`;

    const saveButton =
      story.index && path !== "/demonstration" && path !== "/submit"
        ? html`<div class="kn-action kn-action-save">
            <button
              type="button"
              class="interaction-button kn-save"
              aria-label="Save story"
              aria-pressed="false"
              data-story-index="0x${story.index}"
            >
              ${bookmarkSVG}${bookmarkFullSVG}
            </button>
          </div>`
        : "";

    // NOTE: The story page's "Read original article" (desktop only, see
    // .kn-read-original). Same outbound tracking as the title link.
    const readOriginal =
      path === "/stories" &&
      !isTextPost &&
      !isCloudflare &&
      story.href &&
      story.href.startsWith("http")
        ? html`<a
            class="kn-read-original"
            data-no-instant
            href="${DOMPurify.sanitize(story.href)}"
            data-href="${DOMPurify.sanitize(story.href)}"
            data-can-iframe="${story.metadata && story.metadata.canIframe !== undefined ? story.metadata.canIframe : true}"
            target="_blank"
            rel="noopener"
            onclick="${outboundOnclick}"
            >${ms("arrow-up-right", 16)}<span>Read original article</span></a
          >`
        : "";

    const aiButton =
      path === "/stories" &&
      !isTextPost &&
      story.href &&
      !story.href.startsWith("data:") &&
      !story.href.startsWith("kiwi:")
        ? html`<div class="kn-action kn-action-ai">
                          <div class="ai-dropdown-trigger">
                            <button class="interaction-button ai-button" type="button" aria-label="AI tools">
                              <span class="ai-button-icon">${aiSparkleSVG}</span>
                            </button>
                            <div class="ai-dropdown-menu" style="display:none;">
                              <a
                                class="ai-dropdown-item ai-dropdown-link"
                                href="https://chatgpt.com/?hints=search&q=${encodeURIComponent("Please read and analyze this article so I can ask questions about it: " + domain + "/stories/context?index=0x" + story.index)}"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" fill="currentColor"/></svg>
                                Ask in ChatGPT
                              </a>
                              <a
                                class="ai-dropdown-item ai-dropdown-link ai-desktop-only"
                                href="https://claude.ai/new?q=${encodeURIComponent("Please read and analyze this article so I can ask questions about it: " + domain + "/stories/context?index=0x" + story.index)}"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" xmlns="http://www.w3.org/2000/svg"><path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z"/></svg>
                                Ask in Claude
                              </a>
                              <button
                                class="ai-dropdown-item ai-copy-btn"
                                data-copy-path="/stories/context?index=0x${story.index}"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><polyline points="216 184 216 40 72 40" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><rect x="40" y="72" width="144" height="144" rx="8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>
                                Copy context link
                              </button>
                            </div>
                          </div>
                        </div>`
        : "";

    // NOTE: The design's comment strip ("comment-preview" / "Latest
    // comment"): round avatar, name and time in mono, the comment's text.
    // The text keeps main's wrapping and truncation (user content); see
    // .kn-cp in news.css.
    const commentPreview = displayCommentPreview
      ? html` <div
                  class="comment-preview kn-comment-preview comment-preview-0x${story.index} ${displayImage ||
                  canRenderTweetPreview ||
                  canRenderFarcasterPreview
                    ? "elevating-comment-preview"
                    : "comment-preview-no-mobile-image"}"
                  style="touch-action: manipulation; user-select: none; cursor: pointer; display: flex;"
                >
                  <div
                    class="interaction-element"
                    data-story-idx="${story.index}"
                    data-last-comment-idx="${story.lastComment.index}"
                    style="margin: 0; display: flex; width: 100%;"
                  >
                    <a
                      class="comment-preview-anchor kn-cp"
                      href="${storyPath}#0x${story.lastComment.index}"
                      data-story-idx="${story.index}"
                      data-comment-idx="${story.lastComment.index}"
                      onclick="${previewOnclick}"
                    >
                      <span class="kn-cp-avatar">
                        ${story.lastComment.identity.safeAvatar
                          ? html`<img
                              loading="${getImageLoading(isAboveFold, story.lastComment.identity.safeAvatar)}"
                              src="${DOMPurify.sanitize(
                                sizedImageUrl(story.lastComment.identity.safeAvatar, 72),
                              )}"
                              alt=""
                              width="28"
                              height="28"
                            />`
                          : ms("user", 16)}
                      </span>
                      <span class="kn-cp-body">
                        <span class="kn-cp-head">
                          <span class="kn-cp-name"
                            >${DOMPurify.sanitize(
                              story.lastComment.identity.displayName,
                            )}</span
                          >
                          <span class="kn-cp-when"
                            >· ${formatDistanceToNowStrict(
                              new Date(story.lastComment.timestamp * 1000),
                            )}${" "}ago</span
                          >
                        </span>
                        <span
                          class="comment-preview-text kn-cp-text"
                          >${truncateComment(
                            DOMPurify.sanitize(story.lastComment.title),
                          )}</span
                        >
                      </span>
                      <span class="kn-cp-expand">${expandSVG}</span>
                    </a>
                  </div>
                </div>`
      : null;

    return html`
      <tr style="${invert ? "background-color: var(--bg-inverted);" : ""}">
        <td>
          <div
            class="${interactive ? "" : "content-row"} kn-story ${invert
              ? "inverted-row"
              : ""} ${displayImage || hasEmbed ? "content-row-elevated" : ""} ${hasEmbed ? "kn-story-embed" : ""} ${displayImage ? "kn-story-image" : ""} ${path === "/stories" ? "kn-story-detail" : ""}"
            style="${invert ? "display:none;" : ""} ${style}"
            data-content-id="${submissionId}"
            data-content-type="submission"
            data-position="${position}"
          >
            ${embedBlock || imageBlock
              ? html`<div class="kn-story-media">${embedBlock || imageBlock}</div>`
              : null}
            <div class="kn-source">
              ${showRank
                ? html`<span class="kn-rank">${String(position).padStart(2, "0")}</span>`
                : null}
              ${
                // NOTE: A community's story ({id, name, icon, color}, see
                // withCommunities in communities-api.mjs) shows its tag.
                story.community?.name ? Tag(story.community) : null
              }
              ${sourceLabel
                ? html`<span class="kn-domain">${sourceLabel}</span>`
                : null}
            </div>
            <h2
              class="kn-title ${hasEmbed ? "has-embed" : ""}"
            >
              <span class="story-link-container">
                      <a
                        data-no-instant
                        href="${path === "/submit" || path === "/demonstration"
                          ? "javascript:void(0);"
                          : (isCloudflare || isTextPost) && story.index
                          ? `/stories/${getSlug(story.title)}?index=0x${
                              story.index
                            }`
                          : DOMPurify.sanitize(story.href)}"
                        data-href="${DOMPurify.sanitize(story.href)}"
                        data-can-iframe="${story.metadata && story.metadata.canIframe !== undefined ? story.metadata.canIframe : true}"
                        onclick="${(isCloudflare || isTextPost) && story.index
                          ? `if(!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button !== 1) { var el=document.getElementById('spinner-overlay'); if(el) el.style.display='block'; ${isTextPost ? '' : `navigator.sendBeacon && navigator.sendBeacon('/outbound?url=' + encodeURIComponent(this.dataset.href));`} }`
                          : `var el=this; event.preventDefault(); navigator.sendBeacon && navigator.sendBeacon('/outbound?url=' + encodeURIComponent(el.dataset.href)); if (window.ReactNativeWebView || window !== window.parent) {
                              (function() {
                                var targetUrl = el.dataset.href;
                                var canIframe = el.dataset.canIframe === 'true';
                                
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
                            } else { window.open(el.dataset.href, el.getAttribute('target') || '_blank'); }`}"
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
                        ((isCloudflare || isTextPost) && story.index)
                          ? "_self"
                          : "_blank"}"
                      >
                        ${(() => {
                          const displayTitle =
                            story.metadata && story.metadata.isXArticle && story.metadata.ogTitle
                              ? story.metadata.ogTitle
                              : story.metadata && story.metadata.compliantTitle
                              ? story.metadata.compliantTitle
                              : story.title;
                          return story.isOriginal
                            ? html`<mark
                                style="background-color: rgba(255,255,0, 0.05); padding: 0px 2px;"
                                >${truncateLongWords(DOMPurify.sanitize(displayTitle))}</mark
                              >`
                            : html`${truncateLongWords(DOMPurify.sanitize(displayTitle))}`;
                        })()}
                      </a>
              </span>
            </h2>
            ${tweetDeleted
              ? html`<div class="deleted-post-note kn-note">
                  <span aria-hidden="true">🗑️</span>
                  <span>
                    ${tweetHandle(story.title) || "The author"} deleted this
                    post on X. The discussion stays here.
                  </span>
                </div>`
              : ""}
            ${byline}
            ${canRenderTextPostPreview && textPostContent
              ? html`<div
                  class="text-post-preview kn-text-post"
                  style="padding: 12px 20px; margin-top: 8px;"
                >
                  <div style="white-space: pre-wrap; word-break: break-word; line-height: 1.6; font-size: 13px; color: var(--text-primary); opacity: 0.85;">
                    ${DOMPurify.sanitize(textPostContent)}
                  </div>
                </div>`
              : null}
            ${!interactive
              ? html`<div class="interaction-bar kn-actions">
                  ${likeButton} ${commentButton} ${shareButton} ${aiButton}
                  ${saveButton} ${readOriginal}
                </div>`
              : ""}
            ${commentPreview}
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

export default row;
