//@format
import { env } from "process";

import htm from "htm";
import vhtml from "vhtml";
import { isSameDay, formatDistanceToNow, sub, add } from "date-fns";
import normalizeUrl from "normalize-url";
import { plot } from "svg-line-chart";

import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import Sidebar from "./components/sidebar.mjs";
import Head from "./components/head.mjs";
import * as store from "../store.mjs";
import * as registry from "../chainstate/registry.mjs";
import * as ens from "../ens.mjs";

const html = htm.bind(vhtml);

const classify = (messages) => {
  const firstAmplify = {};

  return messages
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((message) => {
      const href = normalizeUrl(!!message.href && message.href);

      if (message.type === "amplify") {
        if (!firstAmplify[href]) {
          firstAmplify[href] = true;
          return { verb: "submit", message };
        } else {
          return { verb: "upvote", message };
        }
      }

      if (message.type === "comment") {
        return { verb: "comment", message };
      }
    })
    .sort((a, b) => b.message.timestamp - a.message.timestamp);
};

function timestampToDate(ts) {
  const date = new Date(ts * 1000);
  return date.toISOString().split("T")[0];
}

function calculateCumulativeMessages(messagesWithAddresses) {
  const messageMap = new Map();
  let cumulativeTotal = 0;

  // Sort messages by date
  const sortedMessages = [...messagesWithAddresses].sort(
    (a, b) => a.timestamp - b.timestamp,
  );

  for (const msg of sortedMessages) {
    const date = new Date(msg.timestamp * 1000).toISOString().split("T")[0];

    if (!messageMap.has(date)) {
      messageMap.set(date, cumulativeTotal);
    }

    cumulativeTotal++;
    messageMap.set(date, cumulativeTotal);
  }

  const dates = Array.from(messageMap.keys()).sort();
  const messages = dates.map((date) => messageMap.get(date));

  return { dates, messages };
}

function calculateDelegationPercentages(messagesWithAddresses) {
  const delegationMap = new Map();

  for (const msg of messagesWithAddresses) {
    const date = new Date(msg.timestamp * 1000).toISOString().split("T")[0];
    const isDelegated = msg.signer !== msg.identity;

    if (!delegationMap.has(date)) {
      delegationMap.set(date, { total: 0, delegated: 0 });
    }

    const currentEntry = delegationMap.get(date);
    currentEntry.total++;
    if (isDelegated) {
      currentEntry.delegated++;
    }
    delegationMap.set(date, currentEntry);
  }

  const dates = generateDateRange(
    Math.min(...Array.from(delegationMap.keys(), (key) => new Date(key))),
    Math.max(...Array.from(delegationMap.keys(), (key) => new Date(key))),
  );
  for (const date of dates) {
    if (!delegationMap.has(date)) {
      delegationMap.set(date, { total: 0, delegated: 0 });
    }
  }

  const sortedDates = dates.sort();
  const percentages = sortedDates.map((date) => {
    const data = delegationMap.get(date);
    return data.total !== 0 ? (data.delegated / data.total) * 100 : 0;
  });

  return { dates: sortedDates, percentages };
}

function generateDateRange(start, end) {
  const dates = [];
  let currentDate = new Date(start);

  while (currentDate <= end) {
    dates.push(currentDate.toISOString().split("T")[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
}

function calculateActions(messages) {
  const actionMap = new Map();

  for (const action of messages) {
    const date = timestampToDate(action.message.timestamp);

    if (!actionMap.has(date)) {
      actionMap.set(date, { submit: 0, upvote: 0, comment: 0 });
    }

    const currentEntry = actionMap.get(date);
    currentEntry[action.verb]++;
    actionMap.set(date, currentEntry);
  }

  const dates = generateDateRange(
    Math.min(...Array.from(actionMap.keys(), (key) => new Date(key))),
    Math.max(...Array.from(actionMap.keys(), (key) => new Date(key))),
  );
  for (const date of dates) {
    if (!actionMap.has(date)) {
      actionMap.set(date, { submit: 0, upvote: 0, comment: 0 });
    }
  }

  const sortedDates = dates.sort();
  const submissions = sortedDates.map((date) => actionMap.get(date).submit);
  const upvotes = sortedDates.map((date) => actionMap.get(date).upvote);
  const comments = sortedDates.map((date) => actionMap.get(date).comment);

  return { dates: sortedDates, submissions, upvotes, comments };
}

export default async function (trie, theme) {
  const from = null;
  const amount = null;
  const parser = JSON.parse;
  const startDatetime = null;
  const accounts = await registry.accounts();
  const delegations = await registry.delegations();
  const href = null;
  const messages = await store.posts(
    trie,
    from,
    amount,
    parser,
    startDatetime,
    accounts,
    delegations,
    href,
    "amplify",
  );
  const comments = await store.posts(
    trie,
    from,
    amount,
    parser,
    startDatetime,
    accounts,
    delegations,
    href,
    "comment",
  );

  const cacheEnabled = true;
  const messagesWithAddresses = await Promise.all(
    [...messages, ...comments].filter((msg) => {
      const messageDate = new Date(msg.timestamp * 1000);
      const cutOffDate = new Date(2023, 3); // months are 0-indexed in JS, so 3 is April
      return messageDate >= cutOffDate;
    }),
  );

  const actions = classify(messagesWithAddresses);
  const behavior = calculateActions(actions);

  const options = {
    props: {
      style: "display:block;margin:0 auto;",
    },
    margin: 3,
    width: 70,
    height: 30,
    polygon: {
      fill: "none",
      style: "fill:url(#polygrad);",
      strokeWidth: 0.01,
      stroke: "white",
    },
    line: {
      fill: "none",
      strokeWidth: 0.1,
      stroke: "black",
    },
    polygonGradient: {
      offSet1: "0%",
      stopColor1: "#ffffff00",
      offSet2: "100%",
      stopColor2: "#ffffff00",
    },
    xAxis: {
      strokeWidth: 0.1,
      stroke: "black",
    },
    yAxis: {
      strokeWidth: 0.1,
      stroke: "black",
    },
    xLabel: {
      fontSize: 1,
    },
    yLabel: {
      fontSize: 1,
    },
    xGrid: {
      strokeWidth: 0.05,
      stroke: "lightgrey",
    },
    yGrid: {
      strokeWidth: 0.05,
      stroke: "lightgrey",
    },
    yNumLabels: 10,
  };

  const cumulativeMessagesData = calculateCumulativeMessages(
    messagesWithAddresses,
  );
  options.yLabel.name = "Cumulative Messages";
  options.xLabel.name = "";
  const cumulativeMessagesChart = plot(html)(
    {
      x: cumulativeMessagesData.dates.map((date) => new Date(date)),
      y: cumulativeMessagesData.messages,
    },
    options,
  );

  const delegationData = calculateDelegationPercentages(messagesWithAddresses);
  options.yLabel.name = "% (delegated addresses)";
  options.xLabel.name = "";
  const delegationChart = plot(html)(
    {
      x: delegationData.dates.map((date) => new Date(date)),
      y: delegationData.percentages,
    },
    options,
  );

  options.yLabel.name = "Submissions";
  options.xLabel.name = "";
  const submissionsChart = plot(html)(
    {
      x: behavior.dates.map((date) => new Date(date)),
      y: behavior.submissions,
    },
    options,
  );

  options.yLabel.name = "Upvotes";
  options.xLabel.name = "";
  const upvotesData = {
    x: behavior.dates.map((date) => new Date(date)),
    y: behavior.upvotes,
  };
  const upvotesChart = plot(html)(upvotesData, options);

  options.yLabel.name = "Comments";
  options.xLabel.name = "";
  const commentsData = {
    x: behavior.dates.map((date) => new Date(date)),
    y: behavior.comments,
  };
  const commentsChart = plot(html)(commentsData, options);
  return html`
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
              <tr>
                <td style="padding: 20px;">
                  <h2>PROTOCOL BASICS CHARTS</h2>
                  <p>
                    <b>Cumulative Total Messages</b>
                    <br />
                    <br />
                    <b>Definition: </b>This chart shows the cumulative total
                    number of messages posted on Kiwi P2P network over time.
                    Each point on the chart represents the total number of
                    messages posted up to and including that day.
                  </p>
                  ${cumulativeMessagesChart}
                  <p>
                    <b>% of messages signed with delegation key </b>
                    <br />
                    <br />
                    <b>Definition: </b>This chart shows the percentage of users
                    who used our OP contract to delegate their keys so that they
                    can use Kiwi without confirming every signature to upvote
                    and submit.
                  </p>
                  ${delegationChart}
                  <p>
                    <b>Submissions DEFINITION:</b>
                    <br />
                    - Any new link submitted to Kiwi News
                  </p>
                  ${submissionsChart}
                  <p>
                    <b>Upvotes DEFINITION:</b>
                    <br />
                    - Any upvote to Kiwi News
                  </p>
                  ${upvotesChart}
                  <p>
                    <b>Comments DEFINITION:</b>
                    <br />
                    - Any comment on Kiwi News
                  </p>
                  ${commentsChart}
                </td>
              </tr>
            </table>
          </div>
        </div>
        ${Footer(theme)}
      </body>
    </html>
  `;
}
