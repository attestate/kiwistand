//@format
import { env } from "process";
import url from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import { formatDistanceToNow, sub } from "date-fns";
import { plot } from "svg-line-chart";

import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import Sidebar from "./components/sidebar.mjs";
import Head from "./components/head.mjs";
import * as store from "../store.mjs";
import * as moderation from "./moderation.mjs";
import * as id from "../id.mjs";

const html = htm.bind(vhtml);

function timestampToDate(ts) {
  const date = new Date(ts * 1000);
  return date.toISOString().split("T")[0];
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

function calculateDAU(messages) {
  const dauMap = new Map();

  for (const msg of messages) {
    const date = timestampToDate(msg.timestamp);
    const cacheEnabled = true;
    const address = id.ecrecover(msg, cacheEnabled);

    if (!dauMap.has(date)) {
      dauMap.set(date, new Set());
    }

    dauMap.get(date).add(address);
  }

  const dates = generateDateRange(
    Math.min(...Array.from(dauMap.keys(), (key) => new Date(key))),
    Math.max(...Array.from(dauMap.keys(), (key) => new Date(key)))
  );
  for (const date of dates) {
    if (!dauMap.has(date)) {
      dauMap.set(date, new Set());
    }
  }

  const sortedDates = dates.sort();
  const daus = sortedDates.map((date) => dauMap.get(date).size);

  return { dates: sortedDates, daus };
}

export default async function (trie, theme) {
  const from = null;
  const amount = null;
  const parser = JSON.parse;
  const messages = await store.leaves(trie, from, amount, parser);

  const { dates, daus } = calculateDAU(messages);

  const x = dates.map((date) => new Date(date));
  const y = daus;
  const chart = plot(html)(
    { x, y },
    {
      props: {
        style: "display:block;margin:0 auto;",
      },
      margin: 3,
      width: 70,
      height: 30,
      title: "Daily Active Users",
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
    }
  );

  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
      </head>
      <body>
        ${Sidebar}
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
            <tr>
              <td style="padding: 20px;">
                <p>
                  <b>DEFINITION:</b>
                  <br />
                  - To calculate the values on this chart we're getting all
                  messages that have occurred in the p2p network and analyze
                  them.
                  <br />
                  - We consider someone a Daily Active User if, for a given day,
                  they've, at least, interacted on the site once by either
                  upvoting or submitting a new link.
                  <br />
                  - As the protocol doesn't track individual users, we consider
                  each Ethereum address as individual users.
                  <br />
                  - To learn more about the metrics we want to track at Kiwi
                  News, <span>visit </span>
                  <a
                    style="color:black;"
                    href="https://hackmd.io/oF8S12EnTpSp8CtkigJosQ"
                    >Key Metrics for Growth of Kiwi News</a
                  >
                </p>
                ${chart}
              </td>
            </tr>
          </table>
          ${Footer(theme)}
        </center>
      </body>
    </html>
  `;
}
