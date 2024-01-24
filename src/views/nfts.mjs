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

export default async function (trie, theme) {
  const config = await moderation.getLists();

  const threeMonthsAgo = sub(new Date(), {
    months: 3,
  });
  const from = null;
  const amount = null;
  const parser = JSON.parse;
  const threeMonthsAgoUnixTime = Math.floor(threeMonthsAgo.getTime() / 1000);
  const allowlist = await registry.allowlist();
  const delegations = await registry.delegations();
  const href = null;
  const type = "amplify";
  let leaves = await store.posts(
    trie,
    from,
    amount,
    parser,
    threeMonthsAgoUnixTime,
    allowlist,
    delegations,
    href,
    type,
  );
  leaves = moderation.moderate(leaves, config);

  let counts = count(leaves);
  let sortedCounts = counts.sort((a, b) => b.timestamp - a.timestamp);
  sortedCounts = sortedCounts.filter(
    (item) =>
      extractDomain(item.href) !== "imgur.com" &&
      extractDomain(item.href) !== "catbox.moe" &&
      item.title.startsWith("NFT:"),
  );
  let slicedCounts = sortedCounts.slice(0, 40);

  let writers = [];
  try {
    writers = await moderation.getWriters();
  } catch (err) {
    // noop
  }

  const tips = await getTips();

  let stories = [];
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
    stories.push({
      ...story,
      displayName: ensData.displayName,
      avatars: avatars,
      isOriginal,
    });
  }

  const path = "/nfts";
  const ogImage = "https://news.kiwistand.com/kiwi_nft_feed_page.png";
  return html`
    <html lang="en" op="news">
      <head>
        ${custom(ogImage)}
        <meta
          name="description"
          content="Explore the latest curated NFTS on Kiwi News. Stay updated with fresh content handpicked by crypto veterans."
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
                ${ThirdHeader(theme, "nfts")}
              </tr>
              <tr>
                ${SecondHeader(theme, "nfts")}
              </tr>
              <tr class="spacer" style="height:15px"></tr>
              <tr>
                <td>
                  <p
                    style="color: black; padding: 0 10px 0 10px; font-size: 12pt;"
                  >
                    <span
                      >Post to this feed by starting your title with "NFT:"
                    </span>
                  </p>
                </td>
              </tr>
              ${stories.map(Row())}
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
