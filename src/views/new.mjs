//@format
import { env } from "process";

import htm from "htm";
import vhtml from "vhtml";
import { sub } from "date-fns";
import normalizeUrl from "normalize-url";

import * as ens from "../ens.mjs";
import Header from "./components/header.mjs";
import SecondHeader from "./components/secondheader.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Trollbox from "./components/trollbox.mjs";
import { custom } from "./components/head.mjs";
import * as store from "../store.mjs";
import * as moderation from "./moderation.mjs";
import { getLastComment, listNewest, countImpressions } from "../cache.mjs";
import Row, { extractDomain } from "./components/row.mjs";
import log from "../logger.mjs";
import { purgeCache } from "../cloudflarePurge.mjs";
import { cachedMetadata, metadata } from "../parser.mjs";

const html = htm.bind(vhtml);

async function addMetadata(post) {
  let data = await cachedMetadata(post.href);

  if (!data || Object.keys(data).length === 0) {
    try {
      data = await metadata(post.href);
    } catch (err) {
      data = {};
    }
  }

  return {
    ...post,
    metadata: data,
  };
}

function hasUsableMetadata(metadata) {
  return (
    metadata &&
    typeof metadata === "object" &&
    !metadata.failed &&
    Object.keys(metadata).length > 0
  );
}

let stories = [];
export function getStories() {
  return stories;
}

export function getLatestTimestamp() {
  if (stories.length === 0) {
    throw new Error("No stories available");
  }
  return stories[0].timestamp;
}

let inProgress = false;
export async function recompute() {
  if (inProgress) return;
  inProgress = true;

  try {
    const limit = 25;
    let counts = listNewest(limit);
    const path = "/new";
    const previousStoriesByIndex = new Map(
      stories.map((story) => [story.index, story]),
    );

  const [listsResult, writersResult] = await Promise.allSettled([
    moderation.getLists(),
    moderation.getWriters(),
  ]);

  const config = listsResult.status === "fulfilled" ? listsResult.value : {};
  let writers = writersResult.status === "fulfilled" ? writersResult.value : [];

  counts = moderation.moderate(counts, config, path);

  let nextStories = [];
  await Promise.allSettled(
    counts.map(async (story) => {
      if (!story.identity || !story.index || !story.upvoters) {
        nextStories.push({
          ...story,
          displayName: "Feedbot",
          upvoters: [],
          isOriginal: false,
        });
        return;
      }

      const lastComment = getLastComment(`kiwi:0x${story.index}`, config.addresses || []);
      if (lastComment && lastComment.identity) {
        lastComment.identity = await ens.resolveForBatch(lastComment.identity);
        const uniqueIdentities = new Set(
          lastComment.previousParticipants
            .map((p) => p.identity)
            .filter((identity) => identity !== lastComment.identity),
        );

        const resolvedParticipants = await Promise.allSettled(
          [...uniqueIdentities].map((identity) => ens.resolveForBatch(identity)),
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

      const ensData = await ens.resolveForBatch(story.identity);

      // Skip normalization for text posts and kiwi references
      const normalizedStoryHref = (story.href.startsWith('data:') || story.href.startsWith('kiwi:'))
        ? story.href
        : normalizeUrl(story.href);

      const isOriginal = Object.keys(writers).some(
        (domain) =>
          normalizedStoryHref.startsWith(domain) &&
          writers[domain] === story.identity,
      );

      const augmentedStory = await addMetadata(story);
      let finalStory = augmentedStory || story;
      const previousStory = previousStoriesByIndex.get(story.index);
      if (
        !hasUsableMetadata(finalStory.metadata) &&
        hasUsableMetadata(previousStory?.metadata)
      ) {
        finalStory = {
          ...finalStory,
          metadata: previousStory.metadata,
        };
      }

      // Skip normalization for text posts and kiwi references
      const href = (finalStory.href.startsWith('data:') || finalStory.href.startsWith('kiwi:'))
        ? finalStory.href
        : normalizeUrl(finalStory.href, { stripWWW: false });
      if (href && config?.images?.includes(href) && finalStory.metadata?.image) {
        delete finalStory.metadata.image;
      }
      
      const impressions = countImpressions(finalStory.href);

      nextStories.push({
        ...finalStory,
        impressions,
        lastComment,
        displayName: ensData.displayName,
        submitter: ensData,
        isOriginal,
      });
    }),
  );

    stories = nextStories.sort((a, b) => b.timestamp - a.timestamp);
    purgeCache("https://news.kiwistand.com/new?cached=true").catch((err) =>
      log(`Error refreshing /new?cached=true`),
    );
  } catch (err) {
    log(`recompute error: ${err.stack || err}`);
    throw err;
  } finally {
    inProgress = false;
  }
}

export default async function (trie, theme) {
  let items = stories;
  const path = "/new";
  const ogImage = "https://news.kiwistand.com/kiwi_new_feed_page.png";
  const prefetch = ["/", "/submit", "/best"];
  const query = "?cached=true";
  return html`
    <html lang="en" op="news">
      <head>
        ${custom(ogImage, "New | Kiwi News - latest crypto submissions", "Freshly submitted crypto links and web3 stories, updated in real time.", undefined, prefetch, "https://news.kiwistand.com/new?cached=true")}
      </head>
      <body
        data-instant-allow-query-string
        data-instant-allow-external-links
        ontouchstart=""
      >
        <div class="container">
          ${Sidebar(path)}
          ${Trollbox()}
          <div id="hnmain" class="scaled-hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="var(--background-color0)">
              <tr>
                ${Header(theme)}
              </tr>
              <tr>
                ${SecondHeader(theme, "new")}
              </tr>
              ${items.map(
                (item, i) =>
                  Row(
                    null,
                    "/new",
                    "margin-bottom: 20px;",
                    null,
                    null,
                    null,
                    false,
                    query,
                    false, // debugMode
                    false, // isAboveFold = false for lazy loading
                  )(item, i),
              )}
              <tr>
                <td style="text-align: center; padding: 20px 0;">
                  <div id="feed-sentinel"></div>
                </td>
              </tr>
            </table>
            ${Footer(theme, "/new")}
          </div>
        </div>
      </body>
    </html>
  `;
}
