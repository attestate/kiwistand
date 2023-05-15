//@format
import url from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";

import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import * as store from "../store.mjs";
import * as id from "../id.mjs";
import * as moderation from "./moderation.mjs";

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
    const address = id.ecrecover(message);

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
  const config = await moderation.getBanlist();
  const from = null;
  const amount = null;
  const parser = JSON.parse;
  let leaves = await store.leaves(trie, from, amount, parser);
  leaves = moderation.moderate(leaves, config);
  const users = countPoints(leaves);
  const totalKarma = users.reduce((total, obj) => total + obj.karma, 0);

  return html`
    <html lang="en" op="news">
      <head>
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-21BKTD0NKN"
        ></script>
        <script src="ga.js"></script>
        <meta charset="utf-8" />
        <meta name="referrer" content="origin" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link
          rel="apple-touch-icon"
          sizes="152x152"
          href="apple-touch-icon.png"
        />
        <link rel="stylesheet" type="text/css" href="news.css" />
        <link rel="shortcut icon" href="favicon.ico" />
        <title>Kiwi News</title>
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
                  <b>COMMUNITY:</b> Click their names to see their profiles.
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
                            <span> (${user.karma} ${theme.emoji})</span>
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              `
            )}
          </table>
          ${Footer}
        </center>
      </body>
    </html>
  `;
}
