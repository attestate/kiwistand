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
import { custom } from "./components/head.mjs";
import * as store from "../store.mjs";
import * as moderation from "./moderation.mjs";
import { getLastComment, listNewest, countImpressions } from "../cache.mjs";
import Row, { extractDomain } from "./components/row.mjs";
import log from "../logger.mjs";
import { purgeCache } from "../cloudflarePurge.mjs";
import { cachedMetadata } from "../parser.mjs";

const html = htm.bind(vhtml);

async function addMetadata(post) {
  const data = cachedMetadata(post.href);
  return {
    ...post,
    metadata: data,
  };
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

  const limit = 25;
  let counts = listNewest(limit);
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
          avatars: [],
          upvoters: [],
          isOriginal: false,
        });
        return;
      }

      const lastComment = getLastComment(`kiwi:0x${story.index}`, config.addresses || []);
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

      const ensData = await ens.resolve(story.identity);

      let avatars = [];
      let upvoterProfiles = [];
      await Promise.allSettled(
        story.upvoters.map(async (upvoter) => {
          const profile = await ens.resolve(upvoter);
          if (profile.safeAvatar) {
            upvoterProfiles.push({
              avatar: profile.safeAvatar,
              address: upvoter,
              neynarScore: profile.neynarScore || 0
            });
          }
        }),
      );
      // Sort by neynarScore descending and take top 5
      upvoterProfiles.sort((a, b) => b.neynarScore - a.neynarScore);
      avatars = upvoterProfiles.slice(0, 5).map(p => p.avatar);

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
        avatars: avatars,
        isOriginal,
      });
    }),
  );

  stories = nextStories.sort((a, b) => b.timestamp - a.timestamp);
  inProgress = false;
  purgeCache("https://news.kiwistand.com/new?cached=true").catch((err) =>
    log(`Error refreshing /new?cached=true`),
  );
}

export default async function (trie, theme) {
  let items = stories;
  const path = "/new";
  const ogImage = "https://news.kiwistand.com/kiwi_new_feed_page.png";
  const prefetch = ["/", "/submit", "/best", "/community"];
  const query = "?cached=true";
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
          ${Sidebar(path)}
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
            </table>
            ${Footer(theme, "/new")}
          </div>
        </div>
      </body>
    </html>
  `;
}
