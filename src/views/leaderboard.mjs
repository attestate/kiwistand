import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import { custom } from "./components/head.mjs";

import { getContestLeaderboard, getVoterLeaderboard } from '../contest-leaderboard.mjs';
import DOMPurify from "isomorphic-dompurify";
import { getSlug } from "../utils.mjs";

const html = htm.bind(vhtml);

export default async function Leaderboard(identity, theme) {
  const contestData = await getContestLeaderboard(identity);
  const { leaderboard, userVoterInfo, contestDates } = contestData;
  
  // Get voter leaderboard data
  const voterData = await getVoterLeaderboard(identity);

  // Find the current user in the contest leaderboard
  let currentUserRank = null;
  if (identity) {
    const rankIndex = leaderboard.findIndex((user) => user.identity.toLowerCase() === identity.toLowerCase());
    if (rankIndex !== -1) {
      currentUserRank = {
        rank: rankIndex + 1,
        earnings: leaderboard[rankIndex].earnings
      };
    }
  }
  
  // Format contest dates
  const formatDate = (date) => {
    const options = { month: 'long', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };
  const dateRange = `${formatDate(contestDates.start)} - ${formatDate(contestDates.end)}`;

  const path = "/community";

  return html`
    <html lang="en" op="news">
      <head>
        ${custom("", "Contest Leaderboard", "", "", [])}
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
                <td>
                  <div style="padding: 15px; max-width: 800px; margin: 0 auto;">

                    <!-- Deletecasts Sponsor Banner -->
                    <div style="position: relative; margin-bottom: 20px;">
                      <a href="https://farcaster.xyz/miniapps/Y1Tanr9_yvlY/deletecasts" target="_blank" rel="noopener noreferrer" style="text-decoration: none;">
                        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; display: flex; align-items: center; justify-content: center; gap: 16px;">
                          <img src="/deletecasts-logo.webp" alt="Deletecasts" style="width: 40px; height: 40px;" />
                          <div style="text-align: left;">
                            <div style="color: #7c65c1; font-weight: bold; font-size: 20px; margin-bottom: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">deletecasts.com</div>
                            <div style="color: #666; font-size: 13px; font-weight: bold; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">Stop the hacker. Delete your past.</div>
                          </div>
                        </div>
                      </a>
                      <div style="text-align: right; margin-top: 4px; margin-right: 5px;">
                        <span style="color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Contest Sponsor</span>
                      </div>
                    </div>

                    <!-- Tab Navigation -->
                    <div style="background-color: var(--table-bg); border: var(--border); margin-bottom: 0; border-bottom: none;">
                      <div style="display: flex; border-bottom: var(--border-thin); position: relative;">
                        <button 
                          id="rewards-tab-btn"
                          onclick="(function() {
                            const rewardsBtn = document.getElementById('rewards-tab-btn');
                            const karmaBtn = document.getElementById('karma-tab-btn');
                            const rewardsIndicator = document.getElementById('rewards-indicator');
                            const karmaIndicator = document.getElementById('karma-indicator');
                            const rewardsContent = document.getElementById('rewards-tab-content');
                            const karmaContent = document.getElementById('karma-tab-content');
                            rewardsBtn.style.color = 'black';
                            rewardsBtn.style.fontWeight = '600';
                            karmaBtn.style.color = 'var(--visited-link)';
                            karmaBtn.style.fontWeight = '400';
                            rewardsIndicator.style.display = 'block';
                            karmaIndicator.style.display = 'none';
                            rewardsContent.style.display = 'block';
                            karmaContent.style.display = 'none';
                          })()"
                          style="flex: 1; padding: 15px 12px; background: transparent; color: black; border: none; font-size: 14px; font-weight: 600; cursor: pointer; position: relative; transition: color 0.2s;"
                        >
                          Rewards
                          <div id="rewards-indicator" style="position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: black; border-radius: 2px 2px 0 0;"></div>
                        </button>
                        <button 
                          id="karma-tab-btn"
                          onclick="(function() {
                            const rewardsBtn = document.getElementById('rewards-tab-btn');
                            const karmaBtn = document.getElementById('karma-tab-btn');
                            const rewardsIndicator = document.getElementById('rewards-indicator');
                            const karmaIndicator = document.getElementById('karma-indicator');
                            const rewardsContent = document.getElementById('rewards-tab-content');
                            const karmaContent = document.getElementById('karma-tab-content');
                            karmaBtn.style.color = 'black';
                            karmaBtn.style.fontWeight = '600';
                            rewardsBtn.style.color = 'var(--visited-link)';
                            rewardsBtn.style.fontWeight = '400';
                            karmaIndicator.style.display = 'block';
                            rewardsIndicator.style.display = 'none';
                            karmaContent.style.display = 'block';
                            rewardsContent.style.display = 'none';
                          })()"
                          style="flex: 1; padding: 15px 12px; background: transparent; color: var(--visited-link); border: none; font-size: 14px; font-weight: 400; cursor: pointer; position: relative; transition: color 0.2s;"
                        >
                          Voting Power
                          <div id="karma-indicator" style="position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: black; border-radius: 2px 2px 0 0; display: none;"></div>
                        </button>
                      </div>
                    </div>

                    <!-- Rewards Winners Tab Content -->
                    <div id="rewards-tab-content" style="display: block;">
                      <div style="background-color: var(--table-bg); border: var(--border); border-top: none; margin-bottom: 20px;">
                        <div style="padding: 15px; border-bottom: var(--border-thin);">
                          <div style="text-align: center; color: var(--visited-link); font-size: 13px;">${dateRange}</div>
                        </div>
                        <div>
                        ${leaderboard.map((user, index) => {
                          const medals = ['🥇', '🥈', '🥉'];
                          const displayRank = index < 3 ? medals[index] : `${index + 1}.`;
                          const avatar = user.ensData?.avatar_small || user.ensData?.avatar || user.ensData?.farcaster?.avatar;
                          
                          const avatarHtml = avatar 
                            ? html`<img src="${avatar}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 12px; flex-shrink: 0;" />`
                            : html`<div style="width: 24px; height: 24px; margin-right: 12px; flex-shrink: 0; display: inline-block;">
                                    <zora-zorb
                                      style="display: block;"
                                      size="24px"
                                      address="${user.identity}"
                                    ></zora-zorb>
                                  </div>`;

                          const hasStories = user.topStories && user.topStories.length > 0;
                          return html`
                            <div class="leaderboard-entry" style="border-bottom: ${index < leaderboard.length - 1 ? 'var(--border-thin)' : 'none'};">
                              <div class="leaderboard-user-row ${hasStories ? 'expandable-row' : ''}" data-user-id="user-${index}" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background-color: ${hasStories ? 'var(--bg-color)' : 'transparent'}; ${hasStories ? 'cursor: pointer;' : ''}">
                                <div style="display: flex; align-items: center; min-width: 0; flex: 1;">
                                  ${hasStories ? html`
                                    <button 
                                      class="expand-button"
                                      data-user-id="user-${index}"
                                      style="background: none; border: none; cursor: pointer; padding: 4px; margin-right: 8px; color: var(--visited-link); display: flex; align-items: center;"
                                    >
                                      <svg id="expand-user-${index}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" style="width: 16px; height: 16px;">
                                        <rect width="256" height="256" fill="none"/>
                                        <polyline points="96 48 176 128 96 208" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                                      </svg>
                                    </button>
                                  ` : html`<div style="width: 24px; margin-right: 8px;"></div>`}
                                  <div style="width: 30px; text-align: center; margin-right: 12px; color: var(--visited-link); font-size: ${index < 3 ? '16px' : '14px'}; font-weight: bold;">${displayRank}</div>
                                  <div style="display: flex; align-items: center; min-width: 0; flex: 1;">
                                    ${avatarHtml}
                                    <a
                                      href="/upvotes?address=${user.identity}"
                                      style="color: black; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; text-decoration: none;"
                                      class="leaderboard-user-link"
                                      onclick="event.stopPropagation();"
                                    >
                                      ${user.displayName}
                                    </a>
                                  </div>
                                </div>
                                <div style="display: flex; align-items: center;">
                                  <div style="width: 100px; text-align: right;">
                                    <div style="color: var(--visited-link); font-size: 11px; margin-bottom: 2px;">Earnings</div>
                                    <div style="color: black; font-weight: bold; font-size: 14px; display: flex; align-items: center; justify-content: flex-end;">
                                      ${(typeof user.earnings === 'number' && !isNaN(user.earnings) ? user.earnings : 0).toFixed(2)}
                                      <img src="/usdc-logo.svg" style="width: 16px; height: 16px; margin-left: 4px;" alt="USDC" />
                                    </div>
                                  </div>
                                </div>
                              </div>
                              ${hasStories ? html`
                                <div id="stories-user-${index}" style="display: none; background-color: var(--bg-color);">
                                  <div style="padding: 0;">
                                    <div style="padding: 8px 15px 8px 48px; background-color: rgba(0, 0, 0, 0.03); font-size: 11px; color: var(--visited-link); font-weight: 600; text-transform: uppercase;">Stories Submitted</div>
                                    ${user.topStories.map((story, storyIndex) => {
                                      // Extract domain from href
                                      const extractDomain = (url) => {
                                        try {
                                          const parsedUrl = new URL(url);
                                          const parts = parsedUrl.hostname.split(".");
                                          return parts.slice(-2).join(".");
                                        } catch {
                                          return "";
                                        }
                                      };
                                      const domain = extractDomain(story.href);
                                      
                                      return html`
                                      <div class="story-item" style="border-top: var(--border-thin); background-color: white;">
                                        <table style="width: 100%; border-collapse: collapse;">
                                          <tr class="${story.upvotersData && story.upvotersData.length > 0 ? 'expandable-story-row' : ''}" data-story-id="story-${index}-${storyIndex}" style="${story.upvotersData && story.upvotersData.length > 0 ? 'cursor: pointer;' : ''}">
                                            <td style="padding: 10px 15px 10px 48px; vertical-align: top; position: relative;">
                                              ${story.upvotersData && story.upvotersData.length > 0 ? html`
                                                <button 
                                                  class="story-expand-button"
                                                  data-story-id="story-${index}-${storyIndex}"
                                                  style="position: absolute; left: 24px; top: 10px; background: none; border: none; cursor: pointer; padding: 4px; color: var(--visited-link); display: flex; align-items: center;"
                                                >
                                                  <svg id="expand-story-${index}-${storyIndex}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" style="width: 14px; height: 14px;">
                                                    <rect width="256" height="256" fill="none"/>
                                                    <polyline points="96 48 176 128 96 208" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                                                  </svg>
                                                </button>
                                              ` : ''}
                                              <div style="display: flex; flex-direction: column; gap: 4px;">
                                                <div>
                                                  <a href="/stories/${getSlug(story.title)}?index=${story.index}" style="color: black; text-decoration: none; font-size: 13px; line-height: 1.3;" onclick="event.stopPropagation();">
                                                    ${story.title || 'Untitled'}
                                                  </a>
                                                  ${domain ? html` <span style="color: var(--visited-link); font-size: 11px; margin-left: 6px;">(${domain})</span>` : ''}
                                                </div>
                                                <div style="font-size: 11px; color: var(--visited-link);">
                                                  <div style="display: inline-flex; align-items: center;">
                                                    ${story.upvoters ? story.upvoters.length : 0} upvoters
                                                    ${story.upvotersData && story.upvotersData.length > 0 ? html`
                                                      <span style="margin-left: 4px;">•</span>
                                                      <span style="margin-left: 4px; display: inline-flex; align-items: center;">
                                                        ${story.upvotersData.slice(0, 3).map(upvoter => {
                                                          const upvoterAvatar = upvoter.ensData?.avatar_small || upvoter.ensData?.avatar || upvoter.ensData?.farcaster?.avatar;
                                                          return upvoterAvatar 
                                                            ? html`<img src="${upvoterAvatar}" style="width: 14px; height: 14px; border-radius: 50%; margin-left: -2px; border: 1px solid white;" title="${upvoter.ensData?.displayName || upvoter.identity}" />`
                                                            : html`<div style="width: 14px; height: 14px; margin-left: -2px; display: inline-block;">
                                                                <zora-zorb size="14px" address="${upvoter.identity}"></zora-zorb>
                                                              </div>`;
                                                        })}
                                                        ${story.upvoters && story.upvoters.length > 3 ? html`
                                                          <span style="font-size: 10px; margin-left: 2px;">+${story.upvoters.length - 3}</span>
                                                        ` : ''}
                                                      </span>
                                                    ` : ''}
                                                  </div>
                                                </div>
                                              </div>
                                            </td>
                                            <td style="width: 120px; text-align: right; padding: 10px 15px; vertical-align: middle;">
                                              <div style="font-size: 13px; font-weight: 600; color: black; display: flex; align-items: center; justify-content: flex-end; white-space: nowrap;">
                                                +${(typeof story.earnings === 'number' && !isNaN(story.earnings) ? story.earnings : 0).toFixed(2)}
                                                <img src="/usdc-logo.svg" style="width: 14px; height: 14px; margin-left: 3px;" alt="USDC" />
                                              </div>
                                            </td>
                                          </tr>
                                        </table>
                                      </div>
                                      <div id="contributors-story-${index}-${storyIndex}" style="display: none; background-color: #f8f8f8; border-left: 3px solid #e0e0e0; margin-left: 45px;">
                                        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                                          <tr style="background-color: #f0f0f0;">
                                            <td colspan="2" style="padding: 8px 15px 8px 15px; color: var(--visited-link); font-weight: 600; text-transform: uppercase; font-size: 10px;">Upvoters</td>
                                          </tr>
                                          ${story.upvotersData && story.upvotersData.map((upvoter, upvoterIndex) => html`
                                            <tr style="background-color: #fafafa;">
                                              <td style="padding: 4px 15px 4px 15px;">
                                                <div style="display: flex; align-items: center;">
                                                  ${upvoter.ensData?.avatar_small || upvoter.ensData?.avatar || upvoter.ensData?.farcaster?.avatar
                                                    ? html`<img src="${upvoter.ensData.avatar_small || upvoter.ensData.avatar || upvoter.ensData.farcaster.avatar}" style="width: 12px; height: 12px; border-radius: 50%; margin-right: 6px;" />`
                                                    : html`<div style="width: 12px; height: 12px; margin-right: 6px; display: inline-block;">
                                                        <zora-zorb size="12px" address="${upvoter.identity}"></zora-zorb>
                                                      </div>`}
                                                  <span style="color: #666;">${upvoter.ensData?.displayName || upvoter.identity.slice(0, 6) + '...'}</span>
                                                </div>
                                              </td>
                                              <td style="width: 120px; text-align: right; padding: 4px 15px;">
                                                <div style="display: flex; align-items: center; justify-content: flex-end; color: #666;">
                                                  <span>+${(typeof upvoter.contribution === 'number' && !isNaN(upvoter.contribution) ? upvoter.contribution : 0).toFixed(2)}</span>
                                                  <img src="/usdc-logo.svg" style="width: 10px; height: 10px; margin-left: 2px;" alt="USDC" />
                                                </div>
                                              </td>
                                            </tr>
                                          `)}
                                          ${story.upvotersData && story.upvotersData.length > 0 ? html`
                                            <tr style="background-color: rgba(0, 0, 0, 0.08); border-top: 1px solid rgba(0, 0, 0, 0.1);">
                                              <td style="padding: 8px 15px 8px 15px; font-weight: 700; color: black; font-size: 12px;">Story Total</td>
                                              <td style="width: 120px; text-align: right; padding: 8px 15px;">
                                                <div style="display: flex; align-items: center; justify-content: flex-end; font-weight: 700; color: black; font-size: 12px;">
                                                  <span>${(typeof story.earnings === 'number' && !isNaN(story.earnings) ? story.earnings : 0).toFixed(2)}</span>
                                                  <img src="/usdc-logo.svg" style="width: 12px; height: 12px; margin-left: 2px;" alt="USDC" />
                                                </div>
                                              </td>
                                            </tr>
                                          ` : ''}
                                          ${story.upvoters && story.upvoters.length > 5 ? html`
                                            <tr style="background-color: #fafafa;">
                                              <td colspan="2" style="padding: 4px 15px 4px 15px; color: #999; text-align: center; font-style: italic;">
                                                ... and ${story.upvoters.length - 5} more contributors
                                              </td>
                                            </tr>
                                          ` : ''}
                                        </table>
                                      </div>
                                    `;
                                    })}
                                    ${user.remainingStoriesCount > 0 ? html`
                                      <div style="border-top: var(--border-thin); padding: 10px 15px 10px 48px; background-color: white;">
                                        <table style="width: 100%; border-collapse: collapse;">
                                          <tr>
                                            <td style="font-size: 12px; color: var(--visited-link); font-style: italic;">
                                              ... and ${user.remainingStoriesCount} more ${user.remainingStoriesCount === 1 ? 'story' : 'stories'} awarded
                                            </td>
                                            <td style="width: 120px; text-align: right;">
                                              <div style="font-size: 13px; font-weight: 600; color: black; display: flex; align-items: center; justify-content: flex-end;">
                                                +${(typeof user.remainingStoriesEarnings === 'number' && !isNaN(user.remainingStoriesEarnings) ? user.remainingStoriesEarnings : 0).toFixed(2)}
                                                <img src="/usdc-logo.svg" style="width: 14px; height: 14px; margin-left: 3px;" alt="USDC" />
                                              </div>
                                            </td>
                                          </tr>
                                        </table>
                                      </div>
                                    ` : ''}
                                    ${user.topStories.length > 0 || user.remainingStoriesCount > 0 ? html`
                                      <table style="width: 100%; border-collapse: collapse; border-top: var(--border-thin); background-color: rgba(0, 0, 0, 0.03);">
                                        <tr>
                                          <td style="padding: 10px 15px 10px 48px; font-size: 12px; font-weight: 600; color: var(--visited-link);">SUBTOTAL</td>
                                          <td style="width: 120px; text-align: right; padding: 10px 15px;">
                                            <div style="font-size: 13px; font-weight: bold; color: black; display: flex; align-items: center; justify-content: flex-end;">
                                              ${(typeof user.earnings === 'number' && !isNaN(user.earnings) ? user.earnings : 0).toFixed(2)}
                                              <img src="/usdc-logo.svg" style="width: 14px; height: 14px; margin-left: 3px;" alt="USDC" />
                                            </div>
                                          </td>
                                        </tr>
                                      </table>
                                    ` : ''}
                                  </div>
                                </div>
                              ` : ''}
                            </div>
                          `;
                        })}
                      </div>
                        <div style="padding: 12px 15px; background-color: black; color: white; display: flex; justify-content: space-between; align-items: center;">
                          <span style="font-size: 14px; font-weight: bold;">TOTAL PRIZE POOL</span>
                          <div style="font-size: 16px; font-weight: bold; display: flex; align-items: center;">
                            ${(() => { const total = leaderboard.reduce((sum, user) => sum + (typeof user.earnings === 'number' && !isNaN(user.earnings) ? user.earnings : 0), 0); return (typeof total === 'number' && !isNaN(total) ? total : 0).toFixed(2); })()}
                            <img src="/usdc-logo.svg" style="width: 18px; height: 18px; margin-left: 4px;" alt="USDC" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Voter Leaderboard Tab Content -->
                    <div id="karma-tab-content" style="display: none;">
                      <div style="background-color: var(--table-bg); border: var(--border); border-top: none; margin-bottom: 20px;">
                        <div style="padding: 20px 15px; border-bottom: var(--border-thin); text-align: center;">
                          <div style="color: black; font-size: 14px; font-weight: 600; margin-bottom: 8px;">
                            🏆 How The Voting Power Works
                          </div>
                          <div style="color: var(--visited-link); font-size: 12px; line-height: 1.6; max-width: 400px; margin: 0 auto;">
                            This is a leaderboard of the top voters, ranked by the total USDC their votes contributed to submitters.
                          </div>
                        </div>
                        <div>
                          ${voterData.leaderboard.map((user, index) => {
                            const medals = ['🥇', '🥈', '🥉'];
                            const displayRank = index < 3 ? medals[index] : `${index + 1}.`;
                            const avatar = user.ensData?.avatar_small || user.ensData?.avatar || user.ensData?.farcaster?.avatar;
                            
                            const avatarHtml = avatar 
                              ? html`<img src="${avatar}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 12px; flex-shrink: 0;" />`
                              : html`<div style="width: 24px; height: 24px; margin-right: 12px; flex-shrink: 0; display: inline-block;">
                                      <zora-zorb
                                        style="display: block;"
                                        size="24px"
                                        address="${user.identity}"
                                      ></zora-zorb>
                                    </div>`;

                            return html`
                              <div class="karma-leaderboard-entry" style="border-bottom: ${index < voterData.leaderboard.length - 1 ? 'var(--border-thin)' : 'none'}">
                                <div 
                                  style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; gap: 15px; cursor: pointer;"
                                  onclick="(function() {
                                    var votesDiv = document.getElementById('karma-votes-${index}');
                                    var chevron = document.getElementById('karma-chevron-${index}');
                                    if (votesDiv.style.display === 'none' || votesDiv.style.display === '') {
                                      votesDiv.style.display = 'block';
                                      chevron.style.transform = 'rotate(90deg)';
                                    } else {
                                      votesDiv.style.display = 'none';
                                      chevron.style.transform = 'rotate(0deg)';
                                    }
                                  })()"
                                >
                                  <div style="display: flex; align-items: center; min-width: 0; flex: 1;">
                                    <button 
                                      class="expand-button"
                                      style="background: none; border: none; cursor: pointer; padding: 4px; margin-right: 8px; color: var(--visited-link); display: flex; align-items: center;"
                                    >
                                      <svg id="karma-chevron-${index}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" style="width: 16px; height: 16px; transition: transform 0.2s; color: currentColor;">
                                        <rect width="256" height="256" fill="none"/>
                                        <polyline points="96 48 176 128 96 208" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                                      </svg>
                                    </button>
                                    <div style="width: 30px; text-align: center; margin-right: 12px; color: var(--visited-link); font-size: ${index < 3 ? '16px' : '14px'}; font-weight: bold; flex-shrink: 0;">${displayRank}</div>
                                    <div style="display: flex; align-items: center; min-width: 0; flex: 1;">
                                      ${avatarHtml}
                                      <a
                                        href="/upvotes?address=${user.identity}"
                                        style="color: black; font-size: 14px; text-decoration: none; white-space: nowrap;"
                                      >
                                        ${user.displayName}
                                      </a>
                                    </div>
                                  </div>
                                  <div style="text-align: right; flex-shrink: 0;">
                                    <div style="color: var(--visited-link); font-size: 10px; margin-bottom: 2px;">
                                      Karma: ${user.karma.toLocaleString()}
                                    </div>
                                    <div style="color: black; font-weight: bold; font-size: 14px; display: flex; align-items: center; justify-content: flex-end;">
                                      ${(typeof user.votingPower === 'number' && !isNaN(user.votingPower) ? user.votingPower : 0).toFixed(2)}
                                      <img src="/usdc-logo.svg" style="width: 16px; height: 16px; margin-left: 4px;" alt="USDC" />
                                    </div>
                                    ${user.actualContributed > 0 ? html`
                                      <div style="color: green; font-size: 10px; margin-top: 2px;">
                                        Used: ${user.actualContributed.toFixed(2)}
                                      </div>
                                    ` : ''}
                                  </div>
                                </div>
                                <!-- Expandable votes section -->
                                <div id="karma-votes-${index}" style="display: none; background-color: rgba(0, 0, 0, 0.02); border-top: var(--border-thin);">
                                  <div style="padding: 15px;">
                                    <div style="font-size: 12px; color: var(--visited-link); margin-bottom: 10px; font-weight: 600;">USDC ALLOCATION</div>
                                    ${user.votes && user.votes.length > 0 ? html`
                                      <div style="display: flex; flex-direction: column; gap: 8px;">
                                        ${user.votes.map(vote => html`
                                          <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background-color: white; border: var(--border-thin); border-radius: 4px;">
                                            <div style="flex: 1; min-width: 0;">
                                              <div>
                                                <a href="${vote.href}" target="_blank" rel="noopener noreferrer" style="color: black; text-decoration: none; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; max-width: 100%;">
                                                  ${vote.title}
                                                </a>
                                              </div>
                                              <div style="font-size: 11px; color: var(--visited-link); margin-top: 2px;">
                                                by ${vote.author}
                                              </div>
                                            </div>
                                            <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0; margin-left: 10px;">
                                              <span style="font-weight: bold; font-size: 13px;">+${vote.amount.toFixed(2)}</span>
                                              <img src="/usdc-logo.svg" style="width: 14px; height: 14px;" alt="USDC" />
                                            </div>
                                          </div>
                                        `)}
                                      </div>
                                    ` : html`
                                      <div style="padding: 20px; text-align: center;">
                                        <div style="color: var(--visited-link); font-size: 12px;">
                                          This user did not cast any votes that resulted in rewards.
                                        </div>
                                      </div>
                                    `}
                                  </div>
                                </div>
                              </div>
                            `;
                          })}
                          
                          ${
                          voterData.currentUserData && !voterData.currentUserData.isOnLeaderboard ? html`
                            <div style="border-top: 2px solid var(--border-color); background-color: rgba(255, 255, 0, 0.05);">
                              <div style="padding: 8px 15px; font-size: 12px; color: var(--visited-link); text-align: center; font-style: italic;">
                                Your Position
                              </div>
                              <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; gap: 15px;">
                                <div style="display: flex; align-items: center; min-width: 0; flex: 1; max-width: 50%;">
                                  <div style="width: 30px; text-align: center; margin-right: 12px; color: var(--visited-link); font-size: 14px; font-weight: bold; flex-shrink: 0;">
                                    ${voterData.currentUserData.rank !== 'N/A' ? `#${voterData.currentUserData.rank}` : 'Unranked'}
                                  </div>
                                  <div style="display: flex; align-items: center; min-width: 0; flex: 1;">
                                    ${voterData.currentUserData.ensData?.avatar_small || voterData.currentUserData.ensData?.avatar || voterData.currentUserData.ensData?.farcaster?.avatar
                                      ? html`<img src="${voterData.currentUserData.ensData.avatar_small || voterData.currentUserData.ensData.avatar || voterData.currentUserData.ensData.farcaster.avatar}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 12px; flex-shrink: 0;" />`
                                      : html`<div style="width: 24px; height: 24px; margin-right: 12px; flex-shrink: 0; display: inline-block;">
                                          <zora-zorb size="24px" address="${voterData.currentUserData.identity}"></zora-zorb>
                                        </div>`}
                                    <span style="color: black; font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                      ${voterData.currentUserData.displayName} (You)
                                    </span>
                                  </div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                                  <div style="text-align: right; min-width: 50px;">
                                    <div style="color: var(--visited-link); font-size: 10px; margin-bottom: 2px;">All-Time Karma</div>
                                    <div style="color: var(--visited-link); font-weight: normal; font-size: 13px;">${voterData.currentUserData.karma.toLocaleString()}</div>
                                  </div>
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" style="width: 16px; height: 16px; color: var(--visited-link); flex-shrink: 0;">
                                    <rect width="256" height="256" fill="none"/>
                                    <line x1="40" y1="128" x2="216" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                                    <polyline points="144 56 216 128 144 200" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                                  </svg>
                                  <div style="width: 100px; text-align: right;">
                                    <div style="color: var(--visited-link); font-size: 11px; margin-bottom: 2px;">Total Contributed</div>
                                    <div style="color: black; font-weight: bold; font-size: 14px; display: flex; align-items: center; justify-content: flex-end;">
                                      0.00
                                      <img src="/usdc-logo.svg" style="width: 16px; height: 16px; margin-left: 4px;" alt="USDC" />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ` : ''}
                        </div>
                        <div style="padding: 12px 15px; background-color: black; color: white; display: flex; justify-content: space-between; align-items: center;">
                          <span style="font-size: 14px; font-weight: bold;">TOTAL VOTING POWER</span>
                          <div style="font-size: 16px; font-weight: bold; display: flex; align-items: center;">
                            ${(() => { const total = voterData.leaderboard.reduce((sum, user) => sum + (typeof user.votingPower === 'number' && !isNaN(user.votingPower) ? user.votingPower : 0), 0); return (typeof total === 'number' && !isNaN(total) ? total : 0).toFixed(2); })()}
                            <img src="/usdc-logo.svg" style="width: 18px; height: 18px; margin-left: 4px;" alt="USDC" />
                          </div>
                        </div>
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