//@format
import url from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";

import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";
import * as store from "../store.mjs";
import * as id from "../id.mjs";
import * as moderation from "./moderation.mjs";
import * as registry from "../chainstate/registry.mjs";

const html = htm.bind(vhtml);

const countPoints = (messages) => {
  messages = messages.sort((a, b) => a.timestamp - b.timestamp);
  const submissions = new Map();
  const points = {};

  function add(points, address) {
    if (
      typeof points[address] !== undefined &&
      Number.isInteger(points[address])
    ) {
      points[address] += 1;
    } else {
      points[address] = 1;
    }
  }

  messages.forEach((message) => {
    const normalizedUrl = normalizeUrl(message.href);
    const cacheEnabled = true;
    const address = id.ecrecover(message, cacheEnabled);

    if (!submissions.has(normalizedUrl)) {
      submissions.set(normalizedUrl, address);
      add(points, address);
    } else {
      const submitter = submissions.get(normalizedUrl);
      add(points, submitter);
    }
  });

  const list = [];
  for (const [address, karma] of Object.entries(points)) {
    list.push({ address, karma });
  }

  return list.sort((a, b) => b.karma - a.karma);
};

export default async function (trie, theme) {
  const config = await moderation.getLists();
  const from = null;
  const amount = null;
  const parser = JSON.parse;
  let leaves = await store.leaves(trie, from, amount, parser);
  leaves = moderation.moderate(leaves, config);
  let users = countPoints(leaves);
  const totalKarma = users.reduce((total, obj) => total + obj.karma, 0);

  const allowList = await registry.allowlist();
  const inactiveUsers = allowList
    .filter((address) => {
      return !users.find((user) => user.address === address);
    })
    .map((address) => ({ karma: "0", address }));
  users = [...users, ...inactiveUsers];

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
            <tr>
              <td>
              <p style="color: black; padding: 5px; font-size: 14pt;">
              <b>COMMUNITY</b>
              </p>
              <p style="color: black; padding: 3px; font-size: 12pt;">
              Kiwi News is curated by the crypto community.
              <br />
              <br />
              The links you see in the Top and New feeds have been submitted and upvoted by the Kiwi NFT holders.
              They earn Kiwi points for every link they share and every upvote their link receives.
              You can check each community member's profiles and link contributions by clicking on their names.
              <br />
              <br />
              If you want to join our community and earn Kiwi points, <a href=https://news.kiwistand.com/welcome>mint the Kiwi NFT</a>.
              </p>
              <p style="color: black; padding: 5px; font-size: 14pt;">
              <b>LEADERBOARD</b>
              </p>
              </td>
            </tr>
            ${users.map(
              (user, i) => html`
                <tr>
                  <td>
                    <table
                      style="padding: 5px;"
                      border="0"
                      cellpadding="0"
                      cellspacing="0"
                    >
                      <tr class="athing" id="35233479">
                        <td align="right" valign="top" class="title">
                          <span style="padding-right: 5px" class="rank"
                            >${i + 1}.
                          </span>
                        </td>
                        <td valign="top" class="votelinks">
                          <center>
                            <a id="up_35233479" class="clicky" href="#">
                              <div
                                style="display: none;"
                                class="votearrow"
                                title="upvote"
                              ></div>
                            </a>
                          </center>
                        </td>
                        <td class="title">
                          <span class="titleline">
                            <ens-name address=${user.address} />
                            <span> </span>
                            <span> (${user.karma} ${theme.emoji})</span>
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              `
            )}
            <tr>
              <td>
                <hr />
                <p style="color: black; padding: 5px; font-size: 14pt;">
                  <b>Disperse Template:</b>
                  <br />
                  <span
                    >To donate to those that have submitted useful content, you
                    can use the CSV below on
                  </span>
                  <span> </span>
                  <a href="https://disperse.app/">disperse.app</a> to donate
                  funds. The total funds add up to 0.01 ETH. Works on Optimism.
                </p>
              </td>
            </tr>
            <tr>
              <td>
                <pre>
${users.map(
                    (user) => `${user.address},${(
                      (user.karma / totalKarma) *
                      0.01
                    ).toFixed(18)}
`
                  )}
                </pre
                >
              </td>
            </tr>
          </table>
          ${Footer(theme)}
        </center>
      </body>
    </html>
  `;
}
