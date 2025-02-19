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
import * as registry from "../chainstate/registry.mjs";
import { getLastComment, listNewest } from "../cache.mjs";
import Row, { extractDomain } from "./components/row.mjs";
import log from "../logger.mjs";
import { purgeCache } from "../cloudflarePurge.mjs";
import * as feeds from "../feeds.mjs";

const html = htm.bind(vhtml);

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

  const limit = 50;
  let counts = listNewest(limit);

  const path = "/new";
  const config = await moderation.getLists();
  counts = moderation.moderate(counts, config, path);
  let sortedCounts = counts.sort((a, b) => b.timestamp - a.timestamp);

  let writers = [];
  try {
    writers = await moderation.getWriters();
  } catch (err) {
    // noop
  }

  let nextStories = [];
  for await (let story of sortedCounts) {
    if (!story.identity || !story.index || !story.upvoters) {
      nextStories.push({
        ...story,
        displayName: "Feedbot",
        avatars: [],
        upvoters: [],
        isOriginal: false,
      });
      continue;
    }

    const lastComment = getLastComment(`kiwi:0x${story.index}`);
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
          (result) => result.status === "fulfilled" && result.value.safeAvatar,
        )
        .map((result) => ({
          identity: result.value.identity,
          safeAvatar: result.value.safeAvatar,
          displayName: result.value.displayName,
        }));
    }

    const ensData = await ens.resolve(story.identity);

    let avatars = [];
    for await (let upvoter of story.upvoters.slice(0, 5)) {
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
    nextStories.push({
      ...story,
      lastComment,
      displayName: ensData.displayName,
      avatars: avatars,
      isOriginal,
    });
  }
  stories = nextStories;
  inProgress = false;
  try {
    // Purge Cloudflare cache for the "/new" page so that new submissions show immediately.
    await purgeCache("https://news.kiwistand.com/new");
    await purgeCache("https://news.kiwistand.com/new?cached=true");
    log("Cloudflare cache purged for /new and /new?cached=true");
  } catch (error) {
    log("Cloudflare cache purge skipped: " + error.message);
  }
}

export default async function (trie, theme) {
  const mints = await registry.mints();

  let items = stories;
  const path = "/new";
  const ogImage = "https://news.kiwistand.com/kiwi_new_feed_page.png";
  const prefetch = ["/", "/submit", "/best", "/community"];
  const recentJoiners = await registry.recents();
  const query = "?cached=true";
  return html`
    <html lang="en" op="news">
      <head>
        ${custom(ogImage, undefined, undefined, undefined, prefetch)}
        <meta
          name="description"
          content="Explore the latest news in the decentralized world on Kiwi News. Stay updated with fresh content handpicked by crypto veterans."
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
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                ${SecondHeader(theme, "new")}
              </tr>
              ${items.map(
                Row(
                  null,
                  "/new",
                  "margin-bottom: 20px;",
                  null,
                  null,
                  null,
                  recentJoiners,
                  false,
                  query,
                ),
              )}
            </table>
            ${Footer(theme, "/new")}
          </div>
        </div>
      </body>
    </html>
  `;
}
