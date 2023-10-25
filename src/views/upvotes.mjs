//@format
import url from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import { formatDistanceToNow } from "date-fns";
import { utils } from "ethers";

import Header from "./components/header.mjs";
import { trophySVG, broadcastSVG } from "./components/secondheader.mjs";
import Footer from "./components/footer.mjs";
import Sidebar from "./components/sidebar.mjs";
import Head from "./components/head.mjs";
import * as store from "../store.mjs";
import { EIP712_MESSAGE } from "../constants.mjs";
import { count } from "./feed.mjs";
import * as ens from "../ens.mjs";
import * as moderation from "./moderation.mjs";
import * as karma from "../karma.mjs";
import * as registry from "../chainstate/registry.mjs";
import Row from "./components/row.mjs";

const html = htm.bind(vhtml);

function extractDomain(link) {
  const parsedUrl = new url.URL(link);
  return parsedUrl.hostname;
}

export const classify = (messages) => {
  const firstAmplify = {};

  return messages
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((message) => {
      const href = normalizeUrl(!!message.href && message.href);

      if (message.type === "amplify" && !firstAmplify[href]) {
        firstAmplify[href] = true;
        return { verb: "submit", message };
      } else {
        return { verb: "upvote", message };
      }
    })
    .sort((a, b) => b.message.timestamp - a.message.timestamp);
};

export default async function (
  trie,
  theme,
  identity,
  page,
  mode,
  activeIdentity,
) {
  if (!utils.isAddress(identity)) {
    return html`Not a valid address`;
  }
  const ensData = await ens.resolve(identity);
  const from = null;
  const amount = null;
  const parser = JSON.parse;
  const startDatetime = null;
  const allowlist = await registry.allowlist();
  const delegations = await registry.delegations();
  let leaves = await store.posts(
    trie,
    from,
    amount,
    parser,
    startDatetime,
    allowlist,
    delegations,
  );
  const cacheEnabled = true;
  const totalStories = 10;
  const start = totalStories * page;
  const end = totalStories * (page + 1);
  let storyPromises = await count(leaves);

  if (mode === "top") {
    storyPromises = storyPromises.sort((a, b) => b.upvotes - a.upvotes);
  } else if (mode === "new") {
    storyPromises = storyPromises.sort((a, b) => b.timestamp - a.timestamp);
  }

  const writers = await moderation.getWriters();

  let stories = storyPromises
    .filter(
      (story) =>
        utils.getAddress(story.identity) === utils.getAddress(identity),
    )
    .slice(start, end);
  stories = await Promise.all(
    stories.map(async (leaf) => {
      const ensData = await ens.resolve(leaf.identity);
      let avatars = [];
      for await (let upvoter of leaf.upvoters) {
        const profile = await ens.resolve(upvoter);
        if (profile.safeAvatar) {
          avatars.push(profile.safeAvatar);
        }
      }
      const isOriginal = Object.keys(writers).some(
        (domain) =>
          leaf.href.startsWith(domain) && writers[domain] === leaf.identity,
      );
      return {
        ...leaf,
        displayName: ensData.displayName,
        avatars: avatars,
        isOriginal,
      };
    }),
  );

  const points = karma.resolve(identity);
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
      </head>
      <body>
        <div class="container">
          ${Sidebar()}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme, activeIdentity)}
              </tr>
              <tr>
                <td>
                  <div
                    style="padding: 10px 10px 0 10px; color: black; font-size: 16px; line-height: 1.5;"
                  >
                    <a
                      style="font-weight: bold;"
                      target="_blank"
                      href="https://etherscan.io/address/${ensData.address}"
                    >
                      ${ensData.displayName}
                      <span> (${points.toString()} 🥝)</span>
                    </a>
                    <span style="font-size: 0.8rem;">
                      ${ensData.description
                        ? html`<br />${ensData.description}<br />`
                        : ensData.farcaster && ensData.farcaster.bio
                        ? html`<br />${ensData.farcaster.bio}<br />`
                        : html`<span><br /></span>`}
                    </span>
                    <div style="display: flex; gap: 15px; margin-top: 10px;">
                      ${ensData.url
                        ? html` <a target="_blank" href="${ensData.url}"
                            >${website}</a
                          >`
                        : ""}
                      ${ensData.twitter
                        ? html` <a
                            href="https://twitter.com/${ensData.twitter}"
                            target="_blank"
                            rel="noopener noreferrer"
                            >${twitter}</a
                          >`
                        : ""}
                      ${ensData.github
                        ? html` <a
                            href="https://github.com/${ensData.github}"
                            target="_blank"
                            rel="noopener noreferrer"
                            >${github}</a
                          >`
                        : ""}
                      ${ensData.telegram
                        ? html` <a
                            href="https://t.me/${ensData.telegram}"
                            target="_blank"
                            rel="noopener noreferrer"
                            >${telegram}</a
                          >`
                        : ""}
                      ${ensData.discord
                        ? html` <a
                            href="https://discordapp.com/users/${ensData.discord}"
                            target="_blank"
                            rel="noopener noreferrer"
                            >${discord}</a
                          >`
                        : ""}
                      ${ensData.farcaster && ensData.farcaster.username
                        ? html` <a
                            href="https://warpcast.com/${ensData.farcaster
                              .username}"
                            target="_blank"
                            rel="noopener noreferrer"
                            >${warpcast}</a
                          >`
                        : ""}
                    </div>
                    <hr />
                    ${stories.length > 0
                      ? html`<b>
                          <span>SUBMISSIONS </span>
                          ${page !== 0 ? html`(page: ${page})` : ""}
                        </b>`
                      : ""}
                  </div>
                </td>
              </tr>
              <tr>
                <td>
                  <div
                    style="min-height: 40px; display: flex; align-items: center; padding: 10px 15px 10px 15px; color: white;"
                  >
                    <a href="?mode=top&address=${ensData.address}&page=0">
                      <button
                        style=${`margin-right: 10px; font-size: 1.01rem; border-radius: 2px; cursor: pointer; padding: 5px 15px; background-color: transparent; border: 1px solid ${
                          mode === "top" ? theme.color : "#7f8c8d"
                        }; color: ${mode === "top" ? theme.color : "#7f8c8d"};`}
                      >
                        <span>${trophySVG} Top</span>
                      </button>
                    </a>
                    <a href="?mode=new&address=${ensData.address}&page=0">
                      <button
                        style=${`font-size: 1.01rem; border-radius: 2px; cursor: pointer; padding: 5px 15px; background-color: transparent; border: 1px solid ${
                          mode === "new" ? theme.color : "#7f8c8d"
                        }; color: ${mode === "new" ? theme.color : "#7f8c8d"};`}
                      >
                        <span>${broadcastSVG} New</span>
                      </button>
                    </a>
                  </div>
                </td>
              </tr>
              ${stories.length === 0
                ? html` <tr>
                    <td>No activity yet...</td>
                  </tr>`
                : ""}
              ${stories.map(Row())}
              ${stories.length === totalStories
                ? html`
                    <tr style="height: 50px">
                      <td>
                        <a
                          style="padding: 20px 0 0 20px; font-size: 1.1rem;"
                          href="?mode=${mode}&address=${ensData.address}&page=${page +
                          1}"
                        >
                          More
                        </a>
                      </td>
                    </tr>
                  `
                : html`<tr style="height: 13px;">
                    <td></td>
                  </tr>`}
            </table>
          </div>
        </div>
        ${Footer(theme)}
      </body>
    </html>
  `;
}

const iconStyle = "color: black; width: 32px;";
const github = html`
  <svg
    style="${iconStyle}"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <path
      d="M119.83,56A52,52,0,0,0,76,32a51.92,51.92,0,0,0-3.49,44.7A49.28,49.28,0,0,0,64,104v8a48,48,0,0,0,48,48h48a48,48,0,0,0,48-48v-8a49.28,49.28,0,0,0-8.51-27.3A51.92,51.92,0,0,0,196,32a52,52,0,0,0-43.83,24Z"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M104,232V192a32,32,0,0,1,32-32h0a32,32,0,0,1,32,32v40"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M104,208H72a32,32,0,0,1-32-32A32,32,0,0,0,8,144"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;
const telegram = html`
  <svg
    style="${iconStyle}"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <path
      d="M88,134.87,178.26,214a8,8,0,0,0,13.09-4.21L232,33.22a1,1,0,0,0-1.34-1.15L28,111.38A6.23,6.23,0,0,0,29,123.3Z"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <line
      x1="88"
      y1="134.87"
      x2="231.41"
      y2="32.09"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M132.37,173.78l-30.61,31.76A8,8,0,0,1,88,200V134.87"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;
const discord = html`
  <svg
    style="${iconStyle}"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <circle cx="92" cy="140" r="12" />
    <circle cx="164" cy="140" r="12" />
    <path
      d="M153.44,73.69l5-19.63a8.1,8.1,0,0,1,9.21-6L203.69,54A8.08,8.08,0,0,1,210.23,60l29.53,116.37a8,8,0,0,1-4.55,9.24l-67,29.7a8.15,8.15,0,0,1-11-4.56L147,183.06"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M102.56,73.69l-5-19.63a8.1,8.1,0,0,0-9.21-6L52.31,54A8.08,8.08,0,0,0,45.77,60L16.24,176.35a8,8,0,0,0,4.55,9.24l67,29.7a8.15,8.15,0,0,0,11-4.56L109,183.06"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M80,78.31A178.94,178.94,0,0,1,128,72a178.94,178.94,0,0,1,48,6.31"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M176,177.69A178.94,178.94,0,0,1,128,184a178.94,178.94,0,0,1-48-6.31"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;
const warpcast = html`
  <svg
    style="color: black; width: 30px;"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M23.2 21.4286C23.642 21.4286 24 21.7802 24 22.2143V23H16V22.2143C16 21.7802 16.358 21.4286 16.8 21.4286H23.2Z"
      stroke="currentColor"
      fill="none"
    ></path>
    <path
      d="M23.2 21.4286V20.6429C23.2 20.2087 22.842 19.8571 22.4 19.8571H17.6C17.158 19.8571 16.8 20.2087 16.8 20.6429V21.4286H23.2Z"
      stroke="currentColor"
      fill="none"
    ></path>
    <path d="M20 1H4V4.14286H20V1Z" stroke="currentColor" fill="none"></path>
    <path
      d="M23.2 7.28571H0.8L0 4.14286H24L23.2 7.28571Z"
      stroke="currentColor"
      fill="none"
    ></path>
    <path
      d="M22.4 7.28571H17.6L17.6 19.8571H22.4V7.28571Z"
      stroke="currentColor"
      fill="none"
    ></path>
    <path
      d="M7.2 21.4286C7.642 21.4286 8 21.7802 8 22.2143V23H0V22.2143C0 21.7802 0.358 21.4286 0.8 21.4286H7.2Z"
      stroke="currentColor"
      fill="none"
    ></path>
    <path
      d="M7.2 21.4286V20.6429C7.2 20.2087 6.842 19.8571 6.4 19.8571H1.6C1.158 19.8571 0.800001 20.2087 0.800001 20.6429L0.8 21.4286H7.2Z"
      stroke="currentColor"
      fill="none"
    ></path>
    <path
      d="M6.4 7.28571H1.6L1.6 19.8571H6.4L6.4 7.28571Z"
      stroke="currentColor"
      fill="none"
    ></path>
    <path
      d="M6.4 13.5086C6.4 10.471 8.9072 8.00857 12 8.00857C15.0928 8.00857 17.6 10.471 17.6 13.5086L17.6 7.28571H6.4L6.4 13.5086Z"
      stroke="currentColor"
      fill="none"
    ></path>
  </svg>
`;

const twitter = html`
  <svg
    style="${iconStyle}"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <path
      d="M88,176S32.85,144,40.78,56c0,0,39.66,40,87.22,48V88c0-22,18-40.27,40-40a40.74,40.74,0,0,1,36.67,24H240l-32,32c-4.26,66.84-60.08,120-128,120-32,0-40-12-40-12S72,200,88,176Z"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;

const website = html`
  <svg
    style="${iconStyle}"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <circle
      cx="128"
      cy="128"
      r="96"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M88,128c0,37.46,13.33,70.92,34.28,93.49a7.77,7.77,0,0,0,11.44,0C154.67,198.92,168,165.46,168,128s-13.33-70.92-34.28-93.49a7.77,7.77,0,0,0-11.44,0C101.33,57.08,88,90.54,88,128Z"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <line
      x1="37.46"
      y1="96"
      x2="218.54"
      y2="96"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <line
      x1="37.46"
      y1="160"
      x2="218.54"
      y2="160"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;
