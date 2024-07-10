//@format
import { env } from "process";

import htm from "htm";
import vhtml from "vhtml";
import { sub, add } from "date-fns";
import { plot } from "svg-line-chart";

import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import Sidebar from "./components/sidebar.mjs";
import Head from "./components/head.mjs";
import * as store from "../store.mjs";
import * as registry from "../chainstate/registry.mjs";

const html = htm.bind(vhtml);

async function calculateRetention31Days(
  messagesWithAddresses,
  cohortStartDays,
  cohortEndDays,
) {
  // NOTE:
  //
  // We have to get mints from 2 weeks ago and track them to 1 week ago
  const now = new Date();
  const cohortStart = sub(now, { days: cohortStartDays });
  const cohortEnd = sub(now, { days: cohortEndDays });

  const accounts = await registry.accounts();
  const cohort = {};
  const minters = [];
  for (let [identity, { start, balance }] of Object.entries(accounts)) {
    const mintDate = new Date(start * 1000);
    if (mintDate < cohortStart || mintDate > cohortEnd) continue;

    minters.push(identity);
    cohort[identity] = {
      mintDate: new Date(start * 1000),
      activity: Array(32).fill(false),
    };
  }

  const totalDays = 32;
  for (let [identity, props] of Object.entries(cohort)) {
    const userMsgs = messagesWithAddresses.filter((message) => {
      const msgDate = new Date(message.timestamp * 1000);
      return (
        message.identity === identity &&
        msgDate > cohortStart &&
        msgDate < cohortEnd
      );
    });
    // NOTE: If the user hasn't sent any messages, we'll leave all activity for
    // the month as false, which is already the default value.
    if (userMsgs.length === 0) continue;

    for (let i = 0; i < totalDays; i++) {
      // NOTE: This is a sliding window of one day starting from the mintDate
      //
      // mintDate head ---- tail
      //
      //                 ^- so e.g. here, msgDate is larger than head and
      //                    smaller than tail
      //
      const head = add(props.mintDate, { days: i });
      const tail = add(head, { days: 1 });
      const wasActive = userMsgs.some((message) => {
        const msgDate = new Date(message.timestamp * 1000);
        const included = msgDate > head && msgDate < tail;
        //console.log(
        //  "head",
        //  head,
        //  "tail,",
        //  tail,
        //  "msg",
        //  msgDate,
        //  included,
        //  "day",
        //  i,
        //);
        return included;
      });
      cohort[identity].activity[i] = wasActive;
    }
  }

  const usersActivePerDay = Array(totalDays).fill(0);
  const retentionPerDay = Array(totalDays).fill(0);
  const cohortSize = Object.keys(cohort).length;
  for (let i = 0; i < totalDays; i++) {
    for (let { activity } of Object.values(cohort)) {
      if (activity[i]) {
        usersActivePerDay[i] += 1;
        retentionPerDay[i] = (usersActivePerDay[i] / cohortSize) * 100;
      }
    }
  }

  return retentionPerDay;
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
  const retentiond7w0 = await calculateRetention31Days(
    messagesWithAddresses,
    7,
    0,
  );
  options.yLabel.name = "% (minters active in first 7 days)";
  options.xLabel.name = "days since mint";
  const retentionChartd7w0 = plot(html)(
    {
      x: Array.from({ length: 32 }, (_, i) => i),
      y: retentiond7w0,
    },
    options,
  );

  const retentiond7w1 = await calculateRetention31Days(
    messagesWithAddresses,
    14,
    7,
  );
  const retentionChartd7w1 = plot(html)(
    {
      x: Array.from({ length: 32 }, (_, i) => i),
      y: retentiond7w1,
    },
    options,
  );

  const retentiond7w2 = await calculateRetention31Days(
    messagesWithAddresses,
    21,
    14,
  );
  const retentionChartd7w2 = plot(html)(
    {
      x: Array.from({ length: 32 }, (_, i) => i),
      y: retentiond7w2,
    },
    options,
  );

  const retentiond30m0 = await calculateRetention31Days(
    messagesWithAddresses,
    30,
    0,
  );
  options.yLabel.name = "% (minters active in first 30 days)";
  options.xLabel.name = "days since mint";
  const retentionChartd30m0 = plot(html)(
    {
      x: Array.from({ length: 32 }, (_, i) => i),
      y: retentiond30m0,
    },
    options,
  );

  const retentiond30m1 = await calculateRetention31Days(
    messagesWithAddresses,
    60,
    30,
  );
  const retentionChartd30m1 = plot(html)(
    {
      x: Array.from({ length: 32 }, (_, i) => i),
      y: retentiond30m1,
    },
    options,
  );

  const retentiond30m2 = await calculateRetention31Days(
    messagesWithAddresses,
    90,
    60,
  );
  const retentionChartd30m2 = plot(html)(
    {
      x: Array.from({ length: 32 }, (_, i) => i),
      y: retentiond30m2,
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
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                <td style="padding: 20px;">
                  <h2>PROTOCOL RETENTION</h2>
                  <p>
                    - When we talk about "bounded" retention, we mean as a16z
                    defines it
                    <span> </span>
                    <a
                      href="https://a16z.com/do-you-have-lightning-in-a-bottle-how-to-benchmark-your-social-app/"
                      >here</a
                    >.
                    <br />
                  </p>
                  <p>
                    <b>d7 bounded retention (cohort that minted 7d ago)</b>
                    <br />
                  </p>
                  ${retentionChartd7w0}
                  <p>
                    <b>d7 bounded retention (cohort that minted 14d ago)</b>
                    <br />
                  </p>
                  ${retentionChartd7w1}
                  <p>
                    <b>d7 bounded retention (cohort that minted 21d ago)</b>
                    <br />
                  </p>
                  ${retentionChartd7w2}
                  <p>
                    <b>d30 bounded retention (cohort that minted 30d ago)</b>
                    <br />
                  </p>
                  ${retentionChartd30m0}
                  <p>
                    <b>d30 bounded retention (cohort that minted 60d ago)</b>
                    <br />
                  </p>
                  ${retentionChartd30m1}
                  <p>
                    <b>d30 bounded retention (cohort that minted 90d ago)</b>
                    <br />
                  </p>
                  ${retentionChartd30m2}
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
