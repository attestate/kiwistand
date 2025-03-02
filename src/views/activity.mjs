//@format
import { env } from "process";
import url from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import { formatDistanceToNow, sub } from "date-fns";
import { utils } from "ethers";
import DOMPurify from "isomorphic-dompurify";

import * as ens from "../ens.mjs";
import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import { prefetchHead } from "./components/head.mjs";
import { iconSVG } from "./components/row.mjs";
import { getSlug } from "../utils.mjs";
// Define the brand green color directly
const theme = { color: "#00b67a" };
import * as store from "../store.mjs";
import * as registry from "../chainstate/registry.mjs";
import * as id from "../id.mjs";
import * as moderation from "./moderation.mjs";
import cache, {
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
      const href = normalizeUrl(!!message.href && message.href, {
        stripWWW: false,
      });

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
        groupedMessages[href].verb = "upvoted";
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

function generateCommentRow(activity, identity, bgColor, theme, i) {
  const comment = DOMPurify.sanitize(truncateComment(activity.message.title));
  const avatar = identity.safeAvatar
    ? html`<img
        src="${DOMPurify.sanitize(identity.safeAvatar)}"
        loading="lazy"
        alt="avatar"
        style="border: 1px solid #828282; width: 28px; height: 28px; border-radius: 2px; margin-top: 1.5rem;"
      />`
    : "";

  const link = linkFromComment(activity);

  return html`
    <tr style="background-color: ${bgColor}">
      <td>
        <a
          data-no-instant="${i < 3}"
          class="notification"
          href="${link}"
          onclick="if(!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button !== 1) document.getElementById('spinner-overlay').style.display='block'"
        >
          <div style="display: flex; border-bottom: 1px solid rgba(0,0,0,0.1);">
            <div
              style="flex: 0.15; display: flex; align-items: start; justify-content: center;"
            >
              ${avatar}
            </div>
            <div
              style="padding-top: 10px; flex: 0.85; display: flex; flex-direction: column;"
            >
              <div style="font-size: 0.9rem; margin-right: 1rem;">
                <p
                  class="notification-title"
                  style="margin-top: 8px; margin-bottom: 2px;"
                >
                  <strong>
                    <span>${identity.displayName}</span>
                    <span style="font-weight: normal;"> commented on </span>
                    <span
                      >${DOMPurify.sanitize(
                        activity.message.submission_title,
                      )}</span
                    >
                  </strong>
                </p>
                <p
                  style="line-height: 1.2; white-space: pre-wrap; margin: 5px 0 1rem 0; word-break: break-word;"
                >
                  <span style="text-align: justify;">${comment}</span>
                </p>
              </div>
            </div>
          </div>
        </a>
      </td>
    </tr>
  `;
}

function generateRow(lastUpdate, theme) {
  return (activity, i) => {
    const bgColor =
      lastUpdate < activity.timestamp ? "rgba(255,255,255,0.3)" : "none";

    if (activity.verb === "commented" || activity.verb === "involved") {
      const identity = activity.identities[0];
      return generateCommentRow(activity, identity, bgColor, theme, i);
    } else if (activity.verb === "reacted") {
      const identity = activity.identities[0];
      const emoji = activity.emoji;
      const commentTitle = activity.message.comment_title;
      const submissionTitle = activity.message.submission_title;
      const commentId = activity.message.commentId;
      const submissionId = activity.message.submissionId;

      // Extract the index from the submission ID (format: kiwi:0x...)
      const submissionIndex = submissionId.split(":")[1];

      return html`
        <tr style="background-color: ${bgColor};">
          <td>
            <a
              data-no-instant="${i < 3}"
              class="notification"
              href="/stories/${getSlug(
                submissionTitle,
              )}?index=${submissionIndex}#${commentId.split(":")[1]}"
              onclick="if(!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button !== 1) document.getElementById('spinner-overlay').style.display='block'"
            >
              <div
                style="display: flex; border-bottom: 1px solid rgba(0,0,0,0.1);"
              >
                <div
                  style="flex: 0.15; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative;"
                >
                  <div style="position: relative; width: 48px; height: 48px;">
                    ${identity.safeAvatar
                      ? html`
                          <div
                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;"
                          >
                            <img
                              src="${DOMPurify.sanitize(identity.safeAvatar)}"
                              loading="lazy"
                              alt="reactor avatar"
                              style="width: 36px; height: 36px; border: 1px solid #828282; border-radius: 2px; background-color: white; box-shadow: 0 0 3px rgba(0,0,0,0.2);"
                            />
                          </div>
                          <div
                            style="position: absolute; bottom: -5px; right: -5px;"
                          >
                            <span style="font-size: 1.2rem;">${emoji}</span>
                          </div>
                        `
                      : html`
                          <div
                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;"
                          >
                            <span style="font-size: 2rem;">${emoji}</span>
                          </div>
                        `}
                  </div>
                </div>
                <div
                  style="padding-top: 10px; flex: 0.85; display: flex; flex-direction: column;"
                >
                  <div style="font-size: 0.9rem; margin-right: 1rem;">
                    <p
                      class="notification-title"
                      style="margin-top: 8px; margin-bottom: 2px;"
                    >
                      <strong>
                        <span>${identity.displayName}</span>
                        <span style="font-weight: normal;"> reacted with</span>
                        <span style="font-size: 1.2em;"> ${emoji} </span>
                        <span style="font-weight: normal;">
                          to your comment on
                        </span>
                        <span> </span>
                        <span>${DOMPurify.sanitize(submissionTitle)}</span>
                      </strong>
                    </p>
                    <p
                      style="line-height: 1.2; white-space: pre-wrap; margin: 5px 0 1rem 0; word-break: break-word;"
                    >
                      <span style="text-align: justify; color: #666;"
                        >${DOMPurify.sanitize(
                          truncateComment(commentTitle),
                        )}</span
                      >
                    </p>
                  </div>
                </div>
              </div>
            </a>
          </td>
        </tr>
      `;
    }

    const title = DOMPurify.sanitize(activity.message.title);
    const identity = activity.identities[activity.identities.length - 1];
    const size = 28;
    const identities = activity.identities
      .reverse()
      .filter((identity) => identity.safeAvatar)
      .slice(0, 5);

    return html`
      <tr style="background-color: ${bgColor};">
        <td>
          <a
            href="/stories/${getSlug(title)}?index=0x${activity.message
              .index}${identities.length > 0
              ? `&upvoter=${identities[identities.length - 1].address}`
              : ""}"
            class="upvote-notification notification"
            onclick="if(!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button !== 1) document.getElementById('spinner-overlay').style.display='block'"
          >
            <div
              style="display: flex; border-bottom: 1px solid rgba(0,0,0,0.1);"
            >
              <div
                style="flex: 0.15; display: flex; flex-direction: column; align-items: center; justify-content: center;"
              >
                <div
                  class="votearrow"
                  style="font-size: 1.5rem; display: flex; align-items: center; justify-content: center; color: ${theme.color};"
                  title="upvote"
                >
                  ${iconSVG}
                </div>
                <div
                  style="font-size: 0.7rem; font-weight: bold; color: ${theme.color}; margin-top: -5px;"
                >
                  +1 🥝
                </div>
              </div>
              <div
                style="padding-top: 10px; flex: 0.85; display: flex; flex-direction: column;"
              >
                ${identities.length > 0 &&
                identities[0].address === identity.address
                  ? html`<div
                      style="margin-left: -15px; display: flex; align-items: center;"
                    >
                      ${identities.map(
                        (identity, index) => html`
                          <img
                            src="${DOMPurify.sanitize(identity.safeAvatar)}"
                            loading="lazy"
                            alt="avatar"
                            style="width: ${size}px; height: ${size}px; border: 1px solid #828282; border-radius: 2px; margin-left: 15px;"
                          />
                        `,
                      )}
                    </div>`
                  : ""}
                <div style="font-size: 0.9rem; margin-right: 1rem;">
                  <p style="margin-top: 8px; margin-bottom: 2px;">
                    <strong>
                      ${identity.displayName}
                      <span> </span>
                    </strong>
                    ${activity.identities.length > 1
                      ? html`
                          <span>and </span>
                          ${activity.identities.length - 1}
                          <span> others </span>
                        `
                      : ""}
                    ${activity.verb} your submission
                  </p>
                  <p style="font-weight: bold; margin: 7px 0 15px 0;">
                    ${title.substring(0, 80)}
                  </p>
                  ${activity.metadata?.index && activity.metadata?.title
                    ? html`
                        <p style="font-weight: bold;">
                          ${DOMPurify.sanitize(activity.metadata.title)}
                        </p>
                      `
                    : ""}
                </div>
              </div>
            </div>
          </a>
        </td>
      </tr>
    `;
  };
}

export async function page(
  theme,
  identity,
  notifications,
  lastUpdate,
  isQueryParamVersion,
) {
  identity = DOMPurify.sanitize(identity);
  let feed;
  if (notifications.length === 0) {
    feed = html`
      <tr>
        <td
          class="feed-container"
          style="text-align: center; vertical-align: middle; min-height: 100vh; padding: 20px; color: #828282;"
        >
          <p>No notifications yet</p>
        </td>
      </tr>
    `;
  } else {
    feed = notifications.map(generateRow(lastUpdate, theme));
  }
  const preloadNotifs = notifications.slice(0, 3).map(linkFromComment);
  const content = html`
    <html lang="en" op="news">
      <head>
        ${prefetchHead(["/", "/new?cached=true", "/submit", ...preloadNotifs])}
      </head>
      <body
        data-instant-allow-query-string
        data-instant-allow-external-links
        ontouchstart=""
      >
        <div class="container">
          ${Sidebar()}
          <div id="hnmain" class="scaled-hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                <td>
                  <push-subscription-button data-wrapper="true">
                  </push-subscription-button>
                </td>
              </tr>
              <tr>
                <td
                  style="text-align: center; padding: 1rem; background-color: #f0f0f0; font-size: 0.8rem; color: #333;"
                >
                  <span
                    style="vertical-align: middle; display: inline-flex; align-items: center; flex-wrap: wrap; justify-content: center;"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 256 256"
                      style="height: 12px; width: 12px; margin-right: 0.5rem;"
                    >
                      <rect width="256" height="256" fill="none" />
                      <path
                        d="M92.69,216H48a8,8,0,0,1-8-8V163.31a8,8,0,0,1,2.34-5.65L165.66,34.34a8,8,0,0,1,11.31,0L221.66,79a8,8,0,0,1,0,11.31L98.34,213.66A8,8,0,0,1,92.69,216Z"
                        fill="none"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="16"
                      />
                      <line
                        x1="136"
                        y1="64"
                        x2="192"
                        y2="120"
                        fill="none"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="16"
                      />
                      <line
                        x1="164"
                        y1="92"
                        x2="68"
                        y2="188"
                        fill="none"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="16"
                      />
                      <line
                        x1="95.49"
                        y1="215.49"
                        x2="40.51"
                        y2="160.51"
                        fill="none"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="16"
                      />
                    </svg>
                    <strong>Notifications:</strong>
                    <span style="margin-left: 0.5rem;"
                      >Receive alerts when you submit a story or when someone
                      replies to your comment.</span
                    >
                  </span>
                </td>
              </tr>
              ${feed}
            </table>
            ${Footer(theme, "/activity")}
          </div>
        </div>
      </body>
    </html>
  `;
  return content;
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

  const config = await moderation.getLists();
  const cutoff = sub(new Date(), {
    weeks: 2,
  });

  let leaves = getUpvotes(identity);
  let comments = getComments(identity);
  let reactions = getReactionsToComments(identity);

  const path = "/activity";
  leaves = moderation.moderate(leaves, config, path);
  comments = moderation
    .flag(comments, config)
    .filter((comment) => !comment.flagged);

  const activities = generateFeed(leaves).filter(
    (activity) => activity.verb === "upvoted",
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
  for (let activity of activities) {
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
        continue;
      }
    }

    notifications.push({
      ...activity,
      identities,
    });
  }

  let lastUpdate = "0";
  if (notifications.length > 0) {
    lastUpdate = notifications[0].timestamp;
  }
  return {
    notifications: notifications.slice(0, 20),
    lastUpdate,
    latestValue,
  };
}
