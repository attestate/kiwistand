//@format
import { env } from "process";
import url from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import { formatDistanceToNow, sub } from "date-fns";

import * as ens from "../ens.mjs";
import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";
import * as store from "../store.mjs";
import * as moderation from "./moderation.mjs";

const html = htm.bind(vhtml);

function extractDomain(link) {
  const parsedUrl = new url.URL(link);
  return parsedUrl.hostname;
}

export function count(leaves) {
  const stories = {};

  leaves = leaves.sort((a, b) => a.timestamp - b.timestamp);
  for (const leaf of leaves) {
    const key = `${normalizeUrl(leaf.href)}`;
    let story = stories[key];

    if (!story) {
      story = {
        title: leaf.title,
        timestamp: leaf.timestamp,
        href: leaf.href,
        address: leaf.address,
        upvotes: 1,
      };
      stories[key] = story;
    } else {
      if (leaf.type === "amplify") {
        story.upvotes += 1;
        if (!story.title && leaf.title) story.title = leaf.title;
      }
    }
  }
  return Object.values(stories);
}

export default async function (trie, theme) {
  const config = await moderation.getLists();

  const aWeekAgo = sub(new Date(), {
    weeks: 1,
  });
  const aWeekAgoUnixTime = Math.floor(aWeekAgo.getTime() / 1000);
  const from = null;
  const amount = null;
  const parser = JSON.parse;
  let leaves = await store.leaves(trie, from, amount, parser, aWeekAgoUnixTime);
  leaves = moderation.moderate(leaves, config);

  let counts = count(leaves);
  let sortedCounts = counts.sort((a, b) => b.timestamp - a.timestamp);
  let slicedCounts = sortedCounts.slice(0, 40);

  let stories = [];
  for await (let item of slicedCounts) {
    const ensData = await ens.resolve(item.address);
    stories.push({
      ...item,
      displayName: ensData.displayName,
    });
  }

  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
      </head>
      <body>
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
            ${stories.map(
              (story, i) => html`
                <tr>
                  <td>
                    <table
                      style="padding: 5px;"
                      border="0"
                      cellpadding="0"
                      cellspacing="0"
                    >
                      <tr class="athing" id="35233479">
                        <td align="right" valign="top" class="title">
                          <span style="padding-right: 5px" class="rank"
                            >${i + 1}.
                          </span>
                        </td>
                        <td style="width:25px;" valign="top" class="votelinks">
                          <center>
                            <a id="up_35233479" class="clicky" href="#">
                              <div
                                class="votearrowcontainer"
                                data-title="${story.title}"
                                data-href="${story.href}"
                              ></div>
                            </a>
                          </center>
                        </td>
                        <td class="title">
                          <span class="titleline">
                            <a target="_blank" href="${story.href}">
                              ${story.title}
                              <span> </span>
                              <span
                                style="vertical-align:top; font-size: 0.8em; font-weight: bolder;"
                              >
                                ${String.fromCharCode(0x2934, 0xfe0e)}
                              </span>
                            </a>
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
                              style="display: inline-block;"
                              class="score"
                              id="score_35233479"
                            >
                              ${story.upvotes}
                              <span> upvotes by </span>
                              <a href="/upvotes?address=${story.address}">
                                ${story.displayName}
                              </a>
                              <span> </span>
                              ${formatDistanceToNow(
                                new Date(story.timestamp * 1000)
                              )}
                              <paid-share
                                href="https://warpcast.com/~/compose?embeds[]=${story.href}"
                              ></paid-share>
                            </span>
                          </span>
                        </td>
                      </tr>
                      <tr class="spacer" style="height:5px"></tr>
                    </table>
                  </td>
                </tr>
              `
            )}
          </table>
          ${Footer(theme)}
        </center>
      </body>
    </html>
  `;
}
