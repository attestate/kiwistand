//@format
import { env } from "process";
import url from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import { sub, formatDistanceToNow, differenceInMinutes } from "date-fns";
import { fetchBuilder, MemoryCache } from "node-fetch-cache";

import * as ens from "../ens.mjs";
import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";
import * as store from "../store.mjs";
import * as id from "../id.mjs";
import * as moderation from "./moderation.mjs";
import log from "../logger.mjs";

const html = htm.bind(vhtml);
const fetch = fetchBuilder.withCache(
  new MemoryCache({
    ttl: 60000 * 5, //5mins
  })
);

function extractDomain(link) {
  const parsedUrl = new url.URL(link);
  return parsedUrl.hostname;
}

const itemAge = (timestamp) => {
  const now = new Date();
  const ageInMinutes = differenceInMinutes(now, new Date(timestamp * 1000));
  return ageInMinutes;
};

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
        displayName: leaf.displayName,
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

const calculateScore = (votes, itemHourAge, gravity = 1.8) => {
  return (votes - 1) / Math.pow(itemHourAge + 2, gravity);
};

async function topstories(leaves, start, end) {
  return count(leaves)
    .map((story) => {
      const score = calculateScore(story.upvotes, itemAge(story.timestamp));
      story.score = score;
      return story;
    })
    .sort((a, b) => b.score - a.score)
    .slice(start, end);
}

async function editors(leaves) {
  function parseConfig(config) {
    const copy = { ...config };
    copy.numberOfStories = parseInt(config.numberOfStories, 10);
    return copy;
  }

  function editorPicks(leaves, config, links) {
    const cacheEnabled = true;
    const editorStories = leaves
      .map((leaf) => ({
        address: id.ecrecover(leaf, cacheEnabled),
        ...leaf,
      }))
      .filter(
        ({ address }) => address.toLowerCase() === config.address.toLowerCase()
      );

    if (links && Array.isArray(links) && links.length > 0) {
      return editorStories.filter(({ href }) =>
        links.includes(!!href && normalizeUrl(href))
      );
    }
    return editorStories;
  }
  let response;
  try {
    response = (await moderation.getConfig("3wi"))[0];
  } catch (err) {
    log(`3wi: Couldn't get editor pick config: ${err.toString()}`);
    return {
      editorPicks: [],
      links: [],
      config: {
        name: "isyettoberevealed!",
        link: "https://anddoesnthaveawebsite.com",
      },
    };
  }
  const config = parseConfig(response);

  let links;
  try {
    links = await moderation.getConfig("editor_links");
  } catch (err) {
    log(`editor_links: Couldn't get editor pick config: ${err.toString()}`);
    return {
      editorPicks: [],
      links: [],
      config: {
        name: "isyettoberevealed!",
        link: "https://anddoesnthaveawebsite.com",
      },
    };
  }

  if (links && Array.isArray(links)) {
    links = links.map(({ link }) => !!link && normalizeUrl(link));
  }

  const from = null;
  const amount = null;
  const parser = JSON.parse;
  const picks = editorPicks(leaves, config, links);
  const stories = count(picks)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, config.numberOfStories);
  return {
    editorPicks: stories,
    links,
    config,
  };
}

export default async function index(trie, theme, page) {
  const aWeekAgo = sub(new Date(), {
    weeks: 1,
  });
  const aWeekAgoUnixTime = Math.floor(aWeekAgo.getTime() / 1000);
  const from = null;
  const amount = null;
  const parser = JSON.parse;
  let leaves = await store.leaves(trie, from, amount, parser, aWeekAgoUnixTime);
  const policy = await moderation.getLists();
  leaves = moderation.moderate(leaves, policy);

  const { editorPicks, config } = await editors(leaves);
  const editorLinks = editorPicks.map(
    ({ href }) => !!href && normalizeUrl(href)
  );

  const totalStories = parseInt(env.TOTAL_STORIES, 10);
  const start = totalStories * page;
  const end = totalStories * (page + 1);
  const storyPromises = await topstories(leaves, start, end);

  let stories = [];
  for await (let story of storyPromises) {
    const ensData = await ens.resolve(story.address);
    stories.push({
      ...story,
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
            ${page === 0 && editorPicks.length > 0
              ? html` <tr style="background-color: #e6e6df;">
                  <td>
                    <p
                      style="color: black; padding: 10px; font-size: 12pt; font-weight: bold;"
                    >
                      <a
                        style="font-size: 16pt; color: ${theme.color}"
                        href="/subscribe"
                        >✉</a
                      >
                      <span> </span>
                      <span>Today's Editor's Picks by </span>
                      <a style="color:black;" href="${config.link}">
                        ${config.name}</a
                      >!
                    </p>
                  </td>
                </tr>`
              : ""}
            ${page === 0 &&
            editorPicks.map(
              (story, i) => html`
                <tr style="background-color: #e6e6df;">
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
                                style="width: 10px;"
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
                              style="display: inline-block; height: auto;"
                              class="score"
                              id="score_35233479"
                            >
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
            <tr>
              <td>
                <p
                  style="color: black; padding: 10px; font-size: 12pt; font-weight: bold;"
                >
                  <span
                    >Community's Picks
                    ${page !== 0 ? html`(page: ${page})` : ""}</span
                  >
                </p>
              </td>
            </tr>
            ${page === 0
              ? html`
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
                              >*
                            </span>
                          </td>
                          <td valign="top" class="votelinks">
                            <center>
                              <a id="up_35233479" class="clicky" href="#"> </a>
                            </center>
                          </td>
                          <td class="title">
                            <span style="font-weight: bold;" class="titleline">
                              <a
                                target="_blank"
                                href="https://hackmd.io/a-r--DX2T5uEEKX0Z8PRlQ?view"
                              >
                                Submission Guidelines (please read before
                                posting)
                                <span> </span>
                                <span
                                  style="vertical-align:top; font-size: 0.8em; font-weight: bolder;"
                                >
                                  ${String.fromCharCode(0x2934, 0xfe0e)}
                                </span>
                              </a>
                              <span style="padding-left: 5px">
                                (hackmd.io)
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
                              </span>
                            </span>
                          </td>
                        </tr>
                        <tr class="spacer" style="height:5px"></tr>
                      </table>
                    </td>
                  </tr>
                `
              : ""}
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
                            >${start + i + 1}.
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
                              style="display: inline-block; height: auto;"
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
                              <span> ago</span>
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
            <tr>
              <td>
                <table
                  style="padding: 5px;"
                  border="0"
                  cellpadding="0"
                  cellspacing="0"
                >
                  <tr class="athing" id="35233479">
                    <td align="right" valign="top" class="title"></td>
                    <td valign="top" class="votelinks">
                      <center>
                        <a id="up_35233479" class="clicky" href="#"> </a>
                      </center>
                    </td>
                    <td class="title">
                      <span style="margin-left: 10px;" class="titleline">
                        <a href="?page=${page + 1}"> More </a>
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
                        </span>
                      </span>
                    </td>
                  </tr>
                  <tr class="spacer" style="height:5px"></tr>
                </table>
              </td>
            </tr>
            <tr
              style="display: block; padding: 10px; background-color: ${theme.color}"
            >
              <td>
                <span style="color: black;"
                  >Hungry for more links? Check out the
                </span>
                <span> </span>
                <a href="/new" style="color: black;"><u>New Links Tab</u></a>
              </td>
            </tr>
          </table>
          ${Footer(theme)}
        </center>
      </body>
    </html>
  `;
}
