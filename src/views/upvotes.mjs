//@format
import url from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import { formatDistanceToNow } from "date-fns";
import { utils } from "ethers";

import PWALine from "./components/iospwaline.mjs";
import { getTips, getTipsValue } from "../tips.mjs";
import Header from "./components/header.mjs";
import { trophySVG, broadcastSVG } from "./components/secondheader.mjs";
import Footer from "./components/footer.mjs";
import Sidebar from "./components/sidebar.mjs";
import { custom } from "./components/head.mjs";
import * as store from "../store.mjs";
import * as ens from "../ens.mjs";
import * as moderation from "./moderation.mjs";
import * as karma from "../karma.mjs";
import Row from "./components/row.mjs";
import { getSubmissions } from "../cache.mjs";
import {
  twitterSvg,
  githubSvg,
  warpcastSvg,
  telegramSvg,
  discordSvg,
  websiteSvg,
} from "./components/socialNetworkIcons.mjs";

const html = htm.bind(vhtml);

function extractDomain(link) {
  const parsedUrl = new url.URL(link);
  return parsedUrl.hostname;
}

export default async function (trie, theme, identity, page, mode) {
  if (!utils.isAddress(identity)) {
    return html`Not a valid address`;
  }
  const ensData = await ens.resolve(identity);

  const totalStories = 10;
  const start = totalStories * page;

  let storyPromises;
  if (mode === "top") {
    storyPromises = getSubmissions(identity, totalStories, start, mode);
  } else if (mode === "new") {
    storyPromises = getSubmissions(identity, totalStories, start, mode);
  }

  let writers = [];
  try {
    writers = await moderation.getWriters();
  } catch (err) {
    // noop
  }

  const tips = await getTips();

  const stories = await Promise.all(
    storyPromises.map(async (leaf) => {
      const ensData = await ens.resolve(leaf.identity);

      const tipValue = getTipsValue(tips, leaf.index);
      leaf.tipValue = tipValue;

      let avatars = [];
      for await (let upvoter of leaf.upvoters) {
        const profile = await ens.resolve(upvoter);
        if (profile.safeAvatar) {
          avatars.push(profile.safeAvatar);
        }
      }
      const isOriginal = Object.keys(writers).some(
        (domain) =>
          normalizeUrl(leaf.href).startsWith(domain) &&
          writers[domain] === leaf.identity,
      );
      return {
        ...leaf,
        displayName: ensData.displayName,
        avatars: avatars,
        isOriginal,
      };
    }),
  );

  const description = ensData.description
    ? ensData.description
    : ensData.farcaster
    ? ensData.farcaster.bio
    : "";
  const twitterCard = "summary";
  const points = karma.resolve(identity);
  return html`
    <html lang="en" op="news">
      <head>
        ${custom(
          ensData.safeAvatar,
          `${ensData.displayName} (${points.toString()} 🥝) on Kiwi News`,
          description,
          twitterCard,
        )}
      </head>
      <body>
        ${PWALine}
        <div class="container">
          ${Sidebar()}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                <td>
                  <div
                    style="padding: 10px 10px 0 10px; color: black; font-size: 16px; line-height: 1.5;"
                  >
                    <a
                      style="font-weight: bold; display: flex; align-items: center; gap: 10px;"
                      target="_blank"
                      href="https://etherscan.io/address/${ensData.address}"
                    >
                      ${ensData.safeAvatar &&
                      html`<img
                        src="${ensData.safeAvatar}"
                        style="border: 1px solid #828282; width: 30px; height: 30px; border-radius: 2px;"
                      />`}
                      ${ensData.displayName}
                      <span> (${points.toString()} 🥝)</span>
                    </a>
                    <span style="font-size: 0.8rem;">
                      ${description
                        ? html`<br />${description}<br />`
                        : html`<span><br /></span>`}
                    </span>
                    <div style="display: flex; gap: 15px; margin-top: 10px;">
                      ${ensData.url && ensData.url.startsWith("https://")
                        ? html` <a target="_blank" href="${ensData.url}"
                            >${websiteSvg()}</a
                          >`
                        : ""}
                      ${ensData.twitter
                        ? html` <a
                            href="https://twitter.com/${ensData.twitter}"
                            target="_blank"
                            rel="noopener noreferrer"
                            >${twitterSvg()}</a
                          >`
                        : ""}
                      ${ensData.github
                        ? html` <a
                            href="https://github.com/${ensData.github}"
                            target="_blank"
                            rel="noopener noreferrer"
                            >${githubSvg()}</a
                          >`
                        : ""}
                      ${ensData.telegram
                        ? html` <a
                            href="https://t.me/${ensData.telegram}"
                            target="_blank"
                            rel="noopener noreferrer"
                            >${telegramSvg()}</a
                          >`
                        : ""}
                      ${ensData.discord
                        ? html` <a
                            href="https://discordapp.com/users/${ensData.discord}"
                            target="_blank"
                            rel="noopener noreferrer"
                            >${discordSvg()}</a
                          >`
                        : ""}
                      ${ensData.farcaster && ensData.farcaster.username
                        ? html` <a
                            href="https://warpcast.com/${ensData.farcaster
                              .username}"
                            target="_blank"
                            rel="noopener noreferrer"
                            >${warpcastSvg()}</a
                          >`
                        : ""}
                    </div>
                    <hr />
                    ${stories.length > 0
                      ? html`<b>
                          <span>SUBMISSIONS </span>
                          ${page !== 0 ? html`(page: ${page})` : ""}
                        </b>`
                      : ""}
                  </div>
                </td>
              </tr>
              <tr>
                <td>
                  <div
                    style="min-height: 40px; display: flex; align-items: center; padding: 10px 15px 10px 15px; color: white;"
                  >
                    <a href="?mode=top&address=${ensData.address}&page=0">
                      <button
                        class="feed-button"
                        style=${`margin-right: 10px; font-size: 1.01rem; border-radius: 2px; cursor: pointer; padding: 5px 15px; background-color: transparent; border: ${
                          mode === "top"
                            ? "2px solid black"
                            : "1px solid #7f8c8d"
                        }; color: ${mode === "top" ? "black" : "#7f8c8d"};`}
                      >
                        <span>${trophySVG} Top</span>
                      </button>
                    </a>
                    <a href="?mode=new&address=${ensData.address}&page=0">
                      <button
                        class="feed-button"
                        style=${`font-size: 1.01rem; border-radius: 2px; cursor: pointer; padding: 5px 15px; background-color: transparent; border: ${
                          mode === "new"
                            ? "2px solid black"
                            : "1px solid #7f8c8d"
                        }; color: ${mode === "new" ? "black" : "#7f8c8d"};`}
                      >
                        <span>${broadcastSVG} New</span>
                      </button>
                    </a>
                  </div>
                </td>
              </tr>
              ${stories.length === 0
                ? html` <tr>
                    <td>No activity yet...</td>
                  </tr>`
                : ""}
              ${stories.map(Row(null, "/best"))}
              ${stories.length === totalStories
                ? html`
                    <tr style="height: 50px">
                      <td>
                        <a
                          style="padding: 20px 0 0 20px; font-size: 1.1rem;"
                          href="?mode=${mode}&address=${ensData.address}&page=${page +
                          1}"
                        >
                          More
                        </a>
                      </td>
                    </tr>
                  `
                : ""}
            </table>
          </div>
        </div>
        ${Footer(theme)}
      </body>
    </html>
  `;
}
