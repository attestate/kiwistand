//@format
import { env } from "process";
import url from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import { formatDistanceToNow, sub } from "date-fns";

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
      const address = id.ecrecover(message);
      const href = normalizeUrl(!!message.href && message.href);

      if (message.type === "amplify" && !firstAmplify[href]) {
        firstAmplify[href] = true;
        return { address, verb: "submitted", message };
      } else {
        return { address, verb: "upvoted", message };
      }
    })
    .sort((a, b) => b.message.timestamp - a.message.timestamp);
};

function generateRow(activity, i) {
  let backgroundColor;
  if (i % 2 === 0) {
    backgroundColor = "rgba(0,0,0,0.03)";
  } else {
    backgroundColor = "rgba(0,0,0,0)";
  }
  let title;
  if (activity.message.title === "") {
    title = activity.message.href;
  } else {
    title = activity.message.title;
  }
  return html`
    <tr style="background-color:${backgroundColor}">
      <td style="padding: 3px 6px 3px 6px;">
        ${formatDistanceToNow(new Date(activity.message.timestamp * 1000))}
        <span> ago: </span>
        <ens-name address=${activity.address} />

        <span> ${activity.verb} </span>
        "<a href="${activity.message.href}">${title}</a>"
      </td>
    </tr>
  `;
}

export default async function (trie, theme) {
  const config = await moderation.getBanlist();

  const cutoff = sub(new Date(), {
    days: 3,
  });
  const cutoffUnixtime = Math.floor(cutoff.getTime() / 1000);
  const from = null;
  const amount = null;
  const parser = JSON.parse;
  let leaves = await store.leaves(trie, from, amount, parser, cutoffUnixtime);
  leaves = moderation.moderate(leaves, config);

  const activities = generateFeed(leaves);
  return html`
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
            ${activities.map(generateRow)}
          </table>
          ${Footer}
        </center>
      </body>
    </html>
  `;
}
