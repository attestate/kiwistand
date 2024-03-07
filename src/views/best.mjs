//@format
import { env } from "process";
import { URL } from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import { sub, differenceInMinutes, differenceInSeconds } from "date-fns";

import { getTips, getTipsValue } from "../tips.mjs";
import PWALine from "./components/iospwaline.mjs";
import * as ens from "../ens.mjs";
import Header from "./components/header.mjs";
import SecondHeader from "./components/secondheader.mjs";
import ThirdHeader from "./components/thirdheader.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import { custom } from "./components/head.mjs";
import * as store from "../store.mjs";
import * as id from "../id.mjs";
import * as moderation from "./moderation.mjs";
import * as registry from "../chainstate/registry.mjs";
import log from "../logger.mjs";
import { EIP712_MESSAGE } from "../constants.mjs";
import Row, { extractDomain } from "./components/row.mjs";

const html = htm.bind(vhtml);

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
        upvoters: [leaf.identity],
        index: leaf.index,
      };
      stories[key] = story;
    } else {
      if (leaf.type === "amplify") {
        story.upvotes += 1;
        story.upvoters.push(leaf.identity);
        if (!story.title && leaf.title) story.title = leaf.title;
      }
    }
  }
  return Object.values(stories);
}

async function topstories(leaves, start, end) {
  return count(leaves).sort((a, b) => b.upvotes - a.upvotes);
}

async function recompute(trie, page, period, domain) {
  const from = null;
  const amount = null;
  const parser = JSON.parse;
  const allowlist = await registry.allowlist();
  const delegations = await registry.delegations();

  let startDatetime = null;
  let tolerance = null;
  const unix = (date) => Math.floor(date.getTime() / 1000);
  const now = new Date();
  if (period === "month") {
    startDatetime = unix(sub(now, { months: 1 }));
    tolerance = unix(sub(now, { months: 5 }));
  } else if (period === "week") {
    startDatetime = unix(sub(now, { weeks: 1 }));
    tolerance = unix(sub(now, { weeks: 14 }));
  } else if (period === "day") {
    startDatetime = unix(sub(now, { days: 1 }));
    tolerance = unix(sub(now, { weeks: 2 }));
  }

  const href = null;
  const type = "amplify";
  let leaves = await store.posts(
    trie,
    from,
    amount,
    parser,
    tolerance,
    allowlist,
    delegations,
    href,
    type,
  );
  const policy = await moderation.getLists();
  leaves = moderation.moderate(leaves, policy);

  const totalStories = parseInt(env.TOTAL_STORIES, 10);
  const start = totalStories * page;
  const end = totalStories * (page + 1);
  let storyPromises = (await topstories(leaves, start, end)).filter(
    (story) => story.timestamp >= startDatetime,
  );

  if (domain)
    storyPromises = storyPromises.filter(
      ({ href }) => extractDomain(href) === domain,
    );

  storyPromises = storyPromises.slice(start, end);
  let writers = [];
  try {
    writers = await moderation.getWriters();
  } catch (err) {
    // noop
  }

  const tips = await getTips();

  let stories = [];
  for await (let story of storyPromises) {
    const ensData = await ens.resolve(story.identity);

    const tipValue = getTipsValue(tips, story.index);
    story.tipValue = tipValue;

    let avatars = [];
    for await (let upvoter of story.upvoters) {
      const profile = await ens.resolve(upvoter);
      if (profile.safeAvatar) {
        avatars.push(profile.safeAvatar);
      }
    }
    const isOriginal = Object.keys(writers).some(
      (domain) =>
        normalizeUrl(story.href).startsWith(domain) &&
        writers[domain] === story.identity,
    );
    stories.push({
      ...story,
      displayName: ensData.displayName,
      avatars: avatars,
      isOriginal,
    });
  }
  return stories;
}

const pages = {};
export default async function index(trie, theme, page, period, domain) {
  const key = `${page}-${period}-${domain}`;
  const totalStories = parseInt(env.TOTAL_STORIES, 10);
  let cacheRes = pages[key];
  let stories;

  let maxAgeInSeconds = 60 * 60 * 24;
  if (period === "day" && page === 0 && !domain) maxAgeInSeconds = 60 * 60 * 6;
  if (period === "day" && page > 0 && page < 5 && !domain)
    maxAgeInSeconds = 60 * 60 * 10;
  if (period === "week" && page === 0 && !domain)
    maxAgeInSeconds = 60 * 60 * 24;
  if (period === "week" && page > 0 && page < 5 && !domain)
    maxAgeInSeconds = 60 * 60 * 24 * 2;
  if (period === "month" && page === 0 && !domain)
    maxAgeInSeconds = 60 * 60 * 24 * 3;
  if (period === "month" && page > 0 && page < 5 && !domain)
    maxAgeInSeconds = 60 * 60 * 24 * 5;
  if (period === "all" && page === 0 && !domain)
    maxAgeInSeconds = 60 * 60 * 24 * 7;
  if (period === "all" && page > 0 && page < 5 && !domain)
    maxAgeInSeconds = 60 * 60 * 24 * 7;

  if (
    !cacheRes ||
    (cacheRes &&
      differenceInSeconds(new Date(), cacheRes.age) > maxAgeInSeconds)
  ) {
    stories = await recompute(trie, page, period, domain);
    pages[key] = {
      stories,
      age: new Date(),
    };
  } else {
    stories = cacheRes.stories;
  }
  const ogImage = "https://news.kiwistand.com/kiwi_top_feed_page.png";
  return html`
    <html lang="en" op="news">
      <head>
        ${custom(ogImage)}
        <meta
          name="description"
          content="Explore the latest news in the decentralized world on Kiwi News. Stay updated with fresh content handpicked by crypto veterans."
        />
      </head>
      <body>
        ${PWALine}
        <div class="container">
          ${Sidebar()}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                ${ThirdHeader(theme, "new")}
              </tr>
              <tr>
                ${SecondHeader(theme, "best", period, domain)}
              </tr>
              <tr>
                <td>
                  <p
                    style="color: black; padding: ${page === 0
                      ? "0"
                      : "5px"} 10px ${page === 0
                      ? "0"
                      : "5px"} 10px; font-size: 12pt; font-weight: bold;"
                  >
                    <span> ${page !== 0 ? html`Page: ${page}` : ""}</span>
                  </p>
                </td>
              </tr>
              ${stories.map(Row(null, "/best", null, false, false, period))}
              <tr class="spacer" style="height:15px"></tr>
              ${stories.length < totalStories
                ? ""
                : html`<tr>
                    <td>
                      <table
                        style="padding: 5px;"
                        border="0"
                        cellpadding="0"
                        cellspacing="0"
                      >
                        <tr class="athing" id="35233479">
                          <td class="title">
                            <span style="margin-left: 10px;" class="titleline">
                              <a
                                href="?period=${period}&page=${page + 1}${domain
                                  ? `&domain=${domain}`
                                  : ""}"
                              >
                                More
                              </a>
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
                  </tr>`}
              <tr
                style="display: block; padding: 10px; background-color: ${theme.color}"
              >
                <td></td>
              </tr>
            </table>
          </div>
        </div>
        ${Footer(theme, "/best")}
      </body>
    </html>
  `;
}
