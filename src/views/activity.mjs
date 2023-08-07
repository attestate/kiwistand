//@format
import { env } from "process";
import url from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import { formatDistanceToNow, sub } from "date-fns";
import { utils } from "ethers";

import * as ens from "../ens.mjs";
import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";
import * as store from "../store.mjs";
import * as registry from "../chainstate/registry.mjs";
import * as id from "../id.mjs";
import * as moderation from "./moderation.mjs";

const html = htm.bind(vhtml);

const generateFeed = (messages) => {
  const firstAmplify = {};

  return messages
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((message) => {
      const cacheEnabled = true;
      const href = normalizeUrl(!!message.href && message.href);

      if (message.type === "amplify" && !firstAmplify[href]) {
        firstAmplify[href] = message;
        return { identity: message.identity, verb: "submitted", message };
      } else {
        const submission = firstAmplify[href];
        return {
          identity: message.identity,
          verb: "upvoted",
          message,
          towards: submission.identity,
        };
      }
    })
    .sort((a, b) => b.message.timestamp - a.message.timestamp);
};

function generateRow(activity, i) {
  let title;
  if (activity.message.title === "") {
    title = activity.message.href;
  } else {
    title = activity.message.title;
  }
  let borderColor = i % 2 === 0 ? "rgba(0,0,0,0.05)" : "rgba(0,0,0,0.10)";

  return html`
    <tr>
      <td>
        <div
          style="display: flex; align-items: center; border-bottom: 1px solid ${borderColor}; padding: 5px;"
        >
          <div style="width: 15px; margin-right: 15px;">
            <svg
              fill="#000000"
              width="15px"
              height="15px"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 14h4v7a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-7h4a1.001 1.001 0 0 0 .781-1.625l-8-10c-.381-.475-1.181-.475-1.562 0l-8 10A1.001 1.001 0 0 0 4 14z"
              />
            </svg>
          </div>
          <div style="width: 25px; height: 25px; margin-right: 15px;">
            <zora-zorb size="25px" address="${activity.identity}"></zora-zorb>
          </div>
          <div>
            <p>
              <strong>
                <a href="/upvotes?address=${activity.identity}">
                  ${activity.displayName}
                </a>
                <span> </span>
                ${activity.verb} your submission</strong
              >
            </p>
            <p>
              <a
                href="${activity.message.href}"
                style="color: gray; word-break: break-all;"
              >
                "${title.substring(0, 80)}"
              </a>
            </p>
          </div>
        </div>
      </td>
    </tr>
  `;
}

export default async function (trie, theme, identity) {
  if (!identity) {
    return html`Address has to be a query parameter`;
  }
  if (!utils.isAddress(identity)) {
    return html`Not a valid address`;
  }

  const config = await moderation.getLists();
  const cutoff = sub(new Date(), {
    weeks: 2,
  });
  const from = null;
  const amount = null;
  const parser = JSON.parse;
  const cutoffUnixtime = Math.floor(cutoff.getTime() / 1000);
  const allowlist = await registry.allowlist();
  const delegations = await registry.delegations();
  let leaves = await store.posts(
    trie,
    from,
    amount,
    parser,
    cutoffUnixtime,
    allowlist,
    delegations
  );
  leaves = moderation.moderate(leaves, config);

  const activities = generateFeed(leaves);
  const filteredActivities = activities.filter(
    (activity) =>
      activity.verb === "upvoted" &&
      // TODO: Should start using ethers.utils.getAddress
      activity.towards.toLowerCase() === identity.toLowerCase()
  );

  let notifications = [];
  for await (let activity of filteredActivities) {
    const ensData = await ens.resolve(activity.identity);
    notifications.push({
      ...activity,
      displayName: ensData.displayName,
    });
  }

  let lastUpdate = "0";
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

  if (notifications.length > 0) {
    lastUpdate = notifications[0].message.timestamp;
    feed = notifications.map(generateRow);
  }
  const content = html`
    <html lang="en" op="news">
      <head>
        ${Head}
      </head>
      <body>
        <div class="container">
          ${Sidebar}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${Header(theme)}
              </tr>
              ${feed}
            </table>
          </div>
        </div>
        ${Footer(theme)}
      </body>
    </html>
  `;
  return {
    content,
    lastUpdate,
  };
}
