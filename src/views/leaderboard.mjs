import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import SecondHeader from "./components/secondheader.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import { custom } from "./components/head.mjs";

import { getLeaderboard, getCurrentUserRank, getTimeRemainingInRound } from '../leaderboard.mjs';
import DOMPurify from "isomorphic-dompurify";

const html = htm.bind(vhtml);

export default async function Leaderboard(identity, theme) {
  const leaderboard = await getLeaderboard();
  const currentUserRank = await getCurrentUserRank(identity);
  const timeRemaining = await getTimeRemainingInRound();

  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    return `${days}d ${hours}h`;
  };

  const path = "/community"; // This page is accessed via /community

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
                      <div style="text-align: center;">
                        <h1 style="margin: 0 0 8px 0; font-size: 24px; color: black; font-weight: 600;">Weekly Rewards</h1>
                        <p style="margin: 0 0 12px 0; color: var(--visited-link); font-size: 14px;">Community rewards for the most active contributors</p>
                        
                        <!-- USDC Sponsorship -->
                        <div style="margin-top: 20px; display: flex; align-items: center; justify-content: center; gap: 12px;">
                          <img src="/usdc-logo.svg" alt="USDC" style="width: 40px; height: 40px;" />
                          <div style="text-align: left;">
                            <h2 style="margin: 0; font-size: 20px; color: black; font-weight: 600;">100 USDC Weekly Prize Pool</h2>
                            <p style="margin: 0; font-size: 13px; color: var(--visited-link);">Sponsored by @timdaub</p>
                          </div>
                        </div>
                        
                        <!-- Prize Distribution -->
                        <div style="margin-top: 16px; display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
                          <div style="padding: 12px 16px; background-color: #ffd700; background-color: rgba(255, 215, 0, 0.1); border: 1px solid #ffd700; border-radius: 4px;">
                            <div style="font-size: 12px; color: #666; margin-bottom: 2px;">1st Place</div>
                            <div style="font-size: 18px; font-weight: 600; color: black;">50 USDC</div>
                          </div>
                          <div style="padding: 12px 16px; background-color: rgba(192, 192, 192, 0.1); border: 1px solid #c0c0c0; border-radius: 4px;">
                            <div style="font-size: 12px; color: #666; margin-bottom: 2px;">2nd Place</div>
                            <div style="font-size: 18px; font-weight: 600; color: black;">30 USDC</div>
                          </div>
                          <div style="padding: 12px 16px; background-color: rgba(205, 127, 50, 0.1); border: 1px solid #cd7f32; border-radius: 4px;">
                            <div style="font-size: 12px; color: #666; margin-bottom: 2px;">3rd Place</div>
                            <div style="font-size: 18px; font-weight: 600; color: black;">20 USDC</div>
                          </div>
                        </div>
                        
                        <div style="margin-top: 16px; padding: 12px; background-color: var(--table-bg); border: var(--border-thin);">
                          <p style="margin: 0; font-size: 13px; color: var(--visited-link);">
                            <span style="font-weight: 500;">Want to increase the prize pool?</span> 
                            <span style="margin-left: 4px;">Contact us to sponsor future competitions</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    <!-- Tutorial Boxes - React component will mount here -->
                    <div id="tutorial-drawers">
                      <!-- Server-side placeholder to prevent layout shift -->
                      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                        <!-- How to Earn Box Placeholder -->
                        <div style="background-color: var(--table-bg); padding: 15px; border: var(--border); cursor: pointer; opacity: 0.8; min-height: 68px;">
                          <div style="display: flex; justify-content: space-between; align-items: center; height: 38px;">
                            <div style="display: flex; align-items: center;">
                              <div style="width: 20px; height: 20px; margin-right: 10px; background-color: #ddd; border-radius: 2px; flex-shrink: 0;"></div>
                              <div>
                                <div style="width: 80px; height: 16px; background-color: #ddd; border-radius: 2px; margin-bottom: 5px;"></div>
                                <div style="width: 120px; height: 13px; background-color: #eee; border-radius: 2px;"></div>
                              </div>
                            </div>
                            <div style="width: 16px; height: 16px; background-color: #ddd; border-radius: 2px; flex-shrink: 0;"></div>
                          </div>
                        </div>

                        <!-- Reward Tiers Box Placeholder -->
                        <div style="background-color: var(--table-bg); padding: 15px; border: var(--border); cursor: pointer; opacity: 0.8; min-height: 68px;">
                          <div style="display: flex; justify-content: space-between; align-items: center; height: 38px;">
                            <div style="display: flex; align-items: center;">
                              <div style="width: 20px; height: 20px; margin-right: 10px; background-color: #ddd; border-radius: 2px; flex-shrink: 0;"></div>
                              <div>
                                <div style="width: 90px; height: 16px; background-color: #ddd; border-radius: 2px; margin-bottom: 5px;"></div>
                                <div style="width: 110px; height: 13px; background-color: #eee; border-radius: 2px;"></div>
                              </div>
                            </div>
                            <div style="width: 16px; height: 16px; background-color: #ddd; border-radius: 2px; flex-shrink: 0;"></div>
                          </div>
                        </div>
                      </div>
                    </div>

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
                        <div style="text-align: center; flex: 1;">
                          <div style="color: var(--visited-link); font-size: 13px; margin-bottom: 6px;">Round Ends</div>
                          <div style="font-size: 22px; font-weight: bold; color: black;">${formatTime(timeRemaining)}</div>
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