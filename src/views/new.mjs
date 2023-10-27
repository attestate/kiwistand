//@format
import { env } from "process";

import htm from "htm";
import vhtml from "vhtml";
import { sub } from "date-fns";
import normalizeUrl from "normalize-url";

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

export default async function (trie, theme, identity) {
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
  leaves = moderation.moderate(leaves, config);

  let counts = count(leaves);
  let sortedCounts = counts.sort((a, b) => b.timestamp - a.timestamp);
  let slicedCounts = sortedCounts.slice(0, 40);

  const writers = await moderation.getWriters();

  let stories = [];
  for await (let story of slicedCounts) {
    const ensData = await ens.resolve(story.identity);
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

  const path = "/new";
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
                ${ThirdHeader(theme, "new", identity)}
              </tr>
              <tr>
                ${SecondHeader(theme, "new")}
              </tr>
              <tr class="spacer" style="height:15px"></tr>
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
