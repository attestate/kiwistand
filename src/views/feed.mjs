//@format
import { env } from "process";
import { URL } from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import {
  sub,
  differenceInSeconds,
  differenceInMinutes,
  isBefore,
} from "date-fns";
import DOMPurify from "isomorphic-dompurify";

import * as ens from "../ens.mjs";
import Header from "./components/header.mjs";
import SecondHeader from "./components/secondheader.mjs";
import ThirdHeader from "./components/thirdheader.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import { custom } from "./components/head.mjs";
import * as store from "../store.mjs";
import * as moderation from "./moderation.mjs";
import { countOutbounds, getBest } from "../cache.mjs";
import * as registry from "../chainstate/registry.mjs";
import log from "../logger.mjs";
import Row from "./components/row.mjs";
import * as karma from "../karma.mjs";
import { metadata } from "../parser.mjs";

const html = htm.bind(vhtml);

function CanonRow(originals) {
  return html`
    <tr>
      <td>
        <div
          style="justify-content: space-evenly; padding: 15px 0 10px 0; gap: 15px; display: flex; width: 100%;"
        >
          ${originals.map(
            ({ metadata, href, index, title }) => html`
              <div
                class="canon-image"
                style="background-color: rgba(0,0,0,0.1); border-radius: 2px; border: 1px solid #828282;"
              >
                <a href="${DOMPurify.sanitize(href)}" target="_blank">
                  <img
                    src="${DOMPurify.sanitize(metadata.image)}"
                    style="aspect-ratio: 16/9; object-fit:cover;border-bottom: 1px solid #828282; width: 100%; height: auto;"
                  />
                </a>
                <a
                  class="meta-link canon-font"
                  style="display:block; margin: 0.2rem 0.2rem 0.3rem 0.3rem;"
                  href="/stories?index=0x${index}"
                  >${DOMPurify.sanitize(title)}</a
                >
              </div>
            `,
          )}
        </div>
      </td>
    </tr>
  `;
}

const itemAge = (timestamp) => {
  const now = new Date();
  const ageInMinutes = differenceInMinutes(now, new Date(timestamp * 1000));
  return ageInMinutes;
};

export async function topstories(leaves, decayStrength) {
  return leaves
    .map((story) => {
      const commentCount =
        store.commentCounts.get(`kiwi:0x${story.index}`) || 0;
      let score;
      if (story.upvotes > 2) {
        score = Math.log(story.upvotes + commentCount);
      } else {
        score = Math.log(story.upvotes);
      }

      const outboundClicks = countOutbounds(story.href);
      if (outboundClicks > 0) {
        score = score * 0.7 + 0.3 * Math.log(outboundClicks);
      }

      const decay = Math.sqrt(itemAge(story.timestamp));
      story.score = score / Math.pow(decay, decayStrength);
      return story;
    })
    .sort((a, b) => b.score - a.score);
}

export async function index(trie, page, domain) {
  const lookBack = sub(new Date(), {
    weeks: 3,
  });
  const from = 0;
  const amount = -1;
  const lookBackUnixTime = Math.floor(lookBack.getTime() / 1000);

  const orderBy = "new";
  const countedStories = getBest(
    amount,
    from,
    orderBy,
    domain,
    lookBackUnixTime,
  );

  const totalStories = parseInt(env.TOTAL_STORIES, 10);
  const parameters = await moderation.getFeedParameters();
  let storyPromises = await topstories(
    countedStories,
    parameters.decayStrength,
  );

  let threshold = 1;
  let pill = true;
  const now = new Date();
  const old = sub(now, { hours: parameters.oldHours });
  const oldInMinutes = differenceInMinutes(now, old);
  const { fold } = parameters;
  do {
    const sample = storyPromises.filter(({ upvotes }) => upvotes > threshold);
    const sum = sample.slice(0, fold).reduce((acc, { timestamp }) => {
      const submissionTime = new Date(timestamp * 1000);
      const diff = differenceInMinutes(now, submissionTime);
      return acc + diff;
    }, 0);
    const averageAgeInMinutes = sum / fold;
    if (averageAgeInMinutes > oldInMinutes) {
      threshold--;
      pill = false;
      continue;
    } else {
      threshold++;
    }
  } while (pill);

  log(`Feed threshold for upvotes ${threshold}`);
  if (threshold <= parameters.replacementThreshold) {
    // NOTE: The replacementFactor is the number of old stories that we are
    // going to replace with super new stories (ones that haven't gained any
    // upvotes yet).
    let { replacementFactor } = parameters;
    const newStories = countedStories
      .filter(({ upvotes }) => upvotes === 1)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20)
      .map((story) => ({ ...story, userScore: karma.score(story.identity) }))
      .filter(({ timestamp }) => !isBefore(new Date(timestamp * 1000), old))
      .sort(
        (a, b) =>
          0.4 * (b.userScore - a.userScore) + 0.6 * (b.timestamp - a.timestamp),
      );
    if (replacementFactor > newStories.length) {
      log(
        `Downgrading replacementFactor of "${replacementFactor}" to new story length "${newStories.length}"`,
      );
      replacementFactor = newStories.length;
    }
    const oldStories = storyPromises
      .slice(0, 10)
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, replacementFactor)
      .reverse();
    for (let i = 0; i < oldStories.length; i++) {
      const index = storyPromises.indexOf(oldStories[i]);
      if (index !== -1) {
        storyPromises[index] = newStories[i];
      }
    }
    storyPromises.splice(10, 0, ...oldStories);
  } else {
    storyPromises = storyPromises.filter(({ upvotes }) => upvotes > threshold);
  }

  const start = totalStories * page;
  const end = totalStories * (page + 1);
  storyPromises = storyPromises.slice(start, end);

  let writers = [];
  try {
    writers = await moderation.getWriters();
  } catch (err) {
    // noop
  }

  let stories = [];
  for await (let story of storyPromises) {
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
      submitter: ensData,
      avatars: avatars,
      isOriginal,
    });
  }

  async function addMetadata(post) {
    let result;
    try {
      result = await metadata(post.href);
    } catch (err) {
      return null;
    }
    if (result && !result.image) return;

    return {
      ...post,
      metadata: result,
    };
  }
  let originals = stories
    .filter((story) => story.isOriginal)
    .slice(0, 6)
    .map(addMetadata);
  originals = (await Promise.allSettled(originals))
    .filter(({ status, value }) => status === "fulfilled" && !!value)
    .map(({ value }) => value)
    .slice(0, 2);

  return {
    stories,
    originals,
    start,
  };
}

const pages = {};

export default async function (trie, theme, page, domain) {
  const path = "/";
  const totalStories = parseInt(env.TOTAL_STORIES, 10);

  const key = `${page}-${domain}`;
  let cacheRes = pages[key];
  let content;

  let maxAgeInSeconds = 60 * 60 * 24;
  if (page === 0 && !domain) maxAgeInSeconds = 25;
  if (page > 0 && page < 5 && !domain) maxAgeInSeconds = 60 * 5;

  if (
    !cacheRes ||
    (cacheRes &&
      differenceInSeconds(new Date(), cacheRes.age) > maxAgeInSeconds)
  ) {
    content = await index(trie, page, domain);
    pages[key] = {
      content,
      age: new Date(),
    };
  } else {
    content = cacheRes.content;
  }
  const { originals, config, stories, start } = content;

  let query = `?page=${page + 1}`;
  if (domain) {
    query += `&domain=${domain}`;
  }
  const ogImage = "https://news.kiwistand.com/kiwi_hot_feed_page.png";
  const recentJoiners = await registry.recents();
  return html`
    <html lang="en" op="news">
      <head>
        ${custom(ogImage)}
        <meta
          name="description"
          content="Kiwi News is the prime feed for hacker engineers building a decentralized future. All our content is handpicked and curated by crypto veterans."
        />
      </head>
      <body>
        <div class="container">
          ${Sidebar(path)}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr class="third-header">
                ${ThirdHeader(theme, "top")}
              </tr>
              <tr>
                ${SecondHeader(theme, "top")}
              </tr>
              <tr>
                <td>
                  <div
                    style="background-color: black; height: 2.3rem;display: flex; justify-content: start; align-items: center; padding-left: 1rem; gap: 1rem; color: white;"
                  >
                    <img style="height: 30px;" src="lens.png" />
                    <a
                      style="color: white; text-decoration: underline;"
                      href="https://paragraph.xyz/@kiwi-updates/t2-lens-writing-challenge"
                    >
                      1,200 USDC writing challenge
                    </a>
                  </div>
                </td>
              </tr>
              ${originals && originals.length >= 2 && !domain
                ? html`
                    ${stories
                      .slice(0, 5)
                      .map(
                        Row(
                          start,
                          "/",
                          undefined,
                          null,
                          null,
                          null,
                          recentJoiners,
                        ),
                      )}
                    ${CanonRow(originals)}
                    ${stories
                      .slice(5)
                      .map(
                        Row(
                          start,
                          "/",
                          undefined,
                          null,
                          null,
                          null,
                          recentJoiners,
                        ),
                      )}
                  `
                : html` ${stories.map(
                    Row(start, "/", undefined, null, null, null, recentJoiners),
                  )}`}
              ${stories.length < totalStories
                ? ""
                : html`<tr style="height: 50px">
                    <td>
                      <a
                        style="padding: 20px 0 0 20px; font-size: 1.1rem;"
                        href="${query}"
                      >
                        More
                      </a>
                    </td>
                  </tr>`}
              <tr
                style="display: block; padding: 10px; background-color: #E6E6DF;"
              >
                <td>
                  <span style="color: black;"
                    >Hungry for more links? Check out the
                  </span>
                  <span> </span>
                  <a href="/best" style="color: black;"
                    ><u>Best links of the week!</u></a
                  >
                </td>
              </tr>
            </table>
          </div>
        </div>
        ${Footer(theme, path)}
      </body>
    </html>
  `;
}
