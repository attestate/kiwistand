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
import ThirdHeader from "./components/thirdheader.mjs";
import Head from "./components/head.mjs";
import * as store from "../store.mjs";
import * as registry from "../chainstate/registry.mjs";
import * as id from "../id.mjs";
import * as moderation from "./moderation.mjs";
import cache, { getAllComments } from "../cache.mjs";

const html = htm.bind(vhtml);

function truncateComment(comment, maxLength = 260) {
  if (comment.length <= maxLength) return comment;
  return comment.slice(0, comment.lastIndexOf(" ", maxLength)) + "...";
}

function generateCommentRow(activity, identity, borderColor, theme) {
  const comment = DOMPurify.sanitize(truncateComment(activity.message.title));
  const avatar = identity.safeAvatar
    ? html`<img
        src="/avatar/${identity.address}"
        alt="avatar"
        style="border: 1px solid #828282; width: 28px; height: 28px; border-radius: 2px; margin-top: 1.5rem;"
      />`
    : "";

  const [_, index] = activity.message.href.split(":");
  const link = `/stories?index=${index}&cacheBuster=${activity.message.index}#0x${activity.message.index}`;

  return html`
    <tr>
      <td>
        <div style="display: flex; border-bottom: 1px solid ${borderColor};">
          <div
            style="flex: 0.15; display: flex; align-items: start; justify-content:
 center;"
          >
            ${avatar}
          </div>
          <div
            style="padding-top: 10px; flex: 0.85; display: flex; flex-direction: column;"
          >
            <div style="font-size: 0.9rem; margin-right: 2rem;">
              <p style="margin-top: 8px; margin-bottom: 2px;">
                <strong>
                  <a style="color: ;" href="${link}">
                    <span style="color: ${theme.color};"
                      >${identity.displayName}</span
                    >
                    <span> commented on </span>
                    <span style="color: ${theme.color};"
                      >${DOMPurify.sanitize(
                        activity.message.submission_title,
                      )}</span
                    >
                  </a>
                </strong>
              </p>
              <p
                style="line-height: 1.2; white-space: pre-wrap; margin: 5px 0 1rem 0; color: gray; word-break: break-word;"
              >
                <a
                  class="comment-text-link"
                  style="color: gray;"
                  href="${DOMPurify.sanitize(link)}"
                  >${DOMPurify.sanitize(comment)}</a
                >
              </p>
            </div>
          </div>
        </div>
      </td>
    </tr>
  `;
}

export async function page(theme, notifications) {
  const feed = notifications.map((activity) => {
    const identity = activity.identities[0];
    const borderColor = "rgba(0,0,0,0.10)";
    return generateCommentRow(activity, identity, borderColor, theme);
  });
  const content = html`
    <html lang="en" op="news">
      <head>
        ${Head}
      </head>
      <body>
        <div class="container">
          ${Sidebar()}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr class="third-header">
                ${ThirdHeader(theme, "comments")}
              </tr>
              <tr
                style="display: block; padding-bottom: 6px; background-color: #e6e6df"
              >
                <td></td>
              </tr>
              ${feed}
            </table>
          </div>
        </div>
        ${Footer(theme, "/comments")}
      </body>
    </html>
  `;
  return content;
}

export async function data() {
  const config = await moderation.getLists();
  const cutoff = sub(new Date(), {
    weeks: 2,
  });
  let comments = getAllComments();
  comments = moderation
    .flag(comments, config)
    .filter((comment) => !comment.flagged);

  const activities = comments.map((comment) => {
    return {
      verb: "commented",
      message: comment,
      timestamp: comment.timestamp,
      identities: [comment.identity],
    };
  });

  let notifications = [];
  for await (let activity of activities) {
    const identities = [];
    for await (let identity of activity.identities) {
      const ensData = await ens.resolve(identity);

      identities.push({
        address: identity,
        ...ensData,
      });
    }
    notifications.push({
      ...activity,
      identities,
    });
  }
  return {
    notifications: notifications,
  };
}
