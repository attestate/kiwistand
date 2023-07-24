//@format
import url from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import { formatDistanceToNow } from "date-fns";
import { utils } from "ethers";

import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import Sidebar from "./components/sidebar.mjs";
import Head from "./components/head.mjs";
import * as store from "../store.mjs";
import { EIP712_MESSAGE } from "../constants.mjs";
import { count } from "./feed.mjs";
import * as ens from "../ens.mjs";
import * as registry from "../chainstate/registry.mjs";

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

export default async function (trie, theme, identity) {
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
    delegations
  );
  const cacheEnabled = true;
  leaves = await Promise.all(
    leaves.map(async (leaf) => {
      const ensData = await ens.resolve(leaf.identity);
      return {
        ...leaf,
        displayName: ensData.displayName,
      };
    })
  );
  const actions = classify(leaves);
  const taintedSubmissions = actions
    .filter(
      (action) =>
        // TODO: Should start using ethers.utils.getAddress
        identity.toLowerCase() === action.message.identity.toLowerCase() &&
        action.verb === "submit"
    )
    .map((action) => normalizeUrl(action.message.href));
  const taintedUpvotes = actions
    .filter(
      (action) =>
        // TODO: Should start using ethers.utils.getAddress
        identity.toLowerCase() === action.message.identity.toLowerCase() &&
        action.verb === "upvote"
    )
    .map((action) => normalizeUrl(action.message.href));
  const submissions = count(leaves)
    .filter((story) => taintedSubmissions.includes(normalizeUrl(story.href)))
    .sort((a, b) => {
      const timestampA = new Date(a.timestamp);
      const timestampB = new Date(b.timestamp);

      if (timestampA < timestampB) {
        return 1;
      }
      if (timestampA > timestampB) {
        return -1;
      }
      return 0;
    })
    .slice(0, 10);
  const upvotes = count(leaves)
    .filter((story) => taintedUpvotes.includes(normalizeUrl(story.href)))
    .sort((a, b) => {
      const timestampA = new Date(a.timestamp);
      const timestampB = new Date(b.timestamp);

      if (timestampA < timestampB) {
        return 1;
      }
      if (timestampA > timestampB) {
        return -1;
      }
      return 0;
    })
    .slice(0, 10);

  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
      </head>
      <body>
        ${Sidebar}
        <center>
          <table
            id="hnmain"
            border="0"
            cellpadding="0"
            cellspacing="0"
            width="85%"
            bgcolor="#f6f6ef"
          >
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
                    ${String.fromCharCode(0x2934, 0xfe0e)}
                  </a>
                  ${ensData.description
                    ? html`<span> </span>"${ensData.description}"<br />`
                    : html`<br />`}
                  ${ensData.url
                    ? html`<span>Website: </span>
                        <a target="_blank" href="${ensData.url}"
                          >${ensData.url} ${String.fromCharCode(0x2934, 0xfe0e)} </a
                        ><br />`
                    : ""}
                  ${ensData.twitter
                    ? html` <span>Twitter: </span>
                        <a
                          href="https://twitter.com/${ensData.twitter}"
                          target="_blank"
                          rel="noopener noreferrer"
                          >@${ensData.twitter}
                          ${String.fromCharCode(0x2934, 0xfe0e)} </a
                        ><br />`
                    : ""}
                  ${ensData.github
                    ? html`<span>GitHub: </span>
                        <a
                          href="https://github.com/${ensData.github}"
                          target="_blank"
                          rel="noopener noreferrer"
                          >${ensData.github}
                          ${String.fromCharCode(0x2934, 0xfe0e)} </a
                        ><br />`
                    : ""}
                  ${ensData.telegram
                    ? html`<span>Telegram: </span>
                        <a
                          href="https://t.me/${ensData.telegram}"
                          target="_blank"
                          rel="noopener noreferrer"
                          >${ensData.telegram}
                          ${String.fromCharCode(0x2934, 0xfe0e)} </a
                        ><br />`
                    : ""}
                  ${ensData.discord
                    ? html`<span>Discord: </span> ${ensData.discord}<br />`
                    : ""}
                  <hr />
                  ${submissions.length > 0
                    ? html`<b>LAST 10 SUBMISSIONS: </b>`
                    : ""}
                </div>
              </td>
            </tr>
            ${submissions.length === 0 && upvotes.length === 0
              ? html` <tr>
                  <td>No activity yet...</td>
                </tr>`
              : ""}
            ${submissions.map(
              (story, i) => html`
                <tr style="font-size: 12pt;">
                  <td>
                    <table
                      style="padding: 5px 5px 0 15px;"
                      border="0"
                      cellpadding="0"
                      cellspacing="0"
                    >
                      <tr class="athing" id="35233479">
                        <td align="right" valign="top" class="title"></td>
                        <td valign="top" class="votelinks">
                          <center></center>
                        </td>
                        <td class="title">
                          <span class="titleline">
                            <a href="${story.href}">${story.title}</a>
                            <span
                              style="padding-left: 5px; word-break: break-all;"
                            >
                              (${extractDomain(story.href)})
                            </span>
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2"></td>
                        <td class="subtext">
                          <span class="subline">
                            <span
                              style="display: inline-block; height: auto;"
                              class="score"
                              id="score_35233479"
                            >
                              ${story.upvotes}
                              <span> points </span>
                              <span> submitted </span>
                              ${formatDistanceToNow(
                                new Date(story.timestamp * 1000)
                              )}
                              <span> ago</span>
                            </span>
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              `
            )}
            ${upvotes.length > 0
              ? html` <tr>
                  <td>
                    <div
                      style="padding: 10px 10px 0 10px; color: black; font-size: 16px"
                    >
                      <hr />
                      <b>LAST 10 UPVOTES: </b>
                    </div>
                  </td>
                </tr>`
              : ""}
            ${upvotes.map(
              (story, i) => html`
                <tr style="font-size: 12pt;">
                  <td>
                    <table
                      style="padding: 5px 5px 0 15px;"
                      border="0"
                      cellpadding="0"
                      cellspacing="0"
                    >
                      <tr class="athing" id="35233479">
                        <td align="right" valign="top" class="title"></td>
                        <td valign="top" class="votelinks">
                          <center></center>
                        </td>
                        <td class="title">
                          <span class="titleline">
                            <a href="${story.href}">${story.title}</a>
                            <span style="padding-left: 5px">
                              (${extractDomain(story.href)})
                            </span>
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2"></td>
                        <td class="subtext">
                          <span class="subline">
                            <span
                              style="display: inline-block; height: auto;"
                              class="score"
                              id="score_35233479"
                            >
                              ${story.upvotes}
                              <span> points by </span>
                              <a href="/upvotes?address=${story.identity}">
                                ${story.displayName}
                              </a>
                              <span> submitted </span>
                              ${formatDistanceToNow(
                                new Date(story.timestamp * 1000)
                              )}
                              <span> ago</span>
                            </span>
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              `
            )}
            <tr style="height: 13px;">
              <td></td>
            </tr>
          </table>
          ${Footer(theme)}
        </center>
      </body>
    </html>
  `;
}
