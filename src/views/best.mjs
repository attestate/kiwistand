//@format
import { env } from "process";
import { URL } from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import {
  startOfYear,
  sub,
  differenceInMinutes,
  differenceInSeconds,
} from "date-fns";
import DOMPurify from "isomorphic-dompurify";

import * as ens from "../ens.mjs";
import Header from "./components/header.mjs";
import SecondHeader from "./components/secondheader.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import { custom } from "./components/head.mjs";
import * as store from "../store.mjs";
import * as id from "../id.mjs";
import * as moderation from "./moderation.mjs";
import log from "../logger.mjs";
import { EIP712_MESSAGE } from "../constants.mjs";
import Row, { extractDomain } from "./components/row.mjs";
import { getBest, getLastComment, countImpressions } from "../cache.mjs";
import { cachedMetadata } from "../parser.mjs";

const html = htm.bind(vhtml);

async function addMetadata(post) {
  const data = cachedMetadata(post.href);
  return {
    ...post,
    metadata: data,
  };
}

async function getStories(trie, page, period, domain) {
  let startDatetime = 0;
  const unix = (date) => Math.floor(date.getTime() / 1000);
  const now = new Date();
  if (period === "year") {
    startDatetime = unix(startOfYear(now));
  } else if (period === "month") {
    startDatetime = unix(sub(now, { months: 1 }));
  } else if (period === "week") {
    startDatetime = unix(sub(now, { weeks: 1 }));
  } else if (period === "day") {
    startDatetime = unix(sub(now, { days: 1 }));
  }

  const totalStories = parseInt(env.TOTAL_STORIES, 10);
  const from = totalStories * page;
  const orderBy = null;
  let result = getBest(totalStories, from, orderBy, domain, startDatetime);

  const policy = await moderation.getLists();
  const path = "/best";
  result = moderation.moderate(result, policy, path);

  let writers = [];
  try {
    writers = await moderation.getWriters();
  } catch (err) {
    // noop
  }

  let stories = [];
  for await (let story of result) {
    // Get last comment
    const lastComment = getLastComment(`kiwi:0x${story.index}`, policy.addresses || []);
    if (lastComment && lastComment.identity) {
      lastComment.identity = await ens.resolve(lastComment.identity);
      const uniqueIdentities = new Set(
        lastComment.previousParticipants
          .map((p) => p.identity)
          .filter((identity) => identity !== lastComment.identity),
      );

      const resolvedParticipants = await Promise.allSettled(
        [...uniqueIdentities].map((identity) => ens.resolve(identity)),
      );

      lastComment.previousParticipants = resolvedParticipants
        .filter(
          (result) =>
            result.status === "fulfilled" && result.value.safeAvatar,
        )
        .map((result) => ({
          identity: result.value.identity,
          safeAvatar: result.value.safeAvatar,
          displayName: result.value.displayName,
        }));
    }

    // Resolve ENS data for submitter
    const ensData = await ens.resolve(story.identity);

    // Get upvoter avatars
    let avatars = [];
    let upvoterProfiles = [];
    for await (let upvoter of story.upvoters) {
      const profile = await ens.resolve(upvoter);
      if (profile.safeAvatar) {
        upvoterProfiles.push({
          avatar: profile.safeAvatar,
          address: upvoter,
          neynarScore: profile.neynarScore || 0
        });
      }
    }
    // Sort by neynarScore descending and take top 5
    upvoterProfiles.sort((a, b) => b.neynarScore - a.neynarScore);
    avatars = upvoterProfiles.slice(0, 5).map(p => p.avatar);

    // Check if story is original
    const isOriginal = Object.keys(writers).some(
      (domain) =>
        normalizeUrl(story.href).startsWith(domain) &&
        writers[domain] === story.identity,
    );

    // Add metadata
    const augmentedStory = await addMetadata(story);
    let finalStory = augmentedStory || story;

    // Handle image blocking based on policy
    const href = normalizeUrl(finalStory.href, { stripWWW: false });
    if (href && policy?.images?.includes(href) && finalStory.metadata?.image) {
      delete finalStory.metadata.image;
    }

    // Get impressions count
    const impressions = countImpressions(finalStory.href);

    stories.push({
      ...finalStory,
      impressions,
      lastComment,
      displayName: ensData.displayName,
      submitter: ensData,
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
  const prefetch = [
    "/",
    "/new?cached=true",
    "/submit",
    "/best?period=day",
    "/best?period=week",
    "/best?period=month",
    "/best?period=year",
    "/best?period=all",
  ];
  return html`
    <html lang="en" op="news">
      <head>
        ${custom(ogImage, undefined, undefined, undefined, prefetch)}
        <meta
          name="description"
          content="Fresh crypto news daily"
        />
      </head>
      <body
        data-instant-allow-query-string
        data-instant-allow-external-links
        ontouchstart=""
      >
        <div class="container">
          ${Sidebar("/best")}
          <div id="hnmain" class="scaled-hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                ${SecondHeader(theme, "best", period, domain)}
              </tr>
              ${page !== 0
                ? html`<tr>
                    <td>
                      <p
                        style="color: black; padding: 5px 10px 5px 10px; font-size: 12pt; font-weight: bold;"
                      >
                        <span>Page: ${page}</span>
                      </p>
                    </td>
                  </tr>`
                : null}
              ${stories.map(
                Row(
                  null,
                  "/best",
                  "margin-bottom: 20px;",
                  false,
                  false,
                  period,
                ),
              )}
              <tr class="spacer" style="height:15px"></tr>
              <tr>
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
                            class="more-link"
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
              </tr>
            </table>
            ${Footer(theme, "/best")}
          </div>
        </div>
      </body>
    </html>
  `;
}
