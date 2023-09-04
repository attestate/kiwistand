//@format
import { env } from "process";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import { sub } from "date-fns";

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
import Row from "./components/row.mjs";

const html = htm.bind(vhtml);

export default async function (trie, theme) {
  const config = await moderation.getLists();

  const aWeekAgo = sub(new Date(), {
    weeks: 1,
  });
  const from = null;
  const amount = null;
  const parser = JSON.parse;
  const aWeekAgoUnixTime = Math.floor(aWeekAgo.getTime() / 1000);
  const allowlist = await registry.allowlist();
  const delegations = await registry.delegations();
  let leaves = await store.posts(
    trie,
    from,
    amount,
    parser,
    aWeekAgoUnixTime,
    allowlist,
    delegations,
  );
  leaves = moderation.moderate(leaves, config);

  let counts = count(leaves);
  let sortedCounts = counts.sort((a, b) => b.timestamp - a.timestamp);
  sortedCounts = sortedCounts.filter((item) => item.title.startsWith("NFT:"));
  let slicedCounts = sortedCounts.slice(0, 40);

  let stories = [];
  for await (let story of slicedCounts) {
    const ensData = await ens.resolve(story.identity);
    let avatars = [];
    for await (let upvoter of story.upvoters) {
      const upvoterEnsData = await ens.resolve(upvoter);
      let avatarUrl = upvoterEnsData.avatar;
      if (avatarUrl && !avatarUrl.startsWith("https")) {
        avatarUrl = upvoterEnsData.avatar_url;
      }
      if (avatarUrl) {
        avatars.push(avatarUrl);
      }
    }
    stories.push({
      ...story,
      displayName: ensData.displayName,
      avatars: avatars,
    });
  }

  const path = "/nfts";
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
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
                ${Header(theme)}
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
