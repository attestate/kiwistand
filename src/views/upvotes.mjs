//@format
import url from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import { formatDistanceToNow } from "date-fns";
import { utils } from "ethers";
import DOMPurify from "isomorphic-dompurify";

import Header from "./components/header.mjs";
import { trophySVG, broadcastSVG } from "./components/secondheader.mjs";
import Footer from "./components/footer.mjs";
import Sidebar from "./components/sidebar.mjs";
import { custom } from "./components/head.mjs";
import * as store from "../store.mjs";
import * as ens from "../ens.mjs";
import * as moderation from "./moderation.mjs";
import * as karma from "../karma.mjs";
import * as preview from "../preview.mjs";
import Row from "./components/row.mjs";
import { getSubmissions, getContributionsData } from "../cache.mjs";
import { metadata } from "../parser.mjs";
import { truncate } from "../utils.mjs";
import {
  SocialButton,
  twitterSvg,
  githubSvg,
  warpcastSvg,
  heySvg,
  telegramSvg,
  discordSvg,
  websiteSvg,
} from "./components/socialNetworkIcons.mjs";

const html = htm.bind(vhtml);

export default async function (trie, theme, identity, tab = "submissions") {
  if (!utils.isAddress(identity)) {
    return html`Not a valid address`;
  }
  const ensData = await ens.resolve(identity);

  let ogImage = ensData.safeAvatar;

  const description = ensData.description
    ? ensData.description
    : ensData.farcaster
    ? ensData.farcaster.bio
    : "";
  const twitterCard = "summary";
  const points = karma.resolve(identity);
  const path = "/upvotes";
  
  // Fetch user's submissions 
  const limit = 30;
  const offset = 0;
  const orderBy = tab === "top" ? "votes" : "new";
  const submissions = getSubmissions(identity, limit, offset, orderBy);
  
  // Get karma rank
  const allKarma = karma.ranking();
  const rank = allKarma.findIndex(k => k.identity.toLowerCase() === identity.toLowerCase()) + 1;
  return html`
    <html lang="en" op="news">
      <head>
        ${custom(
          ogImage,
          `${ensData.displayName} (${points.toString()} 🥝) on Kiwi News`,
          description,
          twitterCard,
          [], // prefetch
          `https://news.kiwistand.com/upvotes?address=${identity}`, // canonical URL
        )}
        <style>
          .profile-stats {
            display: flex;
            gap: 20px;
            margin: 10px 0;
            font-size: 14px;
          }
          .stat {
            color: #828282;
          }
          .stat strong {
            color: black;
          }
          .tabs {
            margin: 15px 0;
            border-bottom: 1px solid #ccc;
          }
          .tab {
            display: inline-block;
            padding: 8px 16px;
            margin-right: 5px;
            color: #828282;
            text-decoration: none;
            border-bottom: 2px solid transparent;
          }
          .tab.active {
            color: black;
            border-bottom-color: black;
          }
          .submission-row {
            margin: 10px 0;
            padding: 8px 0;
            border-bottom: 1px solid #f0f0f0;
          }
          .submission-title {
            font-size: 14px;
            margin-bottom: 4px;
          }
          .submission-meta {
            font-size: 12px;
            color: #828282;
          }
          .domain {
            color: #828282;
            font-size: 12px;
          }
        </style>
      </head>
      <body ontouchstart="">
        <div class="container">
          ${Sidebar(path)}
          <div id="hnmain" class="scaled-hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${Header(theme)}
              </tr>
              <tr>
                <td>
                  <div
                    style="max-width: 900px; margin: 20px auto; padding: 0 20px; overflow-wrap: break-word; color: black; font-size: 16px; line-height: 1.5;"
                  >
                    <span
                      style="margin-bottom: 10px; font-weight: bold; display: flex; align-items: center; gap: 10px;"
                    >
                      ${ensData.safeAvatar &&
                      html` <a href="${ensData.safeAvatar}" target="_blank">
                        <img
                          src="${ensData.safeAvatar}"
                          style="border: 1px solid #828282; width: 30px; height: 30px; border-radius: 2px;"
                      /></a>`}
                      <a
                        target="_blank"
                        href="https://etherscan.io/address/${ensData.address}"
                      >
                        ${ensData.displayName}
                        <span>
                          (<nav-karma
                            data-address="${identity}"
                            data-initial="${points.toString()}"
                            >${points.toString()}</nav-karma
                          >
                          🥝)</span
                        >
                      </a>
                    </span>
                    
                    <!-- Stats bar like Reddit/HN -->
                    <div class="profile-stats">
                      <span class="stat">Rank: <strong>#${rank}</strong></span>
                      <span class="stat">Karma: <strong>${points}</strong></span>
                      <span class="stat">Submissions: <strong>${submissions.length}</strong></span>
                    </div>
                    
                    <span style="font-size: 0.8rem;">
                      ${description
                        ? html`${DOMPurify.sanitize(description)}<br />`
                        : html`<span><br /></span>`}
                    </span>
                    <div
                      style="flex-wrap: wrap; display: flex; gap: 7px; margin-top: 10px;"
                    >
                      ${ensData.url && ensData.url.startsWith("https://")
                        ? SocialButton(ensData.url, websiteSvg(), "Website")
                        : ""}
                      ${ensData.twitter
                        ? SocialButton(
                            `https://twitter.com/${ensData.twitter}`,
                            twitterSvg(),
                            "X",
                          )
                        : ""}
                      ${ensData.github
                        ? SocialButton(
                            `https://github.com/${ensData.github}`,
                            githubSvg(),
                            "GitHub",
                          )
                        : ""}
                      ${ensData.telegram
                        ? SocialButton(
                            `https://t.me/${ensData.telegram}`,
                            telegramSvg(),
                            "Telegram",
                          )
                        : ""}
                      ${ensData.discord
                        ? SocialButton(
                            `https://discordapp.com/users/${ensData.discord}`,
                            discordSvg(),
                            "Discord",
                          )
                        : ""}
                      ${ensData.farcaster && ensData.farcaster.username
                        ? SocialButton(
                            `https://farcaster.xyz/${ensData.farcaster.username}`,
                            warpcastSvg(),
                            "Farcaster",
                          )
                        : ""}
                      ${ensData.lens && ensData.lens.id
                        ? SocialButton(
                            `https://hey.xyz/profile/${ensData.lens.id}`,
                            heySvg(),
                            "Lens",
                          )
                        : ""}
                      ${SocialButton(
                        `https://app.interface.social/profile/${identity}`,
                        "/interface_logo.png",
                        "Interface",
                        true,
                      )}
                    </div>
                    
                    <!-- Tabs like Reddit/HN -->
                    <div class="tabs">
                      <a href="?address=${identity}&tab=submissions" class="tab ${tab === 'submissions' ? 'active' : ''}">Submissions</a>
                      <a href="?address=${identity}&tab=top" class="tab ${tab === 'top' ? 'active' : ''}">Top</a>
                    </div>
                    
                    <!-- Content based on tab -->
                    <div class="profile-content">
                      <div class="submissions-list">
                        ${submissions.map((story, i) => html`
                          <div class="submission-row">
                            <div class="submission-title">
                              ${i + 1}. <a href="${story.href}" target="_blank">${story.title}</a> <span class="domain">(${new URL(story.href).hostname})</span>
                            </div>
                            <div class="submission-meta">
                              ${story.upvotes} points | <a href="/stories/${story.title}?index=0x${story.index}">comments</a> | ${formatDistanceToNow(new Date(story.timestamp * 1000))} ago
                            </div>
                          </div>
                        `)}
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </table>
            ${Footer(theme)}
          </div>
        </div>
      </body>
    </html>
  `;
}
