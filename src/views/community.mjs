//@format
import url from "url";
import { env } from "process";
import qs from "qs";

import htm from "htm";
import vhtml from "vhtml";

import * as ens from "../ens.mjs";
import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import Sidebar from "./components/sidebar.mjs";
import Head from "./components/head.mjs";
import * as karma from "../karma.mjs";
import * as registry from "../chainstate/registry.mjs";
import {
  twitterSvg,
  githubSvg,
  warpcastSvg,
  telegramSvg,
  discordSvg,
  websiteSvg,
} from "./components/socialNetworkIcons.mjs";

const html = htm.bind(vhtml);

const iconsStyles = "color: black; width: 17px;";

async function resolveUsers(users) {
  return await Promise.all(
    users.map(async (user) => ({
      ...user,
      ensData: await ens.resolve(user.identity),
    })),
  );
}

export async function paginate(users, allowlist, page, search) {
  const combinedUsers = allowlist.map((address) => {
    const user = users.find(
      (u) => u.identity.toLowerCase() === address.toLowerCase(),
    );
    const karma = user ? user.karma : "0";
    return { identity: address, karma };
  });

  const pageSize = env.TOTAL_USERS;
  const start = pageSize * page;
  const end = pageSize * (page + 1);

  let pageUsers;
  let totalUsers;

  if (search && !!search.length) {
    const combinedUsersWithEns = await resolveUsers(combinedUsers);
    totalUsers = combinedUsersWithEns.filter(
      (user) =>
        user.ensData.displayName &&
        user.ensData.displayName.split(".")[0].match(search.toLowerCase()),
    );
    const sorted = totalUsers.sort(
      (a, b) => parseInt(b.karma) - parseInt(a.karma),
    );
    pageUsers = sorted.slice(start, end);
  } else {
    totalUsers = combinedUsers;
    const sorted = totalUsers.sort(
      (a, b) => parseInt(b.karma) - parseInt(a.karma),
    );
    pageUsers = await resolveUsers(sorted.slice(start, end));
  }

  return {
    usersData: pageUsers,
    totalPages: Math.ceil(totalUsers.length / pageSize),
    pageSize,
  };
}

export default async function (trie, theme, query, identity) {
  let page = parseInt(query.page);
  if (isNaN(page) || page < 1) {
    page = 0;
  }
  const search = query.search;

  console.log("search", search);

  const users = karma.ranking();
  const allowlist = Array.from(await registry.allowlist());

  const { usersData, totalPages, pageSize } = await paginate(
    users,
    allowlist,
    page,
    search,
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
        <style>
          .user-row {
            display: flex;
            justify-content: space-between;
            align-items: start;
            padding: 8px;
            box-sizing: border-box;
            margin-bottom: 10px;
          }
          .user-data {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .user-upvote-link {
            color: inherit;
            text-decoration: none;
            display: flex;
            align-items: center;
            width: 100%;
          }
          .user-social-links {
            display: flex;
            gap: 15px;
            margin-left: 40px;
          }
          .user-karma {
            flex: none;
            min-width: 100px;
            padding-right: 15px;
            text-align: right;
          }
          @media (min-width: 601px) {
            .user-row {
              align-items: start;
              margin-bottom: 0;
            }
            .user-data {
              flex-direction: row;
              gap: 30px;
            }
            .user-social-links {
              margin-left: 0;
            }
            .user-karma {
              font-size: 1.2em;
            }
          }
        </style>
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
                  <form>
                    <input
                      name="search"
                      id="search"
                      placeholder="search users by name"
                    />
                    <button type="submit">Search</button>
                  </form>
                  ${search &&
                  html`<div><p>Search by: ${search}</p><a href="/community">Reset</button></a>`}
                </td>
              </tr>
              <tr>
                <td>
                  <div style="padding-top: 5px; width: 100%;">
                    ${usersData &&
                    usersData.map(
                      ({ identity, ensData, karma }, i) => html`
                        <div class="user-row">
                          <div class="user-data">
                            <a
                              href="/upvotes?address=${identity}"
                              class="user-upvote-link"
                            >
                              <div style="min-width:40px">
                                ${i + 1 + page * pageSize}.
                              </div>
                              <div style="display: flex; align-items: center;">
                                <div
                                  style="width: 20px; height: 20px; box-sizing: border-box;"
                                >
                                  ${ensData.safeAvatar
                                    ? html`<img
                                        src="${ensData.safeAvatar}"
                                        style="width: 20px; height: 20px; border-radius: 100%; margin-right: 15px;"
                                      />`
                                    : html`
                                        <zora-zorb
                                          style="margin-right: 15px;"
                                          size="20px"
                                          address="${identity}"
                                        ></zora-zorb>
                                      `}
                                </div>
                                <div style="margin-left: 10px; flex-grow: 1;">
                                  ${ensData.displayName}
                                </div>
                              </div>
                            </a>
                            <div class="user-social-links">
                              ${ensData.url &&
                              ensData.url.startsWith("https://")
                                ? html` <a target="_blank" href="${ensData.url}"
                                    >${websiteSvg(iconsStyles)}</a
                                  >`
                                : ""}
                              ${ensData.twitter
                                ? html` <a
                                    href="https://twitter.com/${ensData.twitter}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    >${twitterSvg(iconsStyles)}</a
                                  >`
                                : ""}
                              ${ensData.github
                                ? html` <a
                                    href="https://github.com/${ensData.github}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    >${githubSvg(iconsStyles)}</a
                                  >`
                                : ""}
                              ${ensData.telegram
                                ? html` <a
                                    href="https://t.me/${ensData.telegram}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    >${telegramSvg(iconsStyles)}</a
                                  >`
                                : ""}
                              ${ensData.discord
                                ? html` <a
                                    href="https://discordapp.com/users/${ensData.discord}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    >${discordSvg(iconsStyles)}</a
                                  >`
                                : ""}
                              ${ensData.farcaster && ensData.farcaster.username
                                ? html` <a
                                    href="https://warpcast.com/${ensData
                                      .farcaster.username}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    >${warpcastSvg(iconsStyles)}</a
                                  >`
                                : ""}
                            </div>
                          </div>

                          <div class="user-karma">${karma} ${theme.emoji}</div>
                        </div>
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
                    html`
                      <a href="?${qs.stringify({ ...query, page: page - 1 })}">
                        Previous
                      </a>
                    `}
                    ${page + 1 < totalPages &&
                    html`
                      <a href="?${qs.stringify({ ...query, page: page + 1 })}">
                        Next
                      </a>
                    `}
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
