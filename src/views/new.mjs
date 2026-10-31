
import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";

import * as ens from "../ens.mjs";
import Header from "./components/header.mjs";
import SecondHeader from "./components/secondheader.mjs";
import TestFlightCard from "./components/testflight-card.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import RightColumn from "./components/right-column.mjs";
import { custom } from "./components/head.mjs";
import { robotsMeta } from "../indexable.mjs";
import * as moderation from "./moderation.mjs";
import {
  getLastComment,
  listNewest,
  countImpressions,
  lifetimeCache,
  inCommunity,
} from "../cache.mjs";
import Row from "./components/row.mjs";
import log from "../logger.mjs";
import { purgeCache } from "../cloudflarePurge.mjs";
import { withCommunities } from "../communities-api.mjs";
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

const HTML_CACHE_KEY = "new-html";

export function getCachedHtml() {
  return lifetimeCache.get(HTML_CACHE_KEY);
}

// The stories of /new: the newest 25, a community's ones included. A
// community's New has as many of its own.
export const NEW_STORIES = 25;

// What /new shows of `counts` (listNewest rows), newest first: moderated,
// with the last comment, the submitter's profile, the link preview and
// impressions. A story whose preview can't be read now keeps the one in
// `previousStoriesByIndex`.
async function enrich(counts, previousStoriesByIndex = new Map()) {
  const path = "/new";
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

  return nextStories.sort((a, b) => b.timestamp - a.timestamp);
}

// A community's New (/api/v1/feeds/new?community=): its newest stories with
// the enrichment of /new. Computed on each request and kept apart from the
// cached Kiwi News /new (`stories`, the HTML cache).
export async function getCommunityStories(community) {
  return await enrich(
    listNewest(NEW_STORIES, undefined, inCommunity(community)),
  );
}

// Where a community's New ends: the oldest of the stories
// getCommunityStories shows, or undefined. /api/v1/new/rows pages on from it.
export function communityCursor(community) {
  const first = listNewest(NEW_STORIES, undefined, inCommunity(community));
  return first.length > 0 ? first[first.length - 1].timestamp : undefined;
}

let inProgress = false;
// NOTE: A submission that arrives while a recompute is running must not be
// dropped, so we run once more afterwards.
let rerun = false;
export async function recompute() {
  if (inProgress) {
    rerun = true;
    return;
  }
  inProgress = true;

  try {
    const counts = listNewest(NEW_STORIES);
    const previousStoriesByIndex = new Map(
      stories.map((story) => [story.index, story]),
    );

    stories = await enrich(counts, previousStoriesByIndex);

    // Pre-render and cache the HTML (same pattern as /best)
    try {
      const rendered = await renderPage(null);
      lifetimeCache.set(HTML_CACHE_KEY, rendered);
    } catch (err) {
      log(`/new HTML cache render failed: ${err.message}`);
    }

    purgeCache("https://news.kiwistand.com/new?cached=true").catch((err) =>
      log(`Error refreshing /new?cached=true`),
    );
  } catch (err) {
    log(`recompute error: ${err.stack || err}`);
    throw err;
  } finally {
    inProgress = false;
    if (rerun) {
      rerun = false;
      recompute().catch((err) => log(`recompute rerun error: ${err}`));
    }
  }
}

async function renderPage(theme) {
  // NOTE: Community stories show their community's tag (row.mjs).
  let items = stories;
  try {
    items = await withCommunities(stories);
  } catch (err) {
    log(`/new: Couldn't tag the communities: ${err.message}`);
  }
  const path = "/new";
  const ogImage = "https://news.kiwistand.com/kiwi_new_feed_page.png?v=2";
  const prefetch = ["/", "/submit", "/best"];
  const query = "?cached=true";
  return "<!DOCTYPE html>" + html`
    <html lang="en" op="news">
      <head>
        ${custom(ogImage, "New | Kiwi News - latest crypto submissions", "Freshly submitted crypto links and web3 stories, updated in real time.", undefined, prefetch, "https://news.kiwistand.com/new?cached=true", null, null, { rss: true })}
        ${robotsMeta({ indexable: true })}
      </head>
      <body
        data-instant-allow-query-string
        data-instant-allow-external-links
        ontouchstart=""
      >
        <div class="container">
          ${Sidebar(path)}
          ${RightColumn({ communities: true })}
          <main id="hnmain" class="scaled-hnmain" role="main">
            <h1 class="visually-hidden">New crypto stories on Kiwi News</h1>
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="var(--background-color0)">
              <tr>
                ${Header(theme, "/new")}
              </tr>
              <tr>
                ${SecondHeader(theme, "new")}
              </tr>
              ${TestFlightCard()}
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
                    // NOTE: On a phone the first picture is the largest paint; rows
                    // without one are short, so it can be the third row's.
                    i < 3, // isAboveFold
                  )(item, i),
              )}
              <tr>
                <td style="text-align: center; padding: 20px 0;">
                  <div id="feed-sentinel"></div>
                </td>
              </tr>
            </table>
            ${Footer(theme, "/new")}
          </main>
        </div>
      </body>
    </html>
  `;
}

export default renderPage;
