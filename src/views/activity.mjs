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
import * as store from "../store.mjs";
import * as registry from "../chainstate/registry.mjs";
import * as id from "../id.mjs";
import * as moderation from "./moderation.mjs";
import cache, {
  getUpvotes,
  getComments,
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
  const [_, index] = activity.message.href.split(":");
  const link = `/stories?index=${index}&cacheBuster=${activity.message.index}#0x${activity.message.index}`;
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
        <a data-no-instant="${i < 3}" class="notification" href="${link}">
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
    }

    const title = DOMPurify.sanitize(
      activity.message.title || activity.message.href,
    );
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
            href="/stories?index=0x${activity.message
              .index}${identities.length > 0
              ? `&upvoter=${identities[identities.length - 1].address}`
              : ""}"
            class="upvote-notification notification"
          >
            <div
              style="display: flex; border-bottom: 1px solid rgba(0,0,0,0.1);"
            >
              <div
                class="votearrow"
                style="font-size: 1.5rem; flex: 0.15; display: flex; align-items: center; justify-content: center; color: ${theme.color};"
                title="upvote"
              >
                ${iconSVG}
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

export async function page(theme, identity, notifications, lastUpdate, isQueryParamVersion) {
  identity = DOMPurify.sanitize(identity);
  let feed = html`
    <tr>
      <td
        class="feed-container"
        style="text-align: center; vertical-align: middle; min-height: 100vh; padding: 20px; color: #828282;"
      >
        <svg
          viewBox="0 0 512 512"
          xmlns="http://www.w3.org/2000/svg"
          fill="#505050"
          class="kiwi-svg"
        >
          <path
            d="M251.615 74.23c-77.058.06-152.457 51.774-181.7 89.022C1.473 250.43-36.964 427.192 244.208 381.209c82.987-13.571 135.481-92.932 146.56-163.43 39.376 13.812 99.225-2.416 100.503-38.236 1.713-48.028-82.63-99.395-130.756-60.74-33.239-32.311-71.268-44.602-108.9-44.573zm189.384 101.54a9 9 0 0 1 9 9 9 9 0 0 1-9 9 9 9 0 0 1-9-9 9 9 0 0 1 9-9zm27.278 56.154c-8.908 4.545-18.736 7.692-29.059 9.242 21.96 44.054 29.427 92.59 45.61 138.432 2.761-32.499 2.588-94.97-16.551-147.674zM238.494 401.426a239.162 239.162 0 0 1-18.141 3.78l21.887 45.798c-18.37-.055-38.017.352-58.946 1.387l-11.842-44.215c-6.45-.31-12.826-.9-19.105-1.764l12.598 47.041c-7.103.46-14.296.969-21.664 1.578l1.484 17.938c76.27-6.31 137.96-4.22 183.404-.008l1.66-17.922c-19.613-1.818-42.188-3.236-67.525-3.793z"
          />
        </svg>
        <p class="notification-text">
          😢 Don't be sad kiwi! There are no new notifications for you yet! But
          you can submit some links and your upvotes will appear on this site!
          <span> </span>
          <a href="/submit" style="color: #828282; text-decoration: underline;"
            >Submit a link now!</a
          >
          😊
        </p>
      </td>
    </tr>
  `;
  feed = notifications.map(generateRow(lastUpdate, theme));
  const preloadNotifs = notifications.slice(0, 3).map(linkFromComment);
  const content = html`
    <html lang="en" op="news">
      <head>
        ${prefetchHead(["/", "/new?cached=true", "/submit", ...preloadNotifs])}
        ${isQueryParamVersion ? html`
          <script>
            // Update lastUpdate cookie via fetch when using query param version
            fetch('/api/v1/activity/timestamp', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                address: '${identity}',
                lastUpdate: ${lastUpdate}
              })
            });
          </script>
        ` : ''}
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
      identities.push(...results
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value)
      );
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
