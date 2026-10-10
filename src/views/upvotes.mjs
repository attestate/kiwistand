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
import RightColumn from "./components/right-column.mjs";
import { getSubmissions, getSubmissionCount, getContributionsData } from "../cache.mjs";
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

// NOTE: The data the profile page is rendered from. Also served as JSON via
// /upvotes?address=…&format=json, e.g. for the iOS app.
export async function data(identity, tab = "submissions") {
  // NOTE: Submissions and karma are stored under checksummed addresses and
  // matched exactly, so a lowercase address in the URL showed an empty
  // profile.
  identity = utils.getAddress(identity);
  const profile = await ens.resolve(identity);
  const points = karma.resolve(identity);
  const limit = 30;
  const offset = 0;
  const orderBy = tab === "top" ? "votes" : "new";
  const submissions = getSubmissions(identity, limit, offset, orderBy);
  const totalSubmissions = getSubmissionCount(identity);
  const rank =
    karma
      .ranking()
      .findIndex((k) => k.identity.toLowerCase() === identity.toLowerCase()) +
    1;
  return { profile, karma: points, rank, submissions, totalSubmissions };
}

export default async function (trie, theme, identity, tab = "submissions") {
  if (!utils.isAddress(identity)) {
    return html`Not a valid address`;
  }
  const {
    profile: ensData,
    karma: points,
    rank,
    submissions,
    totalSubmissions,
  } = await data(identity, tab);

  let ogImage = ensData.safeAvatar;

  const description = ensData.description
    ? ensData.description
    : ensData.farcaster
    ? ensData.farcaster.bio
    : "";
  const twitterCard = "summary";
  const path = "/upvotes";
  return "<!DOCTYPE html>" + html`
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
            color: var(--text-secondary);
          }
          .stat strong {
            color: var(--text-primary);
          }
          .tabs {
            margin: 15px 0;
            border-bottom: 1px solid var(--border-subtle);
          }
          .tab {
            display: inline-block;
            padding: 8px 16px;
            margin-right: 5px;
            color: var(--text-secondary);
            text-decoration: none;
            border-bottom: 2px solid transparent;
          }
          .tab:hover {
            color: var(--text-primary);
          }
          .tab.active {
            color: var(--text-primary);
            border-bottom-color: var(--text-primary);
          }
          .submission-row {
            margin: 10px 0;
            padding: 8px 0;
            border-bottom: 1px solid var(--border-subtle);
          }
          .submission-title {
            font-size: 14px;
            margin-bottom: 4px;
          }
          .submission-meta {
            font-size: 12px;
            color: var(--text-secondary);
          }
          .domain {
            color: var(--text-secondary);
            font-size: 12px;
          }
          .submission-title a {
            color: var(--text-primary);
          }
          .submission-meta a {
            color: var(--text-secondary);
          }
        </style>
      </head>
      <body ontouchstart="">
        <div class="container">
          ${Sidebar(path)}
          ${RightColumn()}
          <div id="hnmain" class="scaled-hnmain">
            <h1 class="visually-hidden">${ensData.displayName} on Kiwi News</h1>
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="var(--background-color0)">
              <tr>
                ${Header(theme)}
              </tr>
              <tr>
                <td>
                  <div
                    style="max-width: 900px; margin: 20px auto; padding: 0 20px; overflow-wrap: break-word; color: var(--text-primary); font-size: 16px; line-height: 1.5;"
                  >
                    <span
                      style="margin-bottom: 10px; font-weight: bold; display: flex; align-items: center; gap: 10px; color: var(--text-primary);"
                    >
                      ${ensData.safeAvatar &&
                      html` <a href="${ensData.safeAvatar}" target="_blank">
                        <img
                          src="${ensData.safeAvatar}"
                          loading="lazy"
                          style="border: 1px solid var(--text-secondary); width: 30px; height: 30px; border-radius: 2px;"
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
                      <span class="stat">Submissions: <strong>${totalSubmissions}</strong></span>
                    </div>
                    
                    <span style="font-size: 0.8rem; color: var(--text-secondary);">
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
