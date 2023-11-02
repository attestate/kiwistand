//@format
import url from "url";

import htm from "htm";
import vhtml from "vhtml";

import * as ens from "../ens.mjs";
import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import Sidebar from "./components/sidebar.mjs";
import Head from "./components/head.mjs";
import * as karma from "../karma.mjs";
import * as registry from "../chainstate/registry.mjs";
import { EIP712_MESSAGE } from "../constants.mjs";

const html = htm.bind(vhtml);

export default async function (trie, theme, identity) {
  const users = karma.ranking();

  const allowlist = await registry.allowlist();
  let combinedUsers = [];
  for await (let address of allowlist.values()) {
    const foundUser = users.find(
      // TODO: Should start using ethers.utils.getAddress
      (user) => user.identity.toLowerCase() === address.toLowerCase(),
    );
    const karma = foundUser ? foundUser.karma : "0";

    const ensData = await ens.resolve(address);

    combinedUsers.push({
      identity: address,
      karma,
      safeAvatar: ensData.safeAvatar,
      displayName: ensData.displayName,
    });
  }
  combinedUsers.sort((a, b) => parseInt(b.karma) - parseInt(a.karma));

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
                    ${combinedUsers.map(
                      (user, i) => html`
                        <a
                          href="/upvotes?address=${user.identity}"
                          style="color: inherit; text-decoration: none;"
                        >
                          <div
                            style="display: flex; justify-content: space-between; align-items: center; padding: 8px; box-sizing: border-box;"
                          >
                            <div style="width: 8%; text-align: left;">
                              ${i + 1}.
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
            </table>
          </div>
        </div>
        ${Footer(theme, "/community")}
      </body>
    </html>
  `;
}
