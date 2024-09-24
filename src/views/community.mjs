//@format
import url from "url";
import { env } from "process";

import ethers from "ethers";
import htm from "htm";
import vhtml from "vhtml";
import DOMPurify from "isomorphic-dompurify";

import * as ens from "../ens.mjs";
import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import Sidebar from "./components/sidebar.mjs";
import { custom } from "./components/head.mjs";
import * as karma from "../karma.mjs";
import * as registry from "../chainstate/registry.mjs";

const html = htm.bind(vhtml);

const iconsStyles = "color: black; width: 20px;";

async function resolveUsers(users) {
  const resolvedUsers = await Promise.allSettled(
    users.map((user) =>
      ens.resolve(user.identity).then((ensData) => ({
        ...user,
        ensData,
      })),
    ),
  );

  return resolvedUsers
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
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
        user.ensData.displayName
          .split(".")[0]
          .match(search.toLowerCase().trim()),
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

function toSparks(wei) {
  return ethers.utils.commify(wei / 1000000000000n);
}

async function points(identity) {
  const points = await karma.resolve(identity);
  let rank = await karma.rank(identity);
  if (rank === 0) {
    const allowlist = Array.from(await registry.allowlist());
    rank = allowlist.length;
  }
  const ogImage = "https://news.kiwistand.com/kiwi_community_page.png";
  return html`
    <div
      style="margin: 1rem; border: 1px solid rgba(0,0,0,0.05); border-radius: 2px; background-color: rgba(0,0,0,0.05);"
    >
      <div
        style="display: flex; justify-content: space-between; align-items: center; padding:
 1rem 2rem 0 1rem;"
      >
        <span
          style="padding: 0 0 1rem 0; border: 1px solid rgba(0,0,0,0.05); border-radius: 2px; background-color: rgba(0,0,0,0.05);"
        >
          <span
            style="padding: 1rem 1rem 0 1rem; font-weight: bold; font-size: 2rem;"
            class="kiwi-number"
            >${points.toLocaleString("en-US")}</span
          >
          <br />
          <span style="font-family: monospace; padding: 0 1rem 1rem 1rem;"
            >Your points</span
          >
        </span>
        <span style="font-size: 3rem;">🥝</span>
      </div>
      <div
        style="font-family: monospace; border: 1px solid rgba(0,0,0,0.05); border-radius: 2px; background-color: rgba(0,0,0,0.05);display: flex; justify-content: space-between; align-items: center; margin: 1rem; padding: 1rem;"
      >
        <span style="font-weight: bold; font-size: 1.25rem; color:black;"
          >Your Rank</span
        >
        <span style="font-size: 2rem;">#${rank.toLocaleString("en-US")}</span>
      </div>
    </div>
  `;
}

export default async function (trie, theme, query, identity) {
  let page = parseInt(query.page);
  if (isNaN(page) || page < 1) {
    page = 0;
  }
  const search = DOMPurify.sanitize(query.search);

  const users = karma.ranking();
  const allowlist = Array.from(await registry.allowlist());

  const revenueMap = await registry.aggregateRevenue();

  const { usersData, totalPages, pageSize } = await paginate(
    users,
    allowlist,
    page,
    search,
  );

  const ogImage = "https://news.kiwistand.com/kiwi_community_page.png";
  const path = "/community";
  return html`
    <html lang="en" op="news">
      <head>
        ${custom(ogImage)}
        <meta
          name="description"
          content="Meet the Kiwi News community, which curates our feed. You can also check out our leaderboard to see who's most active."
        />
        <style>
          .kiwi-number {
            background: linear-gradient(
              145deg,
              #4d6002,
              #5a7003,
              #657f04,
              #709005,
              #7ca006,
              #88b007
            );
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            display: inline-block;
          }
          .user-row {
            display: flex;
            justify-content: space-between;
            align-items: start;
            padding: 12px 8px;
            box-sizing: border-box;
            font-size: 0.95rem;
          }
          .user-row:nth-child(odd) {
            background-color: rgba(0, 0, 0, 0.05);
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
            gap: 24px;
            margin-left: 50px;
            padding: 10px 0 5px 0;
          }
          .user-karma {
            flex: none;
            padding-right: 7px;
            text-align: right;
            height: 20px;
            display: flex;
            align-items: center;
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
          .search-container {
            display: flex;
          }

          .search-container {
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 10px 1rem;
          }

          .search-input {
            flex-grow: 1;
            height: 40px;
            font-size: 1.05rem;
            border-radius: 0;
            border: 1px solid black;
            padding-left: 1rem;
          }
          .search-input:focus {
            outline: none;
            box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.25);
          }

          @media (min-width: 601px) {
            .search-container {
              justify-content: start;
            }
            .search-input {
              width: calc(100% - 120px); /* Adjust based on the button width */
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          ${Sidebar(path)}
          <div id="hnmain" class="scaled-hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                <td>
                  ${identity ? await points(identity) : null}
                  <p style="color: black; padding: 5px 1rem; font-size: 14pt;">
                    <b>COMMUNITY</b>
                  </p>
                  <form class="search-container">
                    <input
                      class="search-input"
                      name="search"
                      id="search"
                      placeholder="search users by name"
                    />
                    <button
                      type="submit"
                      style="font-size: 1.05rem; border-radius: 0; border: 1px solid black; height: 40px; width: auto; padding: 6px 15px;"
                      id="button-onboarding"
                    >
                      Search
                    </button>
                  </form>
                  <div
                    style="justify-content: space-between; margin: 10px 1rem; font-size: 1.05rem; display:flex;"
                  >
                    ${search &&
                    html`<span>Searched by: ${search} </span>
                      <a style="padding-right: 5px;" href="/community"
                        >Reset</a
                      > `}
                  </div>
                </td>
              </tr>
              <tr>
                <td>
                  <div style="padding-top: 25px; width: 100%;">
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
                                        loading="lazy"
                                        src="${DOMPurify.sanitize(
                                          ensData.safeAvatar,
                                        )}"
                                        style="border: 1px solid #828282; width: 20px; height: 20px; border-radius: 2px; margin-right: 15px;"
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
                          </div>

                          <div class="user-karma">
                            ${revenueMap[ensData.address] &&
                            BigInt(revenueMap[ensData.address]) >
                              100000000000000n
                              ? html`<a href="/referral"
                                  ><span
                                    id="spark-container"
                                    style="border-bottom: 2px dotted; margin-right: 0.5rem;"
                                  >
                                    ✧
                                    ${toSparks(
                                      revenueMap[ensData.address] || "0",
                                    )}
                                  </span></a
                                >`
                              : null}
                            <span
                              style="display: inline-block; min-width: 75px;"
                              >${karma.toLocaleString()} ${theme.emoji}</span
                            >
                          </div>
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
                      <a
                        href="?${new URLSearchParams({
                          search,
                          page: page - 1,
                        }).toString()}"
                      >
                        Previous
                      </a>
                    `}
                    ${page + 1 < totalPages &&
                    html`
                      <a
                        href="?${new URLSearchParams({
                          search,
                          page: page + 1,
                        }).toString()}"
                      >
                        Next
                      </a>
                    `}
                  </div>
                </td>
              </tr>
            </table>
            ${Footer(theme, "/community")}
          </div>
        </div>
      </body>
    </html>
  `;
}
