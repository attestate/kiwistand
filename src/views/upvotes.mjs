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
import { count, topstories } from "./feed.mjs";
import * as ens from "../ens.mjs";
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

export default async function (trie, theme, identity, page, mode) {
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
