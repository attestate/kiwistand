//@format
import { env } from "process";
import path from "path";

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
import Head from "./components/head.mjs";
import * as store from "../store.mjs";
import * as moderation from "./moderation.mjs";
import * as registry from "../chainstate/registry.mjs";
import { count } from "./feed.mjs";
import Row, { extractDomain } from "./components/row.mjs";
import * as ogParser from "../parser.mjs";
import log from "../logger.mjs";

const html = htm.bind(vhtml);

let stories = [];
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

  let leaves = await store.posts(
    trie,
    from,
    amount,
    parser,
    startDateTime,
    allowlist,
    delegations,
  );
  leaves = leaves.filter(
    ({ href }) =>
      extractDomain(href) === "imgur.com" ||
      extractDomain(href) === "catbox.moe",
  );
  leaves = moderation.moderate(leaves, config);

  let counts = count(leaves);
  let sortedCounts = counts.sort(
    (a, b) => b.lastInteraction - a.lastInteraction,
  );
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

    const extension = path.extname(story.href);
    if (extension === ".png" || extension === ".jpg") {
      story.image = story.href;
    } else {
      try {
        const metadata = await ogParser.metadata(story.href);
        story.image = metadata.image;
      } catch (err) {
        log(`Failed to parse "${story.href}"`);
      }
    }

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

export default async function (trie, theme, identity) {
  const name = "images";
  const path = `/${name}`;
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
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
                ${await Header(theme, identity)}
              </tr>
              <tr>
                ${ThirdHeader(theme, name)}
              </tr>
              <tr
                class="spacer"
                style="display:block; height:10px; background-color: #e6e6df;"
              ></tr>
              ${stories.map(Row(null, path))}
              <tr
                style="display: block; padding: 10px; background-color: ${theme.color}"
              >
                <td></td>
              </tr>
            </table>
          </div>
        </div>
        ${Footer(theme, path)}
      </body>
    </html>
  `;
}
