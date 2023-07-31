//@format
import { env } from "process";
import url from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import { formatDistanceToNowStrict, sub } from "date-fns";

import * as ens from "../ens.mjs";
import Header from "./components/header.mjs";
import SecondHeader from "./components/secondheader.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";
import * as store from "../store.mjs";
import * as moderation from "./moderation.mjs";
import * as registry from "../chainstate/registry.mjs";
import { count } from "./feed.mjs";
import FCIcon from "./components/farcastericon.mjs";

const html = htm.bind(vhtml);

function extractDomain(link) {
  const parsedUrl = new url.URL(link);
  return parsedUrl.hostname;
}

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
    delegations
  );
  leaves = moderation.moderate(leaves, config);

  let counts = count(leaves);
  let sortedCounts = counts.sort((a, b) => b.timestamp - a.timestamp);
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
  const size = 12;

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
        ${Sidebar}
        <center>
          <table
            id="hnmain"
            border="0"
            cellpadding="0"
            cellspacing="0"
            width="85%"
            bgcolor="#f6f6ef"
          >
            <tr>
              ${Header(theme)}
            </tr>
            <tr>
              ${SecondHeader(theme, "new")}
            </tr>
            <tr class="spacer" style="height:15px"></tr>
            ${stories.map(
              (story, i) => html`
                <tr>
                  <td>
                    <div style="padding: 10px 5px 0 10px;">
                      <div style="display: flex; align-items: flex-start;">
                        <div
                          style="display: flex; align-items: center; justify-content: center; min-width: 40px; margin-right: 6px;"
                        >
                          <a href="#">
                            <div
                              class="votearrowcontainer"
                              data-title="${story.title}"
                              data-href="${story.href}"
                              data-upvoters="${JSON.stringify(story.upvoters)}"
                            ></div>
                          </a>
                        </div>
                        <div style="flex-grow: 1;">
                          <span>
                            <span style="line-height: 13pt; font-size: 13pt;">
                              ${i + 1}.
                            </span>
                            <span> </span>
                            <a
                              href="${story.href}"
                              target="_blank"
                              class="story-link"
                              style="line-height: 13pt; font-size: 13pt;"
                            >
                              ${story.title}
                            </a>
                            <span
                              style="padding-left: 5px; word-break: break-all;"
                              >(${extractDomain(story.href)})</span
                            >
                          </span>
                          <div style="margin-top: 2px; font-size: 10pt;">
                            <span>
                              <span>▲</span>
                              ${story.upvotes}
                              <span> </span>
                              ${story.avatars.length > 1 &&
                              html`<div
                                style="margin-left: ${size /
                                2}; top: 2px; display: inline-block; position:relative;"
                              >
                                ${story.avatars.slice(0, 5).map(
                                  (avatar, index) => html`
                                    <img
                                      src="${avatar}"
                                      alt="avatar"
                                      style="z-index: ${index}; width: ${size}px; height:
 ${size}px; border: 1px solid #828282; border-radius: 50%; margin-left: -${size /
                                      2}px;"
                                    />
                                  `
                                )}
                              </div>`}
                              <span> • </span>
                              ${formatDistanceToNowStrict(
                                new Date(story.timestamp * 1000)
                              )}
                              <span> ago by </span>
                              <a
                                href="/upvotes?address=${story.identity}"
                                class="meta-link"
                              >
                                ${story.displayName}
                              </a>
                              <span> • </span>
                              <a
                                target="_blank"
                                href="https://warpcast.com/~/compose?embeds[]=${story.href}&text=${encodeURIComponent(
                                  `Found on Kiwi News: "${story.title}"`
                                )}&embeds[]=https://news.kiwistand.com"
                                class="caster-link"
                              >
                                ${FCIcon("height: 10px; width: 10px;")}
                                <span> </span>
                                Cast
                              </a>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              `
            )}
          </table>
          ${Footer(theme, "/new")}
        </center>
      </body>
    </html>
  `;
}
