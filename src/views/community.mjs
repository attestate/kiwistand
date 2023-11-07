//@format
import url from "url";
import { env } from "process";

import htm from "htm";
import vhtml from "vhtml";

import * as ens from "../ens.mjs";
import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import Sidebar from "./components/sidebar.mjs";
import Head from "./components/head.mjs";
import * as karma from "../karma.mjs";
import * as registry from "../chainstate/registry.mjs";

const html = htm.bind(vhtml);

export async function paginate(users, allowlist, page) {
  const combinedUsers = allowlist.map((address) => {
    const user = users.find(
      (u) => u.identity.toLowerCase() === address.toLowerCase(),
    );
    const karma = user ? user.karma : "0";
    return { identity: address, karma };
  });

  combinedUsers.sort((a, b) => parseInt(b.karma) - parseInt(a.karma));

  const pageSize = env.TOTAL_USERS;
  const start = pageSize * page;
  const end = pageSize * (page + 1);
  const pageUsers = combinedUsers.slice(start, end);

  for await (const user of pageUsers) {
    const ensData = await ens.resolve(user.identity);
    user.safeAvatar = ensData.safeAvatar;
    user.displayName = ensData.displayName;
  }

  return {
    usersData: pageUsers,
    totalPages: Math.ceil(combinedUsers.length / pageSize),
    pageSize,
  };
}

export default async function (trie, theme, page = 0, identity) {
  const users = karma.ranking();
  const allowlist = Array.from(await registry.allowlist());

  const { usersData, totalPages, pageSize } = await paginate(
    users,
    allowlist,
    page,
  );

  const path = "/community";
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
        <meta
          name="description"
          content="Meet the Kiwi News community, which curates our feed. You can also check out our leaderboard to see who's most active."
        />
      </head>
      <body>
        <div class="container">
          ${Sidebar(path)}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme, identity)}
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
                    The links you see in the Top and New feeds have been
                    submitted and upvoted by the Kiwi NFT holders. They earn
                    Kiwi points for every link they share and every upvote their
                    link receives. You can check each community member's
                    profiles and link contributions by clicking on their names.
                    <br />
                    <br />
                    If you want to join our community and earn Kiwi points,
                    <a
                      href="https://news.kiwistand.com/welcome?referral=0x6BF29B7bF810eB40312E539026E5319A10b31735"
                      >mint the Kiwi NFT</a
                    >.
                  </p>
                  <p style="color: black; padding: 5px; font-size: 14pt;">
                    <b>LEADERBOARD</b>
                  </p>
                </td>
              </tr>
              <tr>
                <td>
                  <div style="padding-top: 5px; width: 100%;">
                    ${usersData &&
                    usersData.map(
                      (user, i) => html`
                        <a
                          href="/upvotes?address=${user.identity}"
                          style="color: inherit; text-decoration: none;"
                        >
                          <div
                            style="display: flex; justify-content: space-between; align-items: center; padding: 8px; box-sizing: border-box;"
                          >
                            <div style="width: 8%; text-align: left;">
                              ${i + 1 + page * pageSize}.
                            </div>
                            <div
                              style="display: flex; align-items: center; width: 60%;"
                            >
                              <div
                                style="width: 20px; height: 20px; box-sizing: border-box;"
                              >
                                ${user.safeAvatar
                                  ? html`<img
                                      src="${user.safeAvatar}"
                                      style="width: 20px; height: 20px; border-radius: 100%; margin-right: 15px;"
                                    />`
                                  : html`
                                      <zora-zorb
                                        style="margin-right: 15px;"
                                        size="20px"
                                        address="${user.identity}"
                                      ></zora-zorb>
                                    `}
                              </div>
                              <div style="margin-left: 10px; flex-grow: 1;">
                                ${user.displayName}
                              </div>
                            </div>
                            <div
                              style="width: 32%; min-width: 100px; padding-right: 15px; text-align: right; font-size: 1.2em;"
                            >
                              ${user.karma} ${theme.emoji}
                            </div>
                          </div>
                        </a>
                      `,
                    )}
                  </div>
                </td>
              </tr>
              <tr style="height: 50px">
                <td>
                  <div
                    style="display: flex; flex-direction: row; gap: 20px; padding: 0 20px 0 20px; font-size: 1.1rem;"
                  >
                    ${page > 0 &&
                    html` <a href="?page=${page - 1}"> Previous </a> `}
                    ${page + 1 < totalPages &&
                    html` <a href="?page=${page + 1}"> Next </a> `}
                  </div>
                </td>
              </tr>
            </table>
          </div>
        </div>
        ${Footer(theme, "/community")}
      </body>
    </html>
  `;
}
