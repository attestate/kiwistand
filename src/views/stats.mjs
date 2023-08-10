//@format
import { env } from "process";
import url from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import { formatDistanceToNow, sub, add } from "date-fns";
import { plot } from "svg-line-chart";

import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import Sidebar from "./components/sidebar.mjs";
import Head from "./components/head.mjs";
import * as store from "../store.mjs";
import * as registry from "../chainstate/registry.mjs";
import * as ens from "../ens.mjs";
import { classify } from "./upvotes.mjs";

const html = htm.bind(vhtml);

function timestampToDate(ts) {
  const date = new Date(ts * 1000);
  return date.toISOString().split("T")[0];
}

async function countDelegations() {
  const delegationLogs = await registry.delegations();
  const delegateCounts = {};

  // Count the number of times each delegate address appears
  for (const delegate of Object.values(delegationLogs)) {
    if (!delegateCounts[delegate]) {
      delegateCounts[delegate] = 0;
    }
    delegateCounts[delegate]++;
  }

  // Get the ENS name for each delegate address
  const delegates = Object.keys(delegateCounts);
  for (const delegate of delegates) {
    const ensData = await ens.resolve(delegate);
    delegateCounts[ensData.displayName] = delegateCounts[delegate];
    delete delegateCounts[delegate];
  }

  return delegateCounts;
}

// Generate array of dates between start and end
function generateDateRange(start, end) {
  const dates = [];
  let currentDate = new Date(start);

  while (currentDate <= end) {
    dates.push(currentDate.toISOString().split("T")[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
}

function calculateWAU(messagesWithAddresses) {
  const wauMap = new Map();
  const sortedMessages = [...messagesWithAddresses].sort(
    (a, b) => a.timestamp - b.timestamp
  );
  const startDate = new Date(sortedMessages[0].timestamp * 1000);
  const endDate = new Date(
    sortedMessages[sortedMessages.length - 1].timestamp * 1000
  );
  const allDates = generateDateRange(startDate, endDate);

  allDates.forEach((date) => {
    const weekStart = sub(new Date(date), { days: 7 });
    const weekUsers = new Set();

    sortedMessages.forEach((message) => {
      const messageDate = new Date(message.timestamp * 1000);
      if (messageDate >= weekStart && messageDate <= new Date(date)) {
        weekUsers.add(message.identity);
      }
    });

    wauMap.set(date, weekUsers.size);
  });

  const dates = Array.from(wauMap.keys()).sort();
  const waus = dates.map((date) => wauMap.get(date));

  return { dates, waus };
}

function calculateMAU(messagesWithAddresses) {
  const sortedMessages = [...messagesWithAddresses].sort(
    (a, b) => a.timestamp - b.timestamp
  );
  const startDate = new Date(sortedMessages[0].timestamp * 1000);
  const endDate = new Date();
  const mauMap = new Map();

  for (let day = startDate; day <= endDate; day.setDate(day.getDate() + 1)) {
    const dayStart = sub(day, { days: 30 });
    const users = new Set();

    for (const msg of sortedMessages) {
      const msgDate = new Date(msg.timestamp * 1000);
      if (msgDate >= dayStart && msgDate <= day) {
        users.add(msg.identity);
      }
    }

    mauMap.set(day.toISOString().split("T")[0], users.size);
  }

  const dates = Array.from(mauMap.keys());
  const maus = Array.from(mauMap.values());

  return { dates, maus };
}

function calculateDAU(messagesWithAddresses) {
  const dauMap = new Map();
  const dates = generateDateRange(
    Math.min(
      ...messagesWithAddresses.map((msg) => new Date(msg.timestamp * 1000))
    ),
    Math.max(
      ...messagesWithAddresses.map((msg) => new Date(msg.timestamp * 1000))
    )
  );

  for (const date of dates) {
    dauMap.set(date, new Set());
  }

  for (const msg of messagesWithAddresses) {
    const date = new Date(msg.timestamp * 1000).toISOString().split("T")[0];
    const identity = msg.identity;

    if (dauMap.has(date)) {
      dauMap.get(date).add(identity);
    }
  }

  const sortedDates = dates.sort();
  const daus = sortedDates.map((date) => dauMap.get(date).size);

  return { dates: sortedDates, daus };
}

function calculateActions(messages) {
  const actionMap = new Map();

  for (const action of messages) {
    const date = timestampToDate(action.message.timestamp);

    if (!actionMap.has(date)) {
      actionMap.set(date, { submit: 0, upvote: 0 });
    }

    const currentEntry = actionMap.get(date);
    currentEntry[action.verb]++;
    actionMap.set(date, currentEntry);
  }

  const dates = generateDateRange(
    Math.min(...Array.from(actionMap.keys(), (key) => new Date(key))),
    Math.max(...Array.from(actionMap.keys(), (key) => new Date(key)))
  );
  for (const date of dates) {
    if (!actionMap.has(date)) {
      actionMap.set(date, { submit: 0, upvote: 0 });
    }
  }

  const sortedDates = dates.sort();
  const submissions = sortedDates.map((date) => actionMap.get(date).submit);
  const upvotes = sortedDates.map((date) => actionMap.get(date).upvote);

  return { dates: sortedDates, submissions, upvotes };
}

function calculateDAUMAUratio(dauData, mauData) {
  const ratioData = { dates: dauData.dates, ratios: [] };

  for (let i = 0; i < dauData.dates.length; i++) {
    const dau = dauData.daus[i];
    const mau = mauData.maus[i];

    let ratio = dau / mau;
    ratio = Math.min(ratio, 1);

    ratioData.ratios.push(ratio);
  }

  return ratioData;
}

function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function getFirstDayOfWeek(year, week) {
  var date = new Date(year, 0, 1 + (week - 1) * 7);
  var day = date.getDay();
  var day = day == 0 ? 7 : day;
  date.setDate(date.getDate() + 1 - day);
  return date;
}

export default async function (trie, theme) {
  const from = null;
  const amount = null;
  const parser = JSON.parse;
  const startDatetime = null;
  const allowlist = await registry.allowlist();
  const delegations = await registry.delegations();
  const messages = await store.posts(
    trie,
    from,
    amount,
    parser,
    startDatetime,
    allowlist,
    delegations
  );

  const cacheEnabled = true;
  const messagesWithAddresses = await Promise.all(
    messages.filter((msg) => {
      const messageDate = new Date(msg.timestamp * 1000);
      const cutOffDate = new Date(2023, 3); // months are 0-indexed in JS, so 3 is April
      return messageDate >= cutOffDate;
    })
  );

  const dauData = calculateDAU(messagesWithAddresses);
  const actions = classify(messagesWithAddresses);
  const behavior = calculateActions(actions);
  const mauData = calculateMAU(messagesWithAddresses);
  const wauData = calculateWAU(messagesWithAddresses);

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

  const dauChart = plot(html)(
    { x: dauData.dates.map((date) => new Date(date)), y: dauData.daus },
    options
  );
  const mauChart = plot(html)(
    {
      x: mauData.dates.map((date) => new Date(date)),
      y: mauData.maus,
    },
    options
  );
  const ratioData = calculateDAUMAUratio(dauData, mauData);
  const optionsCopy = { ...options };
  optionsCopy.margin = 0;

  const ratioChart = plot(html)(
    { x: ratioData.dates.map((date) => new Date(date)), y: ratioData.ratios },
    optionsCopy
  );

  const wauChart = plot(html)(
    {
      x: wauData.dates.map((date) => new Date(date)),
      y: wauData.waus,
    },
    options
  );

  const submissionsChart = plot(html)(
    {
      x: behavior.dates.map((date) => new Date(date)),
      y: behavior.submissions,
    },
    options
  );

  const upvotesData = {
    x: behavior.dates.map((date) => new Date(date)),
    y: behavior.upvotes,
  };
  const upvotesChart = plot(html)(upvotesData, options);
  const delegationCounts = await countDelegations();

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
                ${Header(theme)}
              </tr>
              <tr>
                <td style="padding: 20px;">
                  <p>
                    <b>Daily Active Users DEFINITION:</b>
                    <br />
                    - To calculate the values on this chart we're getting all
                    messages that have occurred in the p2p network and analyze
                    them.
                    <br />
                    - We consider someone a Daily Active User if, for a given
                    day, they've, at least, interacted on the site once by
                    either upvoting or submitting a new link.
                    <br />
                    - As the protocol doesn't track individual users, we
                    consider each Ethereum address as individual users.
                    <br />
                    - To learn more about the metrics we want to track at Kiwi
                    News, <span>visit </span>
                    <a
                      style="color:black;"
                      href="https://hackmd.io/oF8S12EnTpSp8CtkigJosQ"
                      >Key Metrics for Growth of Kiwi News</a
                    >
                  </p>
                  ${dauChart}
                  <p>
                    <b>7-day Active Users (WAU) DEFINITION:</b>
                    <br />
                    - To calculate the values on this chart, we're analyzing all
                    messages that have occurred in the p2p network.
                    <br />
                    - We consider someone a 7-day Active User if, for a given
                    period of 7 days, they've, at least, interacted on the site
                    once by either upvoting or submitting a new link.
                    <br />
                    - As the protocol doesn't track individual users, we
                    consider each Ethereum address as individual users.
                    <br />
                    - To learn more about the metrics we want to track at Kiwi
                    News, <span>visit </span>
                    <a
                      style="color:black;"
                      href="https://hackmd.io/oF8S12EnTpSp8CtkigJosQ"
                      >Key Metrics for Growth of Kiwi News</a
                    >
                  </p>
                  ${wauChart}
                  <p>
                    <b>30-day Active Users DEFINITION:</b>
                    <br />
                    - To calculate the values on this chart we're getting all
                    messages that have occurred in the p2p network and analyze
                    them.
                    <br />
                    - We consider someone a 30-day Active User if, for the last
                    30 days, they've, at least, interacted on the site once by
                    either upvoting or submitting a new link.
                    <br />
                    - As the protocol doesn't track individual users, we
                    consider each Ethereum address as individual users.
                    <br />
                    - To learn more about the metrics we want to track at Kiwi
                    News, <span>visit </span>
                    <a
                      style="color:black;"
                      href="https://hackmd.io/oF8S12EnTpSp8CtkigJosQ"
                      >Key Metrics for Growth of Kiwi News</a
                    >
                  </p>
                  ${mauChart}
                  <p>
                    <b>DAU/MAU Ratio DEFINITION:</b>
                    <br />
                    - This ratio is calculated by dividing the Daily Active
                    Users (DAU) by the Monthly Active Users (MAU) for each day.
                    <br />
                    - It gives us a measure of "stickiness" of our user base,
                    i.e., how often users come back to the site.
                    <br />
                    Precisely, it measures the precentage of MAUs being DAUs.
                    <br />
                    - A higher DAU/MAU ratio indicates a more engaged user base.
                  </p>
                  ${ratioChart}
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
                  <div>
                    <b>Delegation Counts</b>
                    <p>
                      - This list shows the number of times each delegate
                      address appears in the delegation logs.<br />
                      - The delegate addresses are represented by their ENS
                      names or truncated addresses if no EN name is
                      available.<br />
                      _ Each item in the list represents a custody address and
                      the number of times they've delegated to a local key.
                    </p>
                    <ul>
                      ${Object.entries(delegationCounts).map(
                        ([delegate, count]) =>
                          html`<li>${delegate}: ${count}</li>`
                      )}
                    </ul>
                  </div>
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
