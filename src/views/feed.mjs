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
import SecondHeader from "./components/secondheader.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";
import * as store from "../store.mjs";
import * as id from "../id.mjs";
import * as moderation from "./moderation.mjs";
import * as registry from "../chainstate/registry.mjs";
import log from "../logger.mjs";
import { EIP712_MESSAGE } from "../constants.mjs";

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
        identity: leaf.identity,
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
    const editorStories = leaves.filter(
      // TODO: Should start using ethers.utils.getAddress
      ({ identity }) => identity.toLowerCase() === config.address.toLowerCase()
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
  const from = null;
  const amount = null;
  const parser = JSON.parse;
  const aWeekAgoUnixTime = Math.floor(aWeekAgo.getTime() / 1000);
  const allowlist = await registry.allowlist();
  const delegations = await registry.delegations();

  let leaves = await store.posts(
    trie,
    from,
    amount,
    parser,
    aWeekAgoUnixTime,
    allowlist,
    delegations
  );
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
    const ensData = await ens.resolve(story.identity);
    stories.push({
      ...story,
      displayName: ensData.displayName,
    });
  }

  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
        <meta
          name="description"
          content="Kiwi News is the prime feed for hacker engineers building a decentralized future. All our content is handpicked and curated by crypto veterans."
        />
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
              ${SecondHeader(theme, "top")}
            </tr>
            ${page === 0 && editorPicks.length > 0
              ? html` <tr style="background-color: #e6e6df;">
                  <td>
                    <p
                      style="color: black; padding: 0 10px 0 10px; font-size: 12pt; font-weight: bold;"
                    >
                      <a
                        style="font-size: 16pt; color: ${theme.color}"
                        href="/subscribe"
                        >✉</a
                      >
                      <span> </span>
                      <span>Links picked by today's editor </span>
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
                    <div style="padding: 10px 5px 0 10px;">
                      <div style="display: flex; align-items: flex-start;">
                        <div
                          style="font-size: 13pt; display: flex; align-items: center; min-width: 35px;"
                        >
                          <span>${start + i + 1}.</span>
                        </div>
                        <div
                          style="display: flex; align-items: center; min-width: 30px;"
                        >
                          <a href="#">
                            <div
                              class="votearrowcontainer"
                              data-title="${story.title}"
                              data-href="${story.href}"
                            ></div>
                          </a>
                        </div>
                        <div style="flex-grow: 1;">
                          <span>
                            <a
                              href="${story.href}"
                              target="_blank"
                              class="story-link"
                              style="line-height: 13pt; font-size: 13pt;"
                            >
                              ${story.title}
                            </a>
                            <span
                              style="padding-left: 5px; word-break: break-all;"
                              >(${extractDomain(story.href)})</span
                            >
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              `
            )}
            ${page === 0 && editorPicks.length > 0
              ? html` <tr style="height: 13px; background-color: #e6e6df;">
                  <td></td>
                </tr>`
              : ""}
            <tr>
              <td>
                <p
                  style="color: black; padding: 10px 10px 0 10px; font-size: 12pt; font-weight: bold;"
                >
                  <span
                    >Community Picks
                    ${page !== 0 ? html`(page: ${page})` : ""}</span
                  >
                </p>
              </td>
            </tr>
            ${stories.map(
              (story, i) => html`
                <tr>
                  <td>
                    <div style="padding: 10px 5px 0 10px;">
                      <div style="display: flex; align-items: flex-start;">
                        <div
                          style="font-size: 13pt; display: flex; align-items: center; min-width: 35px;"
                        >
                          <span>${start + i + 1}.</span>
                        </div>
                        <div
                          style="display: flex; align-items: center; min-width: 30px;"
                        >
                          <a href="#">
                            <div
                              class="votearrowcontainer"
                              data-title="${story.title}"
                              data-href="${story.href}"
                            ></div>
                          </a>
                        </div>
                        <div style="flex-grow: 1;">
                          <span>
                            <a
                              href="${story.href}"
                              target="_blank"
                              class="story-link"
                              style="line-height: 13pt; font-size: 13pt;"
                            >
                              ${story.title}
                            </a>
                            <span
                              style="padding-left: 5px; word-break: break-all;"
                              >(${extractDomain(story.href)})</span
                            >
                          </span>
                          <div style="margin-top: 2px; font-size: 10pt;">
                            <span>
                              ${story.upvotes}
                              <span> upvotes by </span>
                              <a
                                href="/upvotes?address=${story.identity}"
                                class="meta-link"
                              >
                                ${story.displayName}
                              </a>
                              <span> </span>
                              ${formatDistanceToNow(
                                new Date(story.timestamp * 1000)
                              )}
                              <span> ago | </span>
                              <a
                                target="_blank"
                                data-free="https://warpcast.com/~/compose?embeds[]=${story.href}&text=${encodeURIComponent(
                                  `Find on Kiwi News: "${story.title}"`
                                )}&embeds[]=https://news.kiwistand.com"
                                data-premium="https://warpcast.com/~/compose?embeds[]=${story.href}"
                                class="caster-link"
                              >
                                Cast
                              </a>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
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
          ${Footer(theme, "/")}
        </center>
      </body>
    </html>
  `;
}
