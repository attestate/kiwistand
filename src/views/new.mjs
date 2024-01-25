//@format
import { env } from "process";

import htm from "htm";
import vhtml from "vhtml";
import { sub } from "date-fns";
import normalizeUrl from "normalize-url";

import { getTips, getTipsValue } from "../tips.mjs";
import * as ens from "../ens.mjs";
import Header from "./components/header.mjs";
import SecondHeader from "./components/secondheader.mjs";
import ThirdHeader from "./components/thirdheader.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import { custom } from "./components/head.mjs";
import * as store from "../store.mjs";
import * as moderation from "./moderation.mjs";
import * as registry from "../chainstate/registry.mjs";
import { count } from "./feed.mjs";
import Row, { extractDomain } from "./components/row.mjs";

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
export async function recompute(trie) {
  if (inProgress) return;
  inProgress = true;

  const config = await moderation.getLists();
  const from = null;
  const amount = null;
  const parser = JSON.parse;
  const allowlist = await registry.allowlist();
  const delegations = await registry.delegations();
  const startDateTime = null;
  const href = null;
  const type = "amplify";

  let leaves = await store.posts(
    trie,
    from,
    amount,
    parser,
    startDateTime,
    allowlist,
    delegations,
    href,
    type,
  );
  leaves = leaves.filter(
    ({ href }) =>
      extractDomain(href) !== "imgur.com" &&
      extractDomain(href) !== "catbox.moe",
  );
  leaves = moderation.moderate(leaves, config);

  let counts = count(leaves);
  let sortedCounts = counts.sort((a, b) => b.timestamp - a.timestamp);
  let slicedCounts = sortedCounts.slice(0, 40);

  let writers = [];
  try {
    writers = await moderation.getWriters();
  } catch (err) {
    // noop
  }

  const tips = await getTips();

  let nextStories = [];
  for await (let story of slicedCounts) {
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
    nextStories.push({
      ...story,
      displayName: ensData.displayName,
      avatars: avatars,
      isOriginal,
    });
  }
  stories = nextStories;
  inProgress = false;
}

async function getPost(trie, index) {
  const hexRegex = /^0x[a-fA-F0-9]{72}$/;

  if (!hexRegex.test(index)) {
    throw new Error("getPost: index fails regex test");
  }

  const hexIndex = index.substring(2);
  const parser = JSON.parse;
  const allowlist = await registry.allowlist();
  const delegations = await registry.delegations();

  // NOTE: This call will throw and has to be caught
  const post = await store.post(
    trie,
    Buffer.from(hexIndex, "hex"),
    parser,
    allowlist,
    delegations,
  );

  const ensData = await ens.resolve(post.value.identity);
  return {
    ...post.value,
    displayName: ensData.displayName,
    submitter: ensData,
    avatars: [],
  };
}

export default async function (trie, theme, index) {
  let items = stories;
  try {
    const post = await getPost(trie, index);
    items = [{ ...post, index: index.substring(2) }, ...items];
  } catch (err) {
    // NOTE: If we cannot find the post, we just pretend like nothing happened.
  }

  const path = "/new";
  const ogImage = "https://news.kiwistand.com/kiwi_new_feed_page.png";
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
          ${Sidebar(path)}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                ${ThirdHeader(theme, "new")}
              </tr>
              <tr>
                ${SecondHeader(theme, "new")}
              </tr>
              <tr class="spacer" style="height:15px"></tr>
              ${items.map(Row(null, "/best"))}
              <tr class="spacer" style="height:15px"></tr>
              <tr
                style="display: block; padding: 10px; background-color: ${theme.color}"
              >
                <td></td>
              </tr>
            </table>
          </div>
        </div>
        ${Footer(theme, "/new")}
      </body>
    </html>
  `;
}
