//@format
import { env } from "process";
import { URL } from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import { sub, differenceInMinutes, differenceInSeconds } from "date-fns";
import DOMPurify from "isomorphic-dompurify";

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
import { getBest } from "../cache.mjs";

const html = htm.bind(vhtml);

async function getStories(trie, page, period, domain) {
  let startDatetime = 0;
  const unix = (date) => Math.floor(date.getTime() / 1000);
  const now = new Date();
  if (period === "month") {
    startDatetime = unix(sub(now, { months: 1 }));
  } else if (period === "week") {
    startDatetime = unix(sub(now, { weeks: 1 }));
  } else if (period === "day") {
    startDatetime = unix(sub(now, { days: 1 }));
  }

  const totalStories = parseInt(env.TOTAL_STORIES, 10);
  const from = totalStories * page;
  const orderBy = null;
  const result = getBest(totalStories, from, orderBy, domain, startDatetime);

  let writers = [];
  try {
    writers = await moderation.getWriters();
  } catch (err) {
    // noop
  }

  let stories = [];
  for await (let story of result) {
    const ensData = await ens.resolve(story.identity);

    let avatars = [];
    for await (let upvoter of story.upvoters) {
      const profile = await ens.resolve(upvoter);
      if (profile.safeAvatar) {
        avatars.push(`/avatar/${profile.address}`);
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

export default async function index(trie, theme, page, period, domain) {
  const totalStories = parseInt(env.TOTAL_STORIES, 10);
  const stories = await getStories(trie, page, period, domain);
  const ogImage = "https://news.kiwistand.com/kiwi_top_feed_page.png";
  const recentJoiners = await registry.recents();
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
        <div class="container">
          ${Sidebar("/best")}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr class="third-header">
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
              ${stories.map(
                Row(
                  null,
                  "/best",
                  undefined,
                  false,
                  false,
                  period,
                  recentJoiners,
                ),
              )}
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
            </table>
          </div>
        </div>
        ${Footer(theme, "/best")}
      </body>
    </html>
  `;
}
