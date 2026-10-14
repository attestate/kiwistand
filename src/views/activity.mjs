
import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import { sub } from "date-fns";
import { utils } from "ethers";
import DOMPurify from "isomorphic-dompurify";

import * as ens from "../ens.mjs";
import { custom } from "./components/head.mjs";
import { Page, EmptyState, Icon, timeAgo } from "./components/n2.mjs";
import { getSlug } from "../utils.mjs";
import {
  getUpvotes,
  getComments,
  getReactionsToComments,
  getTimestamp,
  setTimestamp,
} from "../cache.mjs";

const html = htm.bind(vhtml);

const generateFeed = (messages) => {
  const groupedMessages = {};

  messages
    .sort((a, b) => a.timestamp - b.timestamp)
    .forEach((message) => {
      // Skip normalization for text posts and kiwi references
      const href = (message.href && (message.href.startsWith('data:') || message.href.startsWith('kiwi:')))
        ? message.href
        : normalizeUrl(!!message.href && message.href, { stripWWW: false });

      if (!groupedMessages[href]) {
        groupedMessages[href] = {
          identities: [],
          verb: "submitted",
          message,
          timestamp: message.timestamp,
          towards: message.identity,
          index: message.index,
        };
      } else {
        if (message.timestamp > groupedMessages[href].timestamp) {
          groupedMessages[href].timestamp = message.timestamp;
        }
        groupedMessages[href].identities.push(message.identity);
        groupedMessages[href].verb = "liked";
      }
    });

  return Object.values(groupedMessages);
};

export function truncateComment(comment, maxLength = 260) {
  if (comment.length <= maxLength) return comment;
  return comment.slice(0, comment.lastIndexOf(" ", maxLength)) + "...";
}

function linkFromComment(activity) {
  // For reaction notifications
  if (activity.verb === "reacted") {
    const submissionIndex = activity.message.submissionId.split(":")[1];
    const commentId = activity.message.commentId.split(":")[1];
    const slug = getSlug(activity.message.submission_title);
    return `/stories/${slug}?index=${submissionIndex}#${commentId}`;
  }

  // For regular comments
  const [_, index] = activity.message.href.split(":");
  const slug = getSlug(activity.message.submission_title);
  const link = `/stories/${slug}?index=${index}#0x${activity.message.index}`;
  return link;
}

const spinnerOnClick =
  "if(!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button !== 1) {var el=document.getElementById('spinner-overlay'); if(el) el.style.display='block';}";

// NOTE: Mobile shows the apps' marks (heart with "+1 🥝", the commenter's
// avatar, a spark for reactions); desktop shows a small icon box, like the
// designs.
function Avatar(identity) {
  return identity && identity.safeAvatar
    ? html`<img
        class="n2-notif-avatar"
        src="${DOMPurify.sanitize(identity.safeAvatar)}"
        loading="lazy"
        alt=""
      />`
    : html`<span class="n2-notif-avatar">${Icon("person")}</span>`;
}

function Mark(kind, identity) {
  const mobile =
    kind === "like"
      ? html`<span class="n2-notif-like"
          >${Icon("heart")}<span class="n2-notif-karma">+1 🥝</span></span
        >`
      : kind === "react"
      ? html`<span class="n2-notif-spark">${Icon("sparkle")}</span>`
      : Avatar(identity);
  const desktopIcon = { like: "heart", comment: "chat", react: "sparkle" }[
    kind
  ];
  return html`<span class="n2-notif-mark">
    <span class="n2-m">${mobile}</span>
    <span class="n2-notif-box n2-d">${Icon(desktopIcon)}</span>
  </span>`;
}

function Row({ isNew, href, i, mark, headline, comment, timestamp }) {
  return html`<li class="n2-notif${isNew ? " is-new" : ""}">
    <a
      class="n2-notif-link notification"
      href="${href}"
      data-no-instant="${i < 3}"
      onclick="${spinnerOnClick}"
    >
      ${mark}
      <span class="n2-notif-body">
        <span class="n2-notif-headline">${headline}</span>
        ${comment
          ? html`<span class="n2-notif-comment">${comment}</span>`
          : null}
        <span class="n2-notif-when">${timeAgo(timestamp)}</span>
      </span>
      ${isNew ? html`<span class="n2-notif-dot" aria-label="New"></span>` : null}
    </a>
  </li>`;
}

const Quote = (text) => html`<span class="n2-q">${text}</span>`;

function generateRow(lastUpdate) {
  return (activity, i) => {
    const isNew = lastUpdate < activity.timestamp;

    if (activity.verb === "commented" || activity.verb === "involved") {
      const identity = activity.identities[0];
      return Row({
        isNew,
        i,
        href: linkFromComment(activity),
        mark: Mark("comment", identity),
        headline: html`${identity.displayName} commented on${" "}${Quote(
            DOMPurify.sanitize(activity.message.submission_title),
          )}`,
        comment: DOMPurify.sanitize(truncateComment(activity.message.title)),
        timestamp: activity.timestamp,
      });
    }

    if (activity.verb === "reacted") {
      const identity = activity.identities[0];
      const submissionIndex = activity.message.submissionId.split(":")[1];
      const commentId = activity.message.commentId.split(":")[1];
      return Row({
        isNew,
        i,
        href: `/stories/${getSlug(
          activity.message.submission_title,
        )}?index=${submissionIndex}#${commentId}`,
        mark: Mark("react", identity),
        headline: html`${identity.displayName} reacted ${activity.emoji} to
          your comment on${" "}${Quote(
            DOMPurify.sanitize(activity.message.submission_title),
          )}`,
        comment: DOMPurify.sanitize(
          truncateComment(activity.message.comment_title),
        ),
        timestamp: activity.timestamp,
      });
    }

    const title = DOMPurify.sanitize(activity.message.title);
    const identity = activity.identities[activity.identities.length - 1];
    const upvoter = [...activity.identities]
      .reverse()
      .filter((identity) => identity.safeAvatar)
      .slice(0, 5)
      .pop();
    const others = activity.identities.length - 1;
    return Row({
      isNew,
      i,
      href: `/stories/${getSlug(title)}?index=0x${activity.message.index}${
        upvoter ? `&upvoter=${upvoter.address}` : ""
      }`,
      mark: Mark("like"),
      headline: html`${identity.displayName}${others > 0
          ? ` and ${others} ${others === 1 ? "other" : "others"}`
          : ""}${" "}liked your submission${" "}${Quote(title.substring(0, 80))}`,
      comment: null,
      timestamp: activity.timestamp,
    });
  };
}

const Heading = html`<header class="n2-page-head">
  <h1 class="n2-title">
    <span class="n2-d">Notifications</span
    ><span class="n2-m">Your notifications</span>
  </h1>
  <p class="n2-sub n2-m">The conversation continues.</p>
</header>`;

export async function page(
  theme,
  identity,
  notifications,
  lastUpdate,
  isQueryParamVersion,
) {
  identity = DOMPurify.sanitize(identity);
  const newCount = notifications.filter(
    (n) => lastUpdate < n.timestamp,
  ).length;
  const feed =
    notifications.length === 0
      ? EmptyState({ icon: "bell", text: "No notifications yet" })
      : html`<ol class="n2-notif-list">
          ${notifications.map(generateRow(lastUpdate))}
        </ol>`;
  const preloadNotifs = notifications.slice(0, 3).map(linkFromComment);
  return Page({
    theme,
    path: "/activity",
    head: custom(
      undefined,
      "Activity | Kiwi News",
      "Your latest notifications and activity on Kiwi News.",
      undefined,
      ["/", ...preloadNotifs],
    ),
    body: html`<div class="n2-notifs">
      ${Heading}
      ${newCount > 0
        ? html`<div class="n2-notifs-toolbar n2-d">
            <span class="n2-eyebrow">${newCount} new</span>
            ${
              // NOTE: Opening this page marks everything as read (the
              // lastUpdate cookie), so loading it again without the
              // lastUpdate parameter shows them as read.
              html`<a
                class="n2-mark-read"
                href="${isQueryParamVersion
                  ? `/activity?address=${identity}`
                  : "/activity"}"
                >Mark all as read</a
              >`
            }
          </div>`
        : null}
      ${feed}
    </div>`,
  });
}

// NOTE: /activity without an identity cookie, like the apps' logged-out
// notifications tab. main.jsx turns <kiwi-login-button> into a button that
// opens the login (LoginButton.jsx); the link is there until it loads.
export async function loggedOutPage(theme) {
  return Page({
    theme,
    path: "/activity",
    head: custom(
      undefined,
      "Notifications | Kiwi News",
      "Your latest notifications and activity on Kiwi News.",
    ),
    body: EmptyState({
      cls: "n2-empty-full",
      image: "/kiwi-glasses.webp",
      text: "Log in to see notifications when people like your content or reply to you.",
      action: html`<kiwi-login-button data-class="n2-btn n2-btn-wide"
        ><a class="n2-btn n2-btn-wide" href="/">Log in</a></kiwi-login-button
      >`,
    }),
  });
}

export async function data(
  trie,
  identity,
  lastRemoteValue,
  skipDetails = false,
) {
  if (!identity) {
    throw new Error("Address has to be a query parameter");
  }
  if (!utils.isAddress(identity)) {
    throw new Error("Not a valid address");
  }

  let latestValue = getTimestamp(identity);
  if (!latestValue || latestValue < lastRemoteValue) {
    latestValue = lastRemoteValue;
    setTimestamp(identity, latestValue);
  }

  const cutoff = sub(new Date(), {
    weeks: 2,
  });

  let leaves = getUpvotes(identity);
  let comments = getComments(identity);
  let reactions = getReactionsToComments(identity);

  const path = "/activity";
  const activities = generateFeed(leaves).filter(
    (activity) => activity.verb === "liked",
  );

  comments.map((comment) => {
    activities.push({
      verb: "commented",
      message: comment,
      timestamp: comment.timestamp,
      identities: [comment.identity],
    });
  });

  // Process reactions - only include them if we'll resolve ENS data later
  if (!skipDetails) {
    reactions.map((reaction) => {
      activities.push({
        verb: "reacted",
        message: reaction,
        timestamp: reaction.timestamp,
        identities: [reaction.identity],
        emoji: reaction.title,
      });
    });
  }

  activities.sort((a, b) => b.timestamp - a.timestamp);

  let notifications = [];
  await Promise.allSettled(
    activities.slice(0, 20).map(async (activity) => {
      const identities = [];
      if (!skipDetails) {
        const ensPromises = activity.identities.map(async (identity) => {
          const ensData = await ens.resolve(identity);
          return {
            address: identity,
            ...ensData,
          };
        });
        const results = await Promise.allSettled(ensPromises);
        identities.push(
          ...results
            .filter((result) => result.status === "fulfilled")
            .map((result) => result.value),
        );
      }

      // Skip reaction activities if the reactor doesn't have an avatar
      if (activity.verb === "reacted") {
        if (
          identities.length === 0 ||
          !identities.some((identity) => identity.safeAvatar)
        ) {
          return;
        }
      }

      notifications.push({
        ...activity,
        identities,
      });
    }),
  );

  // Re-sort: Promise.allSettled resolves in non-deterministic order when
  // callbacks contain awaits (e.g. ENS resolution), so the push order above
  // does not match the original sort from line 519.
  notifications.sort((a, b) => b.timestamp - a.timestamp);

  let lastUpdate = "0";
  if (notifications.length > 0) {
    lastUpdate = notifications[0].timestamp;
  }
  return {
    notifications: notifications,
    lastUpdate,
    latestValue,
  };
}
