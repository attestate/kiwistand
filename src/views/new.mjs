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
import { getLastComment, listNewest } from "../cache.mjs";
import Row, { extractDomain } from "./components/row.mjs";
import log from "../logger.mjs";
import { purgeCache } from "../cloudflarePurge.mjs";

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
                ${Header(theme)}
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
