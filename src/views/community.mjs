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
  for (const address of Object.keys(points)) {
    const karma = points[address];
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
  const users = countPoints(leaves);

  const allowList = await registry.allowlist();
  const combinedUsers = allowList.map((address) => {
    const foundUser = users.find(
      (user) => user.address.toLowerCase() === address.toLowerCase()
    );
    const karma = foundUser ? foundUser.karma : "0";
    return { address, karma };
  });
  combinedUsers.sort((a, b) => parseInt(b.karma) - parseInt(a.karma));
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
            <tr>
  <td>
    <table id="leaderboard" style="padding: 5px;" border="0.5" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <th>Rank</th>
        <th>User</th>
        <th>Points</th>
      </tr>
      ${combinedUsers.map(
        (user, i) => html`
          <tr class="athing" id="35233479">
            <td align="center" class="rank">${i + 1}.</td>
            <td class="user">
              <div class="user-content">
                <div class="avatar-container">
                  <ens-avatar address=${user.address} leaderboard />
                </div>
                <div class="username-container">
                  <a href="/profile/${user.address}">
                    <ens-name address=${user.address} />
                  </a>
                </div>
              </div>
            </td>
            <td align="center" class="points">${user.karma} ${theme.emoji}</td>
          </tr>
        `
      )}
    </table>
  </td>
</tr>
</table>


          ${Footer(theme)}
        </center>
      </body>
    </html>
  `;
}
