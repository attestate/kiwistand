//@format
import url from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import { formatDistanceToNow } from "date-fns";
import { utils } from "ethers";
import DOMPurify from "isomorphic-dompurify";
import { createCanvas, loadImage } from "canvas";
import { drawContributions } from "github-contributions-canvas";

import Header from "./components/header.mjs";
import { trophySVG, broadcastSVG } from "./components/secondheader.mjs";
import Footer from "./components/footer.mjs";
import Sidebar from "./components/sidebar.mjs";
import { custom } from "./components/head.mjs";
import * as store from "../store.mjs";
import * as ens from "../ens.mjs";
import * as moderation from "./moderation.mjs";
import * as karma from "../karma.mjs";
import * as preview from "../preview.mjs";
import Row from "./components/row.mjs";
import { getSubmissions, getContributionsData } from "../cache.mjs";
import { metadata } from "../parser.mjs";
import { truncate } from "../utils.mjs";
import {
  SocialButton,
  twitterSvg,
  githubSvg,
  warpcastSvg,
  heySvg,
  telegramSvg,
  discordSvg,
  websiteSvg,
} from "./components/socialNetworkIcons.mjs";

const style = "width: 1rem; position: relative; top: 0.15rem;";
const html = htm.bind(vhtml);

function extractDomain(link) {
  const parsedUrl = new url.URL(link);
  return parsedUrl.hostname;
}

// NOTE: User-defined inputs here are sanitized using the parser.mjs module
const Post = (post) => html`
  <a target="_blank" href="${post.href}">
    <div style="gap: 1rem; display: flex; width: 90%; padding: 1rem 5%;">
      <div style="flex: 2;">
        <h3 style="margin: 0 0 0.25rem 0;">${post.title}</h3>
        <div>${truncate(post.metadata.ogDescription, 100)}</div>
      </div>
      ${post.metadata.image
        ? html`<div
            style="height: 7rem; flex: 1; display: inline-flex; justify-content: center; align-items: start;"
          >
            <img
              src="${post.metadata.image}"
              alt="${post.metadata.ogTitle}"
              style="height: 100%; object-fit:cover; border-radius: 2px; border: 1px solid #828282; width: 100%;"
            />
          </div>`
        : ""}
    </div>
    <hr style="border-top: 0; margin: 0 5%; border-color: rgba(0,0,0,0.1);" />
  </a>
`;

async function generateProfile(username, avatar) {
  try {
    const body = preview.writersFrame(username, avatar);
    await preview.generate(username, body);
  } catch (err) {
    const body = preview.writersFrame(username);
    await preview.generate(username, body);
  }
}

function contributionsChart(identity) {
  const contributions = getContributionsData(identity);
  const width = 1200;
  const height = 630;

  const canvas = createCanvas(width, height);
  drawContributions(canvas, {
    skipHeader: true,
    data: contributions,
    themeName: "standard",
  });

  const buffer = canvas.toBuffer().toString("base64");
  return `data:image/png;base64,${buffer}`;
}

export default async function (
  trie,
  theme,
  identity,
  page,
  mode,
  enabledFrame,
) {
  if (!utils.isAddress(identity)) {
    return html`Not a valid address`;
  }
  const chartSrc = contributionsChart(identity);
  const ensData = await ens.resolve(identity);

  let ogImage = ensData.safeAvatar;
  if (ensData.ens && ensData.safeAvatar) {
    generateProfile(ensData.ens, ensData.safeAvatar);
    if (enabledFrame) {
      ogImage = `https://news.kiwistand.com/previews/${DOMPurify.sanitize(
        ensData.ens,
      )}.jpg`;
    }
  }

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

  const opPostsLimit = 1000000;
  const opPostsStart = 0;
  let originalPosts = getSubmissions(
    identity,
    opPostsLimit,
    opPostsStart,
    "new",
  );
  originalPosts = originalPosts.filter((post) =>
    Object.keys(writers).some(
      (domain) =>
        normalizeUrl(post.href).startsWith(domain) &&
        writers[domain] === post.identity,
    ),
  );

  async function enhance(leaf) {
    const ensData = await ens.resolve(leaf.identity);

    let avatars = [];
    for await (let upvoter of leaf.upvoters.slice(0, 5)) {
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
  }

  const stories = await Promise.all(storyPromises.map(enhance));

  async function addMetadata(post) {
    let result;
    try {
      result = await metadata(post.href);
    } catch (err) {
      return null;
    }
    return {
      ...post,
      metadata: result,
    };
  }
  const posts = (await Promise.allSettled(originalPosts.map(addMetadata)))
    .filter(({ status, value }) => status === "fulfilled" && !!value)
    .map(({ value }) => value)
    .slice(0, 3);

  const description = ensData.description
    ? ensData.description
    : ensData.farcaster
    ? ensData.farcaster.bio
    : "";
  const twitterCard = "summary";
  const points = karma.resolve(identity);
  const path = "/upvotes";
  return html`
    <html lang="en" op="news">
      <head>
        ${custom(
          ogImage,
          `${ensData.displayName} (${points.toString()} 🥝) on Kiwi News`,
          description,
          twitterCard,
        )}
      </head>
      <body ontouchstart="">
        <div class="container">
          ${Sidebar(path)}
          <div id="hnmain" class="scaled-hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                <td>
                  <div
                    style="max-width: 96vw; margin: 2vw 2vw; overflow-wrap: break-word; color: black; font-size: 16px; line-height: 1.5;"
                  >
                    <span
                      style="margin-bottom: 10px; font-weight: bold; display: flex; align-items: center; gap: 10px;"
                    >
                      ${ensData.safeAvatar &&
                      html` <a href="${ensData.safeAvatar}" target="_blank">
                        <img
                          src="${ensData.safeAvatar}"
                          style="border: 1px solid #828282; width: 30px; height: 30px; border-radius: 2px;"
                      /></a>`}
                      <a
                        target="_blank"
                        href="https://etherscan.io/address/${ensData.address}"
                      >
                        ${ensData.displayName}
                        <span> (<nav-karma data-address="${identity}" data-initial="${points.toString()}">${points.toString()}</nav-karma> 🥝)</span>
                      </a>
                    </span>
                    <span style="font-size: 0.8rem;">
                      ${description
                        ? html`${DOMPurify.sanitize(description)}<br />`
                        : html`<span><br /></span>`}
                    </span>
                    <div
                      style="flex-wrap: wrap; display: flex; gap: 7px; margin-top: 10px;"
                    >
                      ${ensData.url && ensData.url.startsWith("https://")
                        ? SocialButton(ensData.url, websiteSvg(), "Website")
                        : ""}
                      ${ensData.twitter
                        ? SocialButton(
                            `https://twitter.com/${ensData.twitter}`,
                            twitterSvg(),
                            "",
                          )
                        : ""}
                      ${ensData.github
                        ? SocialButton(
                            `https://github.com/${ensData.github}`,
                            githubSvg(),
                            "GitHub",
                          )
                        : ""}
                      ${ensData.telegram
                        ? SocialButton(
                            `https://t.me/${ensData.telegram}`,
                            telegramSvg(),
                            "Telegram",
                          )
                        : ""}
                      ${ensData.discord
                        ? SocialButton(
                            `https://discordapp.com/users/${ensData.discord}`,
                            discordSvg(),
                            "Discord",
                          )
                        : ""}
                      ${ensData.farcaster && ensData.farcaster.username
                        ? SocialButton(
                            `https://warpcast.com/${ensData.farcaster.username}`,
                            warpcastSvg(),
                            "Warpcast",
                          )
                        : ""}
                      ${ensData.lens && ensData.lens.id
                        ? SocialButton(
                            `https://hey.xyz/profile/${ensData.lens.id}`,
                            heySvg(),
                            "Lens",
                          )
                        : ""}
                      ${SocialButton(
                        `https://app.interface.social/profile/${identity}`,
                        "/interface_logo.png",
                        "Interface",
                        true,
                      )}
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td>
                  <img src="${chartSrc}" style="width: 100%;" />
                </td>
              </tr>
              ${posts.length > 0
                ? html`<tr>
                    <td>
                      <hr />
                      ${stories.length > 0
                        ? html`<b
                            style="font-size: 16px; padding: 5px 15px; color: black;"
                          >
                            <span>LATEST POSTS</span>
                          </b>`
                        : ""}
                      ${posts.map(Post)}
                    </td>
                  </tr>`
                : ""}
              ${posts.length > 0
                ? html`
                    <tr style="height: 15px;">
                      <td></td>
                    </tr>
                  `
                : ""}
              <tr>
                <td>
                  ${posts.length === 0 ? html`<hr />` : ""}
                  ${stories.length > 0
                    ? html`<b
                        style="font-size: 16px; padding: 5px 15px; color: black;"
                      >
                        <span>SUBMISSIONS </span>
                        ${page !== 0 ? html`(page: ${page})` : ""}
                      </b>`
                    : ""}
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
                        <span>${broadcastSVG(style)} New</span>
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
              ${stories.map(Row(null, "/upvotes", "margin-bottom: 20px;"))}
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
            ${Footer(theme)}
          </div>
        </div>
      </body>
    </html>
  `;
}
