import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import SecondHeader from "./components/secondheader.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import { custom } from "./components/head.mjs";

import { getLeaderboard, getCurrentUserRank } from '../leaderboard.mjs';
import DOMPurify from "isomorphic-dompurify";

const html = htm.bind(vhtml);

export default async function Leaderboard(identity, theme) {
  const leaderboard = await getLeaderboard();
  const currentUserRank = await getCurrentUserRank(identity);

  const path = "/community";

  return html`
    <html lang="en" op="news">
      <head>
        ${custom("", "Leaderboard", "", "", [])}
        <script
          defer
          src="https://unpkg.com/@zoralabs/zorb@^0.0/dist/zorb-web-component.umd.js"
        ></script>
      </head>
      <body class="default" ontouchstart="">
        <div class="container">
          ${Sidebar(path)}
          <div id="hnmain" class="scaled-hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="var(--table-bg)">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                ${SecondHeader(theme, "leaderboard")}
              </tr>
              <tr>
                <td>
                  <div style="padding: 15px; max-width: 800px; margin: 0 auto;">


                    <div style="background-color: var(--table-bg); padding: 20px; border: var(--border); margin-bottom: 20px;">
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="text-align: center; flex: 1;">
                          <div style="color: var(--visited-link); font-size: 13px; margin-bottom: 6px;">Your Score</div>
                          <div style="font-size: 22px; font-weight: bold; color: black;">${currentUserRank?.karma || 'N/A'}</div>
                        </div>
                        <div style="text-align: center; flex: 1;">
                          <div style="color: var(--visited-link); font-size: 13px; margin-bottom: 6px;">Your Rank</div>
                          <div style="font-size: 22px; font-weight: bold; color: black;">${currentUserRank?.rank ? `#${currentUserRank.rank}` : 'Unranked'}</div>
                        </div>
                      </div>
                    </div>

                    <div style="background-color: var(--table-bg); border: var(--border); margin-bottom: 20px;">
                      <div style="padding: 15px; border-bottom: var(--border-thin);">
                        <h2 style="margin: 0; font-size: 18px; color: black; font-weight: 600; text-align: center;">Top Contributors</h2>
                      </div>
                      <div>
                        ${leaderboard.map((user, index) => {
                          const medals = ['🥇', '🥈', '🥉'];
                          const displayRank = index < 3 ? medals[index] : `${index + 1}.`;
                          return html`
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-bottom: ${index < leaderboard.length - 1 ? 'var(--border-thin)' : 'none'};">
                              <div style="display: flex; align-items: center; min-width: 0; flex: 1;">
                                <div style="width: 30px; text-align: center; margin-right: 12px; color: var(--visited-link); font-size: ${index < 3 ? '16px' : '14px'}; font-weight: bold;">${displayRank}</div>
                                <a 
                                  href="/upvotes?address=${user.identity}" 
                                  style="display: flex; align-items: center; min-width: 0; flex: 1; text-decoration: none; color: inherit;"
                                >
                                  ${user.ensData?.safeAvatar
                                    ? html`<img
                                        loading="lazy"
                                        src="${DOMPurify.sanitize(user.ensData.safeAvatar)}"
                                        style="border: var(--border); width: 24px; height: 24px; border-radius: 2px; margin-right: 12px; flex-shrink: 0;"
                                      />`
                                    : html`
                                        <zora-zorb
                                          style="margin-right: 12px; flex-shrink: 0;"
                                          size="24px"
                                          address="${user.identity}"
                                        ></zora-zorb>
                                      `}
                                  <span style="color: black; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px;">${user.displayName}</span>
                                </a>
                              </div>
                              <div style="color: black; font-weight: bold; margin-left: 12px; font-size: 14px;">${user.karma}</div>
                            </div>
                          `;
                        })}
                      </div>
                    </div>

                  </div>
                </td>
              </tr>
            </table>
            ${Footer(theme, path)}
          </div>
        </div>
      </body>
    </html>
  `;
}