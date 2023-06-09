//@format
import { env } from "process";
import url from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import { formatDistanceToNow, sub } from "date-fns";
import { utils } from "ethers";

import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";
import * as store from "../store.mjs";
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
        return { address: message.address, verb: "submitted", message };
      } else {
        const submission = firstAmplify[href];
        return {
          address: message.address,
          verb: "upvoted",
          message,
          towards: submission.address,
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
          <div style="width: 15px; height: 15px; margin-right: 15px;">
            <ens-avatar address=${activity.address} />
          </div>
          <div>
            <p>
              <strong
                ><ens-name address=${activity.address} /> ${activity.verb} your
                submission</strong
              >
            </p>
            <p>
              <a href="${activity.message.href}" style="color: gray;"
                >"${title}"</a
              >
            </p>
          </div>
        </div>
      </td>
    </tr>
  `;
}

export default async function (trie, theme, address) {
  if (!address) {
    return html`Address has to be a query parameter`;
  }
  if (!utils.isAddress(address)) {
    return html`Not a valid address`;
  }

  const config = await moderation.getLists();
  const cutoff = sub(new Date(), {
    weeks: 1,
  });
  const cutoffUnixtime = Math.floor(cutoff.getTime() / 1000);
  const from = null;
  const amount = null;
  const parser = JSON.parse;
  let leaves = await store.leaves(trie, from, amount, parser, cutoffUnixtime);
  leaves = moderation.moderate(leaves, config);

  const activities = generateFeed(leaves);
  const notifications = activities.filter(
    (activity) =>
      activity.verb === "upvoted" &&
      activity.towards.toLowerCase() === address.toLowerCase()
  );

  const lastUpdate =
    notifications.length > 0 ? notifications[0].message.timestamp : null;
  const content = html`
    <html lang="en" op="news">
      <head>
        ${Head}
      </head>
      <body>
        <center>
          <table
            id="hnmain"
            border="0"
            cellpadding="0"
            cellspacing="0"
            width="85%"
            bgcolor="#f6f6ef"
          >
            <tr>
              ${Header(theme)}
            </tr>
            ${notifications.map(generateRow)}
          </table>
          ${Footer(theme)}
        </center>
      </body>
    </html>
  `;
  return {
    content,
    lastUpdate,
  };
}
