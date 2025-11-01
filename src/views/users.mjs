//@format
import { env } from "process";

import htm from "htm";
import vhtml from "vhtml";
import { isSameDay, sub, add } from "date-fns";
import { plot } from "svg-line-chart";
import makeAsync from "make-asynchronous";

import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import Sidebar from "./components/sidebar.mjs";
import Head from "./components/head.mjs";
import * as store from "../store.mjs";
import * as registry from "../chainstate/registry.mjs";
import { getHashesPerDateRange, getMiniAppUpvotes } from "../cache.mjs";
import { getInteractionsForDAU } from "../interactions.mjs";

const html = htm.bind(vhtml);

function timestampToDate(ts) {
  const date = new Date(ts * 1000);
  return date.toISOString().split("T")[0];
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

function calculateWAU(messagesWithAddresses) {
  const wauMap = new Map();
  const sortedMessages = [...messagesWithAddresses].sort(
    (a, b) => a.timestamp - b.timestamp,
  );
  const startDate = new Date(sortedMessages[0].timestamp * 1000);
  const endDate = new Date(
    sortedMessages[sortedMessages.length - 1].timestamp * 1000,
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
    (a, b) => a.timestamp - b.timestamp,
  );
  const startDate = new Date(sortedMessages[0].timestamp * 1000);
  const endDate = new Date();
  const mauMap = new Map();
  let activeUsers30DaysAgo;

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

    if (isSameDay(day, sub(new Date(), { days: 30 }))) {
      activeUsers30DaysAgo = users;
    }
  }

  const dates = Array.from(mauMap.keys());
  const maus = Array.from(mauMap.values());

  return { dates, maus, activeUsers30DaysAgo };
}

function calculateDAU(messagesWithAddresses) {
  const dauMap = new Map();
  const dates = generateDateRange(
    Math.min(
      ...messagesWithAddresses.map((msg) => new Date(msg.timestamp * 1000)),
    ),
    Math.max(
      ...messagesWithAddresses.map((msg) => new Date(msg.timestamp * 1000)),
    ),
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

function calculateDAUMAUratio(dauData, mauData) {
  const ratioData = { dates: dauData.dates, ratios: [] };

  for (let i = 0; i < dauData.dates.length; i++) {
    const dau = dauData.daus[i];
    const mau = mauData.maus[i];

    let ratio = dau / mau;
    ratio = Math.min(ratio, 1);

    ratioData.ratios.push(ratio * 100);
  }

  return ratioData;
}

function calculateDAUWAUratio(dauData, wauData) {
  const ratioData = { dates: dauData.dates, ratios: [] };

  for (let i = 0; i < dauData.dates.length; i++) {
    const dau = dauData.daus[i];
    const wau = wauData.waus[i];

    let ratio = dau / wau;
    ratio = Math.min(ratio, 1);

    ratioData.ratios.push(ratio * 100);
  }

  return ratioData;
}

export default async function (trie, theme) {
  const from = null;
  const amount = null;
  const parser = JSON.parse;
  const startDatetime = null;
  const delegations = await registry.delegations();
  const href = null;
  const messages = await store.posts(
    trie,
    from,
    amount,
    parser,
    startDatetime,
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
    delegations,
    href,
    "comment",
  );

  const cacheEnabled = true;

  // Get mini app upvotes from cache
  const miniAppUpvotes = await getMiniAppUpvotes();

  // Get article interactions (impressions and clicks) from tracker
  const articleInteractions = await getInteractionsForDAU();

  const messagesWithAddresses = await makeAsync((messages, comments, miniAppUpvotes, articleInteractions) => {
    return [...messages, ...comments, ...miniAppUpvotes, ...articleInteractions].filter((msg) => {
      const messageDate = new Date(msg.timestamp * 1000);
      // NOTE: months are 0-indexed in JS, so 3 is April
      const cutOffDate = new Date(2023, 3);
      return messageDate >= cutOffDate;
    });
  })(messages, comments, miniAppUpvotes, articleInteractions);

  const dauData = calculateDAU(messagesWithAddresses);
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
      stroke: "currentColor",
    },
    line: {
      fill: "none",
      strokeWidth: 0.1,
      stroke: "currentColor",
    },
    polygonGradient: {
      offSet1: "0%",
      stopColor1: "#ffffff00",
      offSet2: "100%",
      stopColor2: "#ffffff00",
    },
    xAxis: {
      strokeWidth: 0.1,
      stroke: "currentColor",
    },
    yAxis: {
      strokeWidth: 0.1,
      stroke: "currentColor",
    },
    xLabel: {
      fontSize: 1,
    },
    yLabel: {
      fontSize: 1,
    },
    xGrid: {
      strokeWidth: 0.05,
      stroke: "var(--text-quaternary)",
    },
    yGrid: {
      strokeWidth: 0.05,
      stroke: "var(--text-quaternary)",
    },
    yNumLabels: 10,
  };

  const today = new Date();
  const yesterday = sub(today, { days: 1 });
  const d60Ago = sub(today, { days: 60 });

  const dadData = getHashesPerDateRange(d60Ago, yesterday);
  options.yLabel.name = "Daily active devices";
  options.xLabel.name = "";
  const dadChartData = {
    x: dadData.dates,
    y: dadData.counts,
  };
  const dadChart = plot(html)(dadChartData, options);

  options.yLabel.name = "Daily active users";
  options.xLabel.name = "";
  const dauChartData = {
    x: dauData.dates.map((date) => new Date(date)),
    y: dauData.daus,
  };
  const dauChart = plot(html)(dauChartData, options);

  options.yLabel.name = "Monthly active users";
  options.xLabel.name = "";
  const mauChart = plot(html)(
    {
      x: mauData.dates.map((date) => new Date(date)),
      y: mauData.maus,
    },
    options,
  );

  const ratioData = calculateDAUMAUratio(dauData, mauData);
  options.yLabel.name = "% ( DAU/MAU )";
  options.xLabel.name = "";
  const ratioChart = plot(html)(
    { x: ratioData.dates.map((date) => new Date(date)), y: ratioData.ratios },
    options,
  );

  const ratioData2 = calculateDAUWAUratio(dauData, wauData);
  options.yLabel.name = "% ( DAU/WAU )";
  options.xLabel.name = "";
  const ratioChart2 = plot(html)(
    { x: ratioData2.dates.map((date) => new Date(date)), y: ratioData2.ratios },
    options,
  );

  options.yLabel.name = "Weekly active users";
  options.xLabel.name = "";
  const wauChart = plot(html)(
    {
      x: wauData.dates.map((date) => new Date(date)),
      y: wauData.waus,
    },
    options,
  );

  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
      </head>
      <body>
        <div class="container">
          ${Sidebar()}
          <div id="hnmain" class="scaled-hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="var(--background-color0)">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                <td style="padding: 20px;">
                  <h2>USER PROTOCOL CHARTS</h2>
                  <p />
                  <p>
                    <b>Daily Active Users (DAU)</b>
                    <br />
                    <br />
                    <b>Definition:</b> We consider someone a Daily Active User
                    if, for a given day, they've at least, interacted on the
                    site once by either upvoting, submitting a new link,
                    viewing, or clicking on an article.
                  </p>
                  ${dauChart}
                  <p>
                    <b>7-day Active Users (WAU)</b>
                    <br />
                    <br />
                    <b>Definition: </b>We consider someone a 7-day Active User
                    if, for a given period of 7 days, they've, at least,
                    interacted on the site once by either upvoting, submitting
                    a new link, viewing, or clicking on an article.
                  </p>
                  ${wauChart}
                  <p>
                    <b>30-day Active Users (MAU)</b>
                    <br />
                    <br />
                    <b>Definition: </b>We consider someone a 30-day Active User
                    if, for the last 30 days, they've, at least, interacted on
                    the site once by either upvoting, submitting a new link,
                    viewing, or clicking on an article.
                  </p>
                  ${mauChart}
                  <p>
                    <b>Daily Active Devices</b>
                    <br />
                    <br />
                    <b>Definition: </b>We fingerprint every device that clicks
                    an outbound link and track it uniquely on a daily basis.
                  </p>
                  ${dadChart}
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
                    <b>DAU/WAU Ratio DEFINITION:</b>
                    <br />
                    - This ratio is calculated by dividing the Daily Active
                    Users (DAU) by the Weekly Active Users (WAU) for each day.
                    <br />
                    - It gives us a measure of "stickiness" of our user base,
                    i.e., how often users come back to the site.
                    <br />
                    Precisely, it measures the precentage of WAUs being DAUs.
                    <br />
                    - A higher DAU/WAU ratio indicates a more engaged user base.
                  </p>
                  ${ratioChart2}
                </td>
              </tr>
            </table>
            ${Footer(theme)}
          </div>
        </div>
      </body>
    </html>
  `;
}
