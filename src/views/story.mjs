//@format
import { env } from "process";
import { URL } from "url";
import { existsSync } from "fs";
import serialize from "serialize-javascript";

import htm from "htm";
import vhtml from "vhtml";
import { formatDistanceToNowStrict, format } from "date-fns";
import linkifyHtml from "linkify-html";
import DOMPurify from "isomorphic-dompurify";

import * as ens from "../ens.mjs";
import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import RightColumn from "./components/right-column.mjs";
import * as head from "./components/head.mjs";
import * as id from "../id.mjs";
import * as moderation from "./moderation.mjs";
import log from "../logger.mjs";
import Row, { extractDomain } from "./components/row.mjs";
import { getSlug, isCloudflareImage } from "../utils.mjs";
import { cachedMetadata } from "../parser.mjs";
import { getSubmission, getBest } from "../cache.mjs";
import { purgeCache } from "../cloudflarePurge.mjs";
import * as preview from "../preview.mjs";
import ShareIcon from "./components/shareicon.mjs";
import Summary from "./components/summary.mjs";
import {
  StoryNewsletterCard,
  NewsletterCardElement,
  storyHeadline,
  storyCopy,
} from "./components/newsletter-card.mjs";
import { ms } from "./components/icons.mjs";
import { isBlocked } from "../linksafety.mjs";
import { getSummary, scheduleSummary } from "../summaries.mjs";
import { storyDescription, storyDocumentTitle } from "../seo.mjs";
import * as isoweek from "../isoweek.mjs";

const html = htm.bind(vhtml);

const isInternalLink = (href) =>
  href.startsWith("https://news.kiwistand.com") ||
  href.startsWith("https://staging.kiwistand.com");

// Never build the anchors by hand here. DOMPurify serializes text nodes, so it
// leaves quotes unencoded, and a URL like `https://x"onmouseover="alert(1)`
// interpolated into href="" injects attributes. linkify-html escapes them.
function linkifyComment(title) {
  const body = title
    .split("\n")
    .map((line) => {
      if (line.startsWith(">")) {
        return `<div style="border-left: 3px solid var(--text-quaternary); padding-left: 10px; margin: 8px 0 0 0; color: var(--text-tertiary);">${DOMPurify.sanitize(
          line.substring(2),
        )}</div>`;
      }
      return line.trim() ? `<div>${DOMPurify.sanitize(line)}</div>` : "<br/>";
    })
    .join("");

  return linkifyHtml(body, {
    className: "meta-link selectable-link",
    target: (href) => (isInternalLink(href) ? "_self" : "_blank"),
    attributes: (href) => ({
      "data-url": href,
      onclick: isInternalLink(href)
        ? ""
        : `if (window.ReactNativeWebView || window !== window.parent) { event.preventDefault(); window.sdk.actions.openUrl(this.dataset.url); }`,
    }),
    // Keep the old regex's scope: explicit http(s) only, no bare domains and
    // no mailto: harvesting of addresses typed into comments.
    validate: {
      url: (value) => /^https?:\/\//.test(value),
      email: () => false,
    },
  });
}

export async function generateStory(index) {
  const hexRegex = /^0x[a-fA-F0-9]{72}$/;

  if (!hexRegex.test(index)) {
    throw new Error("Index wasn't found");
  }

  let submission;
  try {
    // Get banned addresses from moderation config
    const policy = await moderation.getListsForStory();
    const bannedAddresses = policy.addresses || [];
    submission = getSubmission(index, null, null, null, bannedAddresses);
  } catch (err) {
    log(
      `Requested index "${index}" but didn't find because of error "${err.toString()}"`,
    );
    throw new Error("Index wasn't found");
  }
  if (isBlocked(submission.href)) {
    throw new Error("This story's link was flagged as malicious.");
  }

  return submission;
}

export async function generatePreview(index, commentIndex = null) {
  let submission;
  try {
    // Get banned addresses from moderation config
    const policy = await moderation.getListsForStory();
    const bannedAddresses = policy.addresses || [];
    submission = getSubmission(index, null, null, null, bannedAddresses);
  } catch (err) {
    log(
      `Requested index "${index}" but didn't find because of error "${err.toString()}"`,
    );
    throw new Error("Index wasn't found");
  }
  
  // If commentIndex is provided, generate comment preview instead
  if (commentIndex) {
    const comment = submission.comments?.find(c => 
      c.index === commentIndex || c.id === `kiwi:0x${commentIndex}` || c.id === commentIndex
    );
    
    if (comment) {
      try {
        const forceFetch = true;
        const commentEnsData = await ens.resolve(comment.identity, forceFetch);
        const absoluteTime = format(new Date(comment.timestamp * 1000), "PPpp");
        
        const hexIndex = index.substring(2);
        const fileName = `${hexIndex}-comment-${commentIndex}`;
        
        // Generate comment preview
        const body = preview.comment(
          comment.title,
          commentEnsData.displayName || comment.identity.slice(0, 6) + "...",
          commentEnsData.safeAvatar,
          submission.title,
          absoluteTime,
          comment.reactions
        );
        await preview.generate(fileName, body); // Generate OG image
        
        const frameBody = preview.commentFrame(
          comment.title,
          commentEnsData.displayName || comment.identity.slice(0, 6) + "...",
          commentEnsData.safeAvatar,
          submission.title,
          absoluteTime,
          comment.reactions
        );
        await preview.generate(fileName, frameBody, true); // Generate frame image
        
        return; // Exit after generating comment preview
      } catch (err) {
        log(`Failed to generate comment preview: ${err.stack}`);
        // Fall back to story preview if comment preview fails
      }
    }
  }
  
  // Default story preview generation
  const forceFetch = true;
  const ensData = await ens.resolve(submission.identity, forceFetch);
  const value = {
    ...submission,
    displayName: ensData.displayName,
    submitter: ensData,
  };
  const hexIndex = index.substring(2);
  const domain = extractDomain(submission.href);
  try {
    const body = preview.story(
      value.title,
      value.submitter.displayName,
      value.submitter.safeAvatar,
      domain,
    );
    await preview.generate(hexIndex, body); // Generate OG image (1200x630)
    await preview.generate(hexIndex, body, true); // Generate frame image (1200x800)
  } catch (err) {
    log(`Failed to generate preview with avatar for story ${hexIndex}: ${err.stack}`);
    try {
      const body = preview.story(value.title, value.submitter.displayName, null, domain);
      await preview.generate(hexIndex, body); // Generate OG image (1200x630)
      await preview.generate(hexIndex, body, true); // Generate frame image (1200x800)
    } catch (err2) {
      log(`Failed to generate preview without avatar for story ${hexIndex}: ${err2.stack}`);
    }
  }
}

// Generates the story's summary in the background (if it has none yet) and
// purges the cached story page once there's one to show.
export function summarizeStory(index, submission) {
  const job = scheduleSummary(index, submission.title, submission.href);
  job?.then((summary) => {
    if (!summary) return;
    const hexIndex = String(index).replace(/^0x/, "");
    const storyUrl = `https://news.kiwistand.com/stories/${getSlug(
      submission.title,
    )}?index=0x${hexIndex}`;
    purgeCache(storyUrl).catch((err) =>
      log(`Failed to purge story page cache after summary: ${err}`),
    );
  });
}

// Called for every new "amplify" message; upvotes have no submission under
// their index, so generateStory throws and nothing happens.
export async function summarizeNewStory(index) {
  try {
    summarizeStory(index, await generateStory(index));
  } catch (err) {}
}

// NOTE: "More from <site>" links give crawlers and readers a path from a story
// page to older story pages. It uses getBest(), the same query that powers
// /best?domain=, and the regular moderation lists (both are already cached).
export async function moreFromSite(href, index, limit = 5) {
  if (!href || !href.startsWith("https://") || isCloudflareImage(href)) {
    return { site: "", stories: [] };
  }
  let site;
  try {
    site = new URL(href).hostname.replace(/^www\./, "");
  } catch (err) {
    return { site: "", stories: [] };
  }
  if (!site) return { site: "", stories: [] };

  try {
    const candidates = getBest(limit * 2 + 1, 0, null, site, 0);
    const policy = await moderation.getLists();
    const stories = moderation
      .moderate(candidates, policy, "/stories")
      .filter((story) => story.index !== index)
      .slice(0, limit);
    return { site, stories };
  } catch (err) {
    log(`moreFromSite failed for ${site}: ${err.toString()}`);
    return { site, stories: [] };
  }
}

// "More from <site>" as a box of the desktop right column (the design's
// "More from Hot" box). Phones and tablets show the same list below the
// comments (.kn-related-row).
function RelatedBox(related) {
  return html`<div class="kn-side-box kn-related-box">
    <span class="kn-eyebrow">More from ${related.site}</span>
    <ul class="kn-related-list">
      ${related.stories.map(
        (item) => html`<li>
          <a href="/stories/${getSlug(item.title)}?index=0x${item.index}"
            >${item.title}</a
          >
        </li>`,
      )}
    </ul>
  </div>`;
}

export default async function (trie, theme, index, value, referral, commentIndex = null) {
  const path = "/stories";

  // Handle text posts (data:text/plain URLs)
  let textContent = null;
  if (value.href && value.href.startsWith("data:text/plain,")) {
    textContent = decodeURIComponent(value.href.replace("data:text/plain,", ""));
  }

  // Skip metadata fetching for text posts and kiwi: references
  let data = null;
  if (!value.href.startsWith("data:") && !value.href.startsWith("kiwi:")) {
    const slug = getSlug(value.title);
    const storyUrl = `https://news.kiwistand.com/stories/${slug}?index=${index}`;
    data = await cachedMetadata(value.href, false, value.title, () => {
      purgeCache(storyUrl).catch((err) =>
        log(`Failed to purge story page cache after metadata fetch: ${err}`)
      );
    });
  }

  const story = {
    ...value,
    metadata: data,
    textContent,
  };

  // Collect all identities that need resolving
  const identities = new Set();
  story.comments.forEach((comment) => {
    identities.add(comment.identity);
    comment.reactions.forEach((reaction) => {
      reaction.reactors.forEach((reactor) => identities.add(reactor));
    });
  });

  // Resolve all profiles at once
  const profileResults = await Promise.allSettled(
    Array.from(identities).map((id) => ens.resolve(id)),
  );

  const resolvedProfiles = Object.fromEntries(
    Array.from(identities).map((id, i) => [
      id,
      profileResults[i].status === "fulfilled" ? profileResults[i].value : null,
    ]),
  );

  // Enrich comments with resolved profiles
  for (let comment of story.comments) {
    const profile = resolvedProfiles[comment.identity];
    comment.displayName = profile?.displayName || comment.identity;
    comment.avatar = profile?.safeAvatar;
    comment.identity = {
      address: comment.identity,
      ...profile,
    };

    // Enrich reactions with resolved profiles
    comment.reactions = comment.reactions.map((reaction) => ({
      ...reaction,
      reactorProfiles: reaction.reactors
        .map((reactor) => resolvedProfiles[reactor])
        .filter(Boolean),
    }));
  }
  // NOTE: store.post returns upvoters as objects of "identity" and "timestamp"
  // property so that we can zip them with tipping actions. But the row component
  // expects upvoters to be a string array of Ethereum addresses.
  const upvotersWithTimestamp = story.upvoters; // Keep the full objects for social proof
  story.upvoters = story.upvoters.map(({ identity }) => identity);

  const ensData = await ens.resolve(story.identity);
  story.submitter = ensData;
  story.displayName = ensData.displayName;

  // Resolve upvoter profiles for social proof section
  const upvoterProfiles = [];
  for (const upvoter of upvotersWithTimestamp) {
    // Skip the story submitter
    if (upvoter.identity === story.identity) {
      continue;
    }
    
    const profile = await ens.resolve(upvoter.identity);
    // Only include profiles with proper names (ENS, Farcaster, or Lens) AND high Neynar scores
    if (profile && 
        (profile.ens || profile.farcaster || profile.lens) && 
        profile.neynarScore && 
        profile.neynarScore >= 0.6) { // Only show curators with score >= 0.6
      upvoterProfiles.push({
        ...profile,
        timestamp: upvoter.timestamp,
        neynarScore: profile.neynarScore
      });
    }
  }
  // Sort by neynarScore descending
  upvoterProfiles.sort((a, b) => b.neynarScore - a.neynarScore);

  // Ensure frame preview exists for Farcaster embeds (after ENS resolution)
  if (!isCloudflareImage(value.href)) {
    const hexIndex = index.substring(2);
    const domain = extractDomain(value.href);
    try {
      const body = preview.story(
        value.title,
        story.submitter.displayName,
        story.submitter.safeAvatar,
        domain,
      );
      await preview.generate(hexIndex, body, true); // Generate frame version if missing
    } catch (err) {
      // Fallback without avatar if there's an error
      const body = preview.story(value.title, story.submitter.displayName, null, domain);
      await preview.generate(hexIndex, body, true);
    }
  }

  // Never wait for Claude here: without a stored summary the page renders
  // without one and the next render (after the day-long CDN cache) has it.
  const summary = getSummary(index);
  if (!summary) summarizeStory(index, value);

  const start = 0;
  // Only add margin-bottom when neither the summary nor the curator section
  // will be shown
  const style =
    !summary && upvoterProfiles.length === 0 ? "margin-bottom: 28px;" : "";

  // Generate appropriate preview URLs based on whether this is a comment or story
  let ogImage, frameImage, ogDescription, ogTitle;
  let baseUrl = "https://news.kiwistand.com";
  if (env.CUSTOM_HOST_NAME && env.CUSTOM_PROTOCOL) {
    // Remove port for public URLs like meta tags
    const hostWithoutPort = env.CUSTOM_HOST_NAME.split(':')[0];
    baseUrl = `${env.CUSTOM_PROTOCOL}${hostWithoutPort}`;
  }

  if (commentIndex) {
    // Find the specific comment for preview
    const comment = story.comments?.find(c => 
      c.index === commentIndex || c.id === `kiwi:0x${commentIndex}` || c.id === commentIndex
    );
    
    if (comment) {
      // Generate comment preview if needed with proper timestamp
      try {
        // comment.identity is already resolved and is an object with address property
        const commentEnsData = comment.identity;
        const absoluteTime = format(new Date(comment.timestamp * 1000), "PPpp");
        
        const hexIndex = index;
        const fileName = `${hexIndex}-comment-${commentIndex}`;
        
        // Check if preview files already exist to avoid regeneration
        const ogPath = `src/public/previews/${fileName}.jpg`;
        const framePath = `src/public/previews/${fileName}-frame.jpg`;
        
        // Generate OG preview only if it doesn't exist
        if (!existsSync(ogPath)) {
          const body = preview.comment(
            comment.title,
            commentEnsData.displayName || commentEnsData.address.slice(0, 6) + "...",
            commentEnsData.safeAvatar,
            value.title,
            absoluteTime,
            comment.reactions
          );
          await preview.generate(fileName, body); // Generate OG image
        }
        
        // Generate frame preview only if it doesn't exist
        if (!existsSync(framePath)) {
          const frameBody = preview.commentFrame(
            comment.title,
            commentEnsData.displayName || commentEnsData.address.slice(0, 6) + "...",
            commentEnsData.safeAvatar,
            value.title,
            absoluteTime,
            comment.reactions
          );
          await preview.generate(fileName, frameBody, true); // Generate frame image
        }
      } catch (err) {
        log(`Failed to generate comment preview: ${err.message}`);
        log(`Error stack: ${err.stack}`);
      }
      
      const fileName = `${index}-comment-${commentIndex}`;
      ogImage = `${baseUrl}/previews/${fileName}.jpg`;
      frameImage = `${baseUrl}/previews/${fileName}-frame.jpg`;
      
      // Use comment text as description, truncated
      const maxLength = 160;
      ogDescription = comment.title.length > maxLength 
        ? comment.title.substring(0, maxLength) + "..."
        : comment.title;
      
      // Update title to indicate it's a comment
      ogTitle = `Comment on: ${value.title}`;
    } else {
      // Fall back to story preview if comment not found
      commentIndex = null;
    }
  }
  
  // Default to story preview if not a comment
  if (!commentIndex) {
    if (isCloudflareImage(value.href)) {
      // Use Cloudflare image URL directly with appropriate parameters for OG image
      ogImage = value.href.endsWith("/public")
        ? value.href.replace("/public", "/w=1200,q=80,fit=cover,f=auto")
        : value.href + "/w=1200,q=80,fit=cover,f=auto";
      frameImage = ogImage; // Use same for Cloudflare images
    } else {
      // Fall back to the generated preview (index already has 0x prefix removed in http.mjs)
      ogImage = `${baseUrl}/previews/${index}.jpg`;
      frameImage = `${baseUrl}/previews/${index}-frame.jpg`;
    }
    
    ogDescription = storyDescription({
      title: value.title,
      href: value.href,
      summary,
      articleDescription: data?.ogDescription,
      textContent,
    });
    ogTitle = value.title;
  }
  
  const related = await moreFromSite(value.href, index);

  const slug = getSlug(value.title);
  const canonicalUrl = commentIndex 
    ? `${baseUrl}/stories/${slug}?index=0x${index}&commentIndex=${commentIndex}`
    : `${baseUrl}/stories/${slug}?index=0x${index}`;

  const jsonLd = serialize({
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    "headline": value.title,
    "url": canonicalUrl,
    "image": ogImage,
    "datePublished": new Date(value.timestamp * 1000).toISOString(),
    "author": {
      "@type": "Person",
      "name": story.submitter.displayName,
    },
    ...(value.href.startsWith("http") ? {
      "sharedContent": {
        "@type": "WebPage",
        "url": value.href,
      },
    } : {}),
    "commentCount": story.comments.length,
    "interactionStatistic": {
      "@type": "InteractionCounter",
      "interactionType": "https://schema.org/LikeAction",
      "userInteractionCount": story.upvoters.length,
    },
    ...(story.comments.length > 0 ? {
      "comment": story.comments.slice(0, 5).map((c) => ({
        "@type": "Comment",
        "text": c.title,
        "dateCreated": new Date(c.timestamp * 1000).toISOString(),
        "author": {
          "@type": "Person",
          "name": c.displayName,
        },
      })),
    } : {}),
    ...(ogDescription ? { "description": ogDescription } : {}),
    ...(summary ? { "abstract": summary } : {}),
  }, { isJSON: true });

  return "<!DOCTYPE html>" + html`
    <html lang="en" op="news">
      <head>
        <base href="/" />
        ${head.custom(
          ogImage,
          ogTitle,
          ogDescription,
          undefined,
          ["/", "/new?cached=true", "/submit"],
          canonicalUrl,
          frameImage,
          null,
          {
            documentTitle: commentIndex
              ? `${ogTitle} | Kiwi News`
              : storyDocumentTitle(value.title, value.href),
            ogType: "article",
            publishedTime: new Date(value.timestamp * 1000).toISOString(),
            author: `${baseUrl}/upvotes?address=${story.identity}`,
            authorName: story.submitter.displayName,
            rss: true,
          },
        )}
        ${commentIndex
          ? html`<meta name="robots" content="noindex, follow" />`
          : null}
        <script type="application/ld+json" dangerouslySetInnerHTML=${{ __html: jsonLd }}></script>
        <link
          rel="alternate"
          type="text/plain"
          title="LLM-friendly story context"
          href="${baseUrl}/stories/context?index=0x${index}"
        />
      </head>
      <body
        data-instant-allow-query-string
        data-instant-allow-external-links
        ontouchstart=""
      >
        <div class="container">
          ${Sidebar(path)}
          ${RightColumn({
            newsletter: false,
            children: [
              NewsletterCardElement("story", storyHeadline, storyCopy),
              related.stories.length > 0 ? RelatedBox(related) : null,
            ],
          })}
          <main id="hnmain" class="scaled-hnmain" role="main">
            <h1 class="visually-hidden">${value.title}</h1>
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="var(--background-color0)">
              <thead>
                <tr>
                  ${Header(theme, path)}
                </tr>
              </thead>
              <tbody>
                ${Row(
                  start,
                  "/stories",
                  style,
                  null,
                  null,
                  null,
                  false, // invert
                  "", // query
                  false, // debugMode
                  false, // isAboveFold = false for lazy loading
                )({ ...story, index }, 0)}
              </tbody>
              ${Summary(summary)} ${StoryNewsletterCard()}
              ${upvoterProfiles.length > 0
                ? html`<tr class="kn-curators-row">
                    <td>
                      <div class="kn-curators">
                        <div class="kn-curators-label">
                          Recommended by ${upvoterProfiles.length}${" "}${upvoterProfiles.length === 1 ? "curator" : "curators"}
                        </div>
                        <div class="kn-curators-list">
                          ${upvoterProfiles.slice(0, 20).map(
                            (upvoter) =>
                              html`<a
                                class="kn-curator"
                                href="/upvotes?address=${upvoter.address}"
                              >
                                ${upvoter.safeAvatar
                                  ? html`<img
                                      class="kn-avatar"
                                      loading="lazy"
                                      src="${upvoter.safeAvatar}"
                                      alt=""
                                      width="16"
                                      height="16"
                                    />`
                                  : html`<span class="kn-avatar kn-avatar-empty"
                                      >${ms("person", 11)}</span
                                    >`}
                                <span class="kn-curator-name"
                                  >${upvoter.displayName}</span
                                >
                              </a>`,
                          )}
                          ${upvoterProfiles.length > 20
                            ? html`<span class="kn-curators-more"
                                >+${upvoterProfiles.length - 20} more</span
                              >`
                            : null}
                        </div>
                      </div>
                    </td>
                  </tr>`
                : null}
              ${story.comments.length > 0
                ? html`<tr class="kn-comments-row" id="comments">
                    <td>
                      <div class="kn-comments">
                        <div class="kn-section-label">
                          <span
                            >${story.comments.length}${" "}${story.comments
                              .length === 1
                              ? "comment"
                              : "comments"}</span
                          >
                        </div>
                        ${story.comments.map(
                          (comment) =>
                            html`<span
                              id="0x${comment.index}"
                              class="kn-comment ${story?.metadata?.image
                                ? "scroll-margin-with-image"
                                : "scroll-margin-base"}${comment.flagged
                                ? " kn-comment-flagged"
                                : ""}"
                            >
                              <div class="kn-comment-inner">
                                ${comment.avatar
                                  ? html`<div class="kn-comment-avatar">
                                      <a
                                        href="/upvotes?address=${comment.identity.address}"
                                      >
                                        <img
                                          loading="lazy"
                                          src="${comment.avatar}"
                                          alt="avatar"
                                          width="32"
                                          height="32"
                                        />
                                      </a>
                                    </div>`
                                  : null}
                                <div class="kn-comment-main">
                                  <div class="kn-comment-head">
                                    ${!comment.flagged
                                      ? html`<a
                                          class="kn-comment-name"
                                          href="/upvotes?address=${comment
                                            .identity.address}"
                                          >${comment.displayName}</a
                                        >`
                                      : html`<span class="kn-comment-name"
                                          >${comment.displayName}</span
                                        >`}
                                    ${comment.identity?.address &&
                                    story.identity &&
                                    comment.identity.address.toLowerCase() ===
                                      story.identity.toLowerCase()
                                      ? html`<span class="kn-comment-tag"
                                          >Submitter</span
                                        >`
                                      : null}
                                    <span class="inverse-share-container kn-comment-time">
                                      <span>· </span>
                                      <a
                                        class="meta-link"
                                        href="/stories/${getSlug(value.title)}?index=0x${index}&commentIndex=${comment.index}#0x${comment.index}"
                                      >
                                        <span>
                                          ${formatDistanceToNowStrict(
                                            new Date(comment.timestamp * 1000),
                                          )}
                                        </span>
                                        <span> ago</span>
                                      </a>
                                    </span>
                                    <span class="share-container kn-comment-time">
                                      <span>· </span>
                                      <a
                                        href="#"
                                        class="caster-link share-link"
                                        title="Share"
                                        style="white-space: nowrap;"
                                        data-share-url="${baseUrl}/stories/${getSlug(
                                          value.title,
                                        )}?index=0x${index}&commentIndex=${comment.index}"
                                        onclick="event.preventDefault(); navigator.share({url: this.dataset.shareUrl});"
                                      >
                                        ${ShareIcon(
                                          "padding: 0 3px 1px 0; vertical-align: middle; height: 13px; width: 13px;",
                                        )}
                                        <span>
                                          ${formatDistanceToNowStrict(
                                            new Date(comment.timestamp * 1000),
                                          )}
                                        </span>
                                        <span> ago</span>
                                      </a>
                                    </span>
                                  </div>
                                  ${comment.flagged && comment.reason
                                    ? html`<i
                                        >Moderated because: "${comment.reason}"</i
                                      >`
                                    : html`<span
                                          class="comment-text"
                                          dangerouslySetInnerHTML=${{
                                            __html: linkifyComment(
                                              comment.title,
                                            ),
                                          }}
                                        ></span>
                                        <div
                                          class="reactions-container kn-reactions"
                                          data-comment-index="${comment.index}"
                                          data-comment="${JSON.stringify({
                                            ...comment,
                                            reactions: (
                                              comment.reactions || []
                                            ).map((reaction) => ({
                                              ...reaction,
                                              reactors: reaction.reactors,
                                              reactorProfiles:
                                                reaction.reactorProfiles,
                                            })),
                                          })}"
                                        >
                                          ${comment.reactions && comment.reactions.filter((r) => r.reactors && r.reactors.length > 0).length > 0
                                            ? html`
                                                <div style="display: flex; align-items: center; gap: 4px;">
                                                  ${comment.reactions
                                                    .filter((r) => r.reactors && r.reactors.length > 0)
                                                    .map(
                                                      (reaction) => html`
                                                        <button
                                                          style="display: inline-flex; align-items: center; gap: 4px; box-sizing: border-box; background-color: transparent; border: 1px solid var(--kn-border); border-radius: var(--kn-radius-sm); padding: 2px 8px; min-height: 28px; cursor: pointer; font-family: var(--font-family);"
                                                          disabled
                                                        >
                                                          <span style="font-size: 13px; line-height: 1;">${reaction.emoji}</span>
                                                          ${reaction.reactorProfiles
                                                            ?.filter((profile) => profile.safeAvatar)
                                                            .slice(0, 2)
                                                            .map(
                                                              (profile, i) => html`
                                                                <img
                                                                  loading="lazy"
                                                                  src="${profile.safeAvatar}"
                                                                  alt=""
                                                                  width="16"
                                                                  height="16"
                                                                  style="width: 16px; height: 16px; border-radius: 50%; margin-left: ${i === 0 ? "0" : "-6px"}; border: 1.5px solid var(--kn-card);"
                                                                />
                                                              `,
                                                            )}
                                                          ${reaction.reactors.length > 1
                                                            ? html`<span style="color: var(--kn-text-secondary); font-family: var(--kn-font-mono); font-size: 12px;">${reaction.reactors.length}</span>`
                                                            : null}
                                                        </button>
                                                      `,
                                                    )}
                                                </div>
                                              `
                                            : null}
                                          <button
                                            class="react-toggle-btn"
                                            style="display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 2px 8px; min-width: 28px; min-height: 28px; background: transparent; border: 1px solid var(--kn-border); border-radius: var(--kn-radius-sm); font-size: 14px; color: var(--kn-text-secondary); cursor: pointer; font-family: var(--font-family);"
                                            disabled
                                          >
                                            <span style="font-size: 15px; line-height: 1;">+</span>
                                          </button>
                                          <div
                                            class="emoji-picker-options"
                                            style="display: none; position: absolute; top: 100%; left: 0; margin-top: 4px; align-items: center; gap: 4px; background-color: var(--bg-white); border-radius: 24px; padding: 6px; box-shadow: var(--shadow-default); border: var(--border-subtle); z-index: 10;"
                                          >
                                            ${["🥝", "🔥", "👀", "💯", "🤭"].map(
                                              (emoji) => html`
                                                <button
                                                  style="display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; padding: 0; background: transparent; border: none; border-radius: 50%; font-size: 20px; cursor: pointer;"
                                                  disabled
                                                >
                                                  ${emoji}
                                                </button>
                                              `,
                                            )}
                                          </div>
                                        </div>`}
                                </div>
                              </div>
                            </span>`,
                        )}
                      </div>
                    </td>
                  </tr>`
                : html`<tr class="kn-comments-row kn-comments-empty-row">
                    <td>
                      <div class="kn-comments">
                        <div class="kn-section-label">
                          <span>Comments</span>
                        </div>
                        <div class="kn-comments-empty">
                          <span class="kn-comments-empty-kiwi" aria-hidden="true"
                            >🥝</span
                          >
                          <span class="kn-comments-empty-title"
                            >No comments yet</span
                          >
                          <span class="kn-comments-empty-text"
                            >What caught your eye? Start the discussion.</span
                          >
                        </div>
                      </div>
                    </td>
                  </tr>`}
              <tr>
                <td>
                  <div
                    class="comment-input-host"
                    id=${story.comments.length > 0 ? null : "comments"}
                  >
                    <div class="comment-input-ssr-placeholder" aria-hidden="true">
                      <div class="kn-composer comment-input-desktop-ssr">
                        <span class="kn-composer-field kn-composer-ssr-text"
                          >${story.comments.length > 0
                            ? "Add a comment…"
                            : "Be the first to comment…"}</span
                        >
                        <span class="kn-composer-post">Post</span>
                      </div>
                      <div class="kn-composer-loggedout comment-input-loggedout-ssr">
                        <span class="kn-composer-loggedout-text"
                          >Log in to join the discussion.</span
                        >
                        <span class="kn-composer-login">Log in</span>
                      </div>
                    </div>
                    <div
                      class="comment-section story-page-comments"
                      data-story-index="0x${index}"
                      data-story-title="${value.title}"
                      data-comment-count="0"
                      data-always-shown="true"
                      data-first-comment="${story.comments.length === 0}"
                      data-has-preview="false"
                    ></div>
                  </div>
                </td>
              </tr>
              ${related.stories.length > 0
                ? html`<tr class="kn-related-row">
                    <td style="padding: 0 0 12px 0;">
                      <div style="margin: 0 11px;">
                        <h2
                          style="font-size: 10pt; font-weight: 500; margin: 0 0 8px 0; color: var(--text-secondary);"
                        >
                          More from ${related.site} on Kiwi News
                        </h2>
                        <ul style="list-style: none; margin: 0; padding: 0; font-size: 10pt; line-height: 1.4;">
                          ${related.stories.map(
                            (item) => html`<li style="margin-bottom: 6px;">
                              <a
                                class="meta-link"
                                style="color: var(--text-primary);"
                                href="/stories/${getSlug(item.title)}?index=0x${item.index}"
                                >${item.title}</a
                              >
                            </li>`,
                          )}
                        </ul>
                      </div>
                    </td>
                  </tr>`
                : null}
              <tr>
                <td style="padding: 0 0 12px 0;">
                  <div class="kn-top-week">
                    <a
                      class="meta-link"
                      style="color: var(--text-secondary);"
                      href="${isoweek.path(isoweek.weekOf(value.timestamp))}"
                      >Top stories that week →</a
                    >
                  </div>
                </td>
              </tr>
              <tr style="height: 40px;"></tr>
            </table>
            <div class="desktop-only-footer">
              ${Footer(theme, path)}
            </div>
          </main>
        </div>
      </body>
    </html>
  `;
}
