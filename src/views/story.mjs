//@format
import { env } from "process";
import { URL } from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import {
  formatDistanceToNowStrict,
  sub,
  differenceInMinutes,
  isBefore,
} from "date-fns";
import linkifyStr from "linkify-string";
import DOMPurify from "isomorphic-dompurify";

import * as curation from "./curation.mjs";
import * as ens from "../ens.mjs";
import Header from "./components/header.mjs";
import SecondHeader from "./components/secondheader.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import * as head from "./components/head.mjs";
import * as store from "../store.mjs";
import * as id from "../id.mjs";
import * as moderation from "./moderation.mjs";
import log from "../logger.mjs";
import { EIP712_MESSAGE } from "../constants.mjs";
import Row, { extractDomain } from "./components/row.mjs";
import * as karma from "../karma.mjs";
import { truncateName, getSlug, isCloudflareImage } from "../utils.mjs";
import { identityClassifier } from "./feed.mjs";
import { render, cachedMetadata } from "../parser.mjs";
import { getSubmission } from "../cache.mjs";
import * as preview from "../preview.mjs";
import ShareIcon from "./components/shareicon.mjs";
import { warpcastSvg } from "./components/socialNetworkIcons.mjs";

const html = htm.bind(vhtml);

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

  return submission;
}

export async function generatePreview(index) {
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
  const ensData = await ens.resolve(submission.identity);
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
    const body = preview.story(value.title, value.submitter.displayName, null, domain);
    await preview.generate(hexIndex, body); // Generate OG image (1200x630)
    await preview.generate(hexIndex, body, true); // Generate frame image (1200x800)
  }
}


export default async function (trie, theme, index, value, referral) {
  const path = "/stories";

  let data = cachedMetadata(value.href, false, value.title);

  const story = {
    ...value,
    metadata: data,
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

  const start = 0;
  const style = "";

  let ogImage;
  if (isCloudflareImage(value.href)) {
    // Use Cloudflare image URL directly with appropriate parameters for OG image
    ogImage = value.href.endsWith("/public")
      ? value.href.replace("/public", "/w=1200,q=80,fit=cover,f=auto")
      : value.href + "/w=1200,q=80,fit=cover,f=auto";
  } else {
    // Fall back to the generated preview
    ogImage = `https://news.kiwistand.com/previews/${index}.jpg`;
  }

  // Generate frame-specific image URL for Farcaster embeds only
  let baseUrl = "https://news.kiwistand.com";
  if (env.CUSTOM_HOST_NAME && env.CUSTOM_PROTOCOL) {
    // Remove port for public URLs like meta tags
    const hostWithoutPort = env.CUSTOM_HOST_NAME.split(':')[0];
    baseUrl = `${env.CUSTOM_PROTOCOL}${hostWithoutPort}`;
  }
  
  const frameImage = isCloudflareImage(value.href) 
    ? ogImage  // Use same for Cloudflare images
    : `${baseUrl}/previews/${index.substring(2)}-frame.jpg`;

  const ogDescription =
    data && data.ogDescription
      ? data.ogDescription
      : "Crypto news for builders";
  const slug = getSlug(value.title);
  const canonicalUrl = `${baseUrl}/stories/${slug}?index=0x${index}`;

  return html`
    <html lang="en" op="news">
      <head>
        <base href="/" />
        ${head.custom(
          ogImage,
          value.title,
          ogDescription,
          undefined,
          ["/", "/new?cached=true", "/submit"],
          canonicalUrl,
          frameImage,
        )}
      </head>
      <body
        data-instant-allow-query-string
        data-instant-allow-external-links
        ontouchstart=""
      >
        <div class="container">
          ${Sidebar(path)}
          <div id="hnmain" class="scaled-hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
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
                )({ ...story, index })}
              </tbody>
              ${upvoterProfiles.length > 0
                ? html`<tr>
                    <td style="padding: 16px 0;">
                      <div style="margin: 0 1rem;">
                        <div style="font-size: 10pt; font-weight: 500; margin-bottom: 12px; color: #828282;">
                          Recommended by ${upvoterProfiles.length} ${upvoterProfiles.length === 1 ? 'curator' : 'curators'}
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                          ${upvoterProfiles.slice(0, 20).map(
                            (upvoter) =>
                              html`<a
                                href="/upvotes?address=${upvoter.address}"
                                style="display: flex; align-items: center; text-decoration: none; color: inherit; background-color: white; padding: 4px 8px; border: var(--border); border-radius: 2px; transition: all 0.2s; font-size: 10pt;"
                                onmouseover="this.style.borderColor='var(--hn-orange-border)'; this.style.backgroundColor='var(--bg-off-white)';"
                                onmouseout="this.style.borderColor='var(--border-color)'; this.style.backgroundColor='white';"
                              >
                                ${upvoter.safeAvatar
                                  ? html`<img
                                      loading="lazy"
                                      src="${upvoter.safeAvatar}"
                                      alt="${upvoter.displayName}"
                                      style="width: 20px; height: 20px; border-radius: 2px; margin-right: 6px;"
                                    />`
                                  : null}
                                <span style="color: var(--contrast-color);">
                                  ${upvoter.displayName}
                                </span>
                              </a>`,
                          )}
                          ${upvoterProfiles.length > 20
                            ? html`<div
                                style="display: flex; align-items: center; padding: 4px 8px; color: #828282; font-size: 10pt;"
                              >
                                +${upvoterProfiles.length - 20} more
                              </div>`
                            : null}
                        </div>
                      </div>
                    </td>
                  </tr>`
                : null}
              ${story.comments.length > 0
                ? html`<tr>
                    <td>
                      <div style="margin: 0 1rem; padding: 16px 0 16px 0; font-size: 1rem;">
                        ${story.comments.map(
                          (comment) =>
                            html`<span
                              id="0x${comment.index}"
                              class="${story?.metadata?.image
                                ? "scroll-margin-with-image"
                                : "scroll-margin-base"}"
                              style="${comment.flagged
                                ? "opacity: 0.5"
                                : ""}; color: black; border: var(--border); background-color: white; padding: 0.75rem; border-radius: 2px; display: block; margin-bottom: 16px; white-space: pre-wrap; line-height: 1.3; word-break: break-word; overflow-wrap: break-word;"
                            >
                              <div style="display: flex; align-items: flex-start;">
                                ${comment.avatar
                                  ? html`<div style="width: 32px; flex-shrink: 0; margin-right: 12px;">
                                      <a
                                        href="/upvotes?address=${comment.identity.address}"
                                      >
                                        <img
                                          loading="lazy"
                                          src="${comment.avatar}"
                                          alt="avatar"
                                          style="width: 32px; height: 32px; border: var(--border); border-radius: 2px;"
                                        />
                                      </a>
                                    </div>`
                                  : null}
                                <div style="flex: 1; min-width: 0;">
                                  <div
                                    style="white-space: nowrap; gap: 3px; margin-bottom: 8px; display: inline-flex; align-items: center; font-size: 10pt;"
                                  >
                                    <b
                                      >${!comment.flagged
                                        ? html`<a
                                            style="color: var(--contrast-color); font-weight: 500;"
                                            href="/upvotes?address=${comment
                                              .identity.address}"
                                            >${truncateName(comment.displayName)}</a
                                          >`
                                        : truncateName(comment.displayName)}</b
                                    >
                                    <span class="inverse-share-container" style="opacity: 0.6;">
                                      <span> • </span>
                                      <a
                                        class="meta-link"
                                        href="/stories/${getSlug(value.title)}?index=0x${index}#0x${comment.index}"
                                      >
                                        <span>
                                          ${formatDistanceToNowStrict(
                                            new Date(comment.timestamp * 1000),
                                          )}
                                        </span>
                                        <span> ago</span>
                                      </a>
                                    </span>
                                    <span class="share-container" style="opacity: 0.6;">
                                      <span> • </span>
                                      <a
                                        href="#"
                                        class="caster-link share-link"
                                        title="Share"
                                        style="white-space: nowrap;"
                                        onclick="event.preventDefault(); navigator.share({url: 'https://news.kiwistand.com/stories/${getSlug(
                                          value.title,
                                        )}?index=0x${index}#0x${comment.index}'});"
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
                                            __html: comment.title
                                              .split("\n")
                                              .map((line) => {
                                                if (line.startsWith(">")) {
                                                  return `<div style="border-left: 3px solid #ccc; padding-left: 10px; margin: 8px 0 0 0; color: #666;">${DOMPurify.sanitize(
                                                    line.substring(2),
                                                  )}</div>`;
                                                }
                                                return line.trim()
                                                  ? `<div>${DOMPurify.sanitize(
                                                      line,
                                                    )}</div>`
                                                  : "<br/>";
                                              })
                                              .join("")
                                              .replace(
                                                /(https?:\/\/[^\s<]+)/g,
                                                (url) => {
                                                  const sanitizedUrl = DOMPurify.sanitize(url);
                                                  const isInternal = sanitizedUrl.startsWith("https://news.kiwistand.com") || 
                                                                    sanitizedUrl.startsWith("https://staging.kiwistand.com");
                                                  return `<a class="meta-link selectable-link" href="${sanitizedUrl}" target="${
                                                    isInternal ? "_self" : "_blank"
                                                  }" onclick="${
                                                    !isInternal 
                                                      ? `if (window.ReactNativeWebView || window !== window.parent) { event.preventDefault(); window.sdk.actions.openUrl('${sanitizedUrl}'); }`
                                                      : ""
                                                  }">${sanitizedUrl}</a>`;
                                                }
                                              ),
                                          }}
                                        ></span>
                                        <div
                                          class="reactions-container"
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
                                          style="display: flex; flex-wrap: wrap; gap: 8px;"
                                        >
                                          ${["🥝", "🔥", "👀", "💯", "🤭"].map(
                                            (emoji) => {
                                              const reaction =
                                                comment.reactions.find(
                                                  (r) => r.emoji === emoji,
                                                );
                                              return html`
                                                <div
                                                  style="margin-top: 12px; display: inline-flex; align-items: center; padding: 4px 8px; background-color: var(--bg-off-white); border: var(--border); border-radius: 2px; font-size: 10pt;"
                                                >
                                                  <span
                                                    style="margin-right: ${reaction?.reactorProfiles?.filter(
                                                      (profile) =>
                                                        profile.safeAvatar,
                                                    )?.length
                                                      ? "4px"
                                                      : "0"}"
                                                    >${emoji}</span
                                                  >
                                                  ${reaction?.reactorProfiles
                                                    ?.filter(
                                                      (profile) =>
                                                        profile.safeAvatar,
                                                    )
                                                    .map(
                                                      (profile, i) => html`
                                                        <img
                                                          loading="lazy"
                                                          src="${profile.safeAvatar}"
                                                          alt="reactor"
                                                          style="z-index: ${i}; width: ${i >
                                                          0
                                                            ? "13px"
                                                            : "12px"}; height: ${i >
                                                          0
                                                            ? "13px"
                                                            : "12px"}; border-radius: 2px; border: ${i >
                                                          0
                                                            ? "1px solid var(--bg-off-white)"
                                                            : "var(--border)"}; margin-left: ${i >
                                                          0
                                                            ? "-4px"
                                                            : "0"};"
                                                        />
                                                      `,
                                                    )}
                                                </div>
                                              `;
                                            },
                                          )}
                                        </div>`}
                                </div>
                              </div>
                            </span>`,
                        )}
                      </div>
                    </td>
                  </tr>`
                : null}
              <tr>
                <td>
                  <nav-comment-input data-story-index="0x${index}" data-custom-style='{"margin": "16px 11px"}'>
                    <div style="margin: 16px 11px;">
                      <textarea
                        style="font-size: 1rem; border: var(--border); background-color: white; display: block; width: 100%; padding: 10px; border-radius: 2px; resize: vertical;"
                        rows="12"
                        disabled
                      ></textarea>
                      <span style="color: #828282; font-size: 10pt;">Characters remaining: 10,000</span>
                      <br />
                      <br />
                      <div style="display: flex; align-items: center; justify-content: space-between;">
                        <button
                          style="width: auto; padding: 8px 16px; background-color: var(--hn-orange); color: white; border: none; border-radius: 2px; font-size: 10pt; cursor: not-allowed; opacity: 0.5; margin-bottom: 10px;"
                          id="button-onboarding"
                          disabled
                        >
                          Loading...
                        </button>
                        <span class="meta-link drawer-link" style="font-size: 0.8rem; color: #828282;">comment guidelines</span>
                      </div>
                    </div>
                  </nav-comment-input>
                </td>
              </tr>
              <tr style="height: 20px;"></tr>
            </table>
            ${Footer(theme, path)}
          </div>
        </div>
      </body>
    </html>
  `;
}
