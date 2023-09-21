//@format
import url from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import { formatDistanceToNow } from "date-fns";
import { utils } from "ethers";
import fetch from "node-fetch";
import Header from "./components/header.mjs";
import { trophySVG, broadcastSVG } from "./components/secondheader.mjs";
import Footer from "./components/footer.mjs";
import Sidebar from "./components/sidebar.mjs";
import Head from "./components/head.mjs";
import * as store from "../store.mjs";
import { EIP712_MESSAGE } from "../constants.mjs";
import { count, topstories } from "./feed.mjs";
import * as ens from "../ens.mjs";
import * as registry from "../chainstate/registry.mjs";
import Row from "./components/row.mjs";
import fs from "fs";
import path from "path";

let cache = {};

async function fetchProfile(address) {
  if (cache[address]) {
    return cache[address];
  }

  const response = await fetch(
    `https://searchcaster.xyz/api/profiles?q=${address}`,
  );
  const data = await response.json();
  cache[address] = data;
  return data;
}

const html = htm.bind(vhtml);

const warpcastIcon = html`
  <svg
    width="25"
    height="25"
    viewBox="0 0 1260 1260"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g clip-path="url(#clip0_1_2)">
      <path
        d="M947.747 1259.61H311.861C139.901 1259.61 0 1119.72 0 947.752V311.871C0 139.907 139.901 0.00541362 311.861 0.00541362H947.747C1119.71 0.00541362 1259.61 139.907 1259.61 311.871V947.752C1259.61 1119.72 1119.71 1259.61 947.747 1259.61Z"
        fill="#472A91"
      ></path>
      <path
        d="M826.513 398.633L764.404 631.889L702.093 398.633H558.697L495.789 633.607L433.087 398.633H269.764L421.528 914.36H562.431L629.807 674.876L697.181 914.36H838.388L989.819 398.633H826.513Z"
        fill="white"
      ></path>
    </g>
    <defs>
      <clipPath id="clip0_1_2">
        <rect width="1259.61" height="1259.61" fill="white"></rect>
      </clipPath>
    </defs>
  </svg>
`;

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

export default async function (trie, theme, identity, page, mode) {
  if (!utils.isAddress(identity)) {
    return html`Not a valid address`;
  }
  const ensData = await ens.resolve(identity);
  const profileData = await fetchProfile(identity);
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
        const upvoterEnsData = await ens.resolve(upvoter);
        let avatarUrl = upvoterEnsData.avatar;
        if (avatarUrl && !avatarUrl.startsWith("https")) {
          avatarUrl = upvoterEnsData.avatar_url;
        }
        if (avatarUrl) {
          avatars.push(avatarUrl);
        }
      }
      return {
        ...leaf,
        displayName: ensData.displayName,
        avatars: avatars,
      };
    }),
  );

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
                ${Header(theme)}
              </tr>
              <tr>
                <td>
                  <div
                    style="padding: 10px 10px 0 10px; color: black; font-size: 16px; line-height: 1.5;"
                  >
                    <span>Profile: </span>
                    <a
                      target="_blank"
                      href="https://etherscan.io/address/${ensData.address}"
                    >
                      ${ensData.displayName}
                    </a>
                    ${ensData.description
                      ? html`<span> </span>"${ensData.description}"<br />`
                      : html`<br />`}
                    ${ensData.url
                      ? html`<span>Website: </span>
                          <a target="_blank" href="${ensData.url}"
                            >${ensData.url}</a
                          ><br />`
                      : ""}
                    ${ensData.twitter
                      ? html` <span>Twitter: </span>
                          <a
                            href="https://twitter.com/${ensData.twitter}"
                            target="_blank"
                            rel="noopener noreferrer"
                            >@${ensData.twitter}</a
                          ><br />`
                      : ""}
                    ${ensData.github
                      ? html`<span>GitHub: </span>
                          <a
                            href="https://github.com/${ensData.github}"
                            target="_blank"
                            rel="noopener noreferrer"
                            >${ensData.github}</a
                          ><br />`
                      : ""}
                    ${ensData.telegram
                      ? html`<span>Telegram: </span>
                          <a
                            href="https://t.me/${ensData.telegram}"
                            target="_blank"
                            rel="noopener noreferrer"
                            >${ensData.telegram}</a
                          ><br />`
                      : ""}
                    ${ensData.discord
                      ? html`<span>Discord: </span> ${ensData.discord}<br />`
                      : ""}
                    ${profileData.some((profile) => profile.body)
                      ? html`
                          <a
                            href="https://warpcast.com/${profileData[0].body
                              .username}"
                            target="_blank"
                          >
                            <div style="margin-top: 4px;">${warpcastIcon}</div>
                          </a>
                          <br />
                        `
                      : ""}
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
