//@format
import url from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import { formatDistanceToNow } from "date-fns";
import { utils } from "ethers";
import DOMPurify from "isomorphic-dompurify";

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
import cache from "../cache.mjs";
import { getSubmissions } from "../cache.mjs";
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
  
  // Set a timeout for ENS resolution
  const ENS_TIMEOUT_MS = 1000;
  let ensData;
  try {
    const ensPromise = ens.resolve(identity);
    ensData = await Promise.race([
      ensPromise,
      new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            displayName: identity.substring(0, 6) + '...' + identity.substring(identity.length - 4),
            safeAvatar: null,
            address: identity,
            description: ''
          });
        }, ENS_TIMEOUT_MS);
      })
    ]);
  } catch (err) {
    // Fallback if ENS resolution fails
    ensData = {
      displayName: identity.substring(0, 6) + '...' + identity.substring(identity.length - 4),
      safeAvatar: null,
      address: identity,
      description: ''
    };
  }

  let ogImage = ensData.safeAvatar;

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

  // Limit to a reasonable number of posts (100 instead of 1,000,000)
  const opPostsLimit = 100;
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
    // Cache key for this leaf's enhanced data
    const cacheKey = `enhanced-leaf-${leaf.identity}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    // Set a timeout for ENS resolution to prevent long waits
    const ENS_TIMEOUT_MS = 500;
    let ensData;
    try {
      const ensPromise = ens.resolve(leaf.identity);
      ensData = await Promise.race([
        ensPromise,
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              displayName: leaf.identity.substring(0, 6) + '...' + leaf.identity.substring(leaf.identity.length - 4),
            });
          }, ENS_TIMEOUT_MS);
        })
      ]);
    } catch (err) {
      // Fallback if ENS resolution fails
      ensData = {
        displayName: leaf.identity.substring(0, 6) + '...' + leaf.identity.substring(leaf.identity.length - 4),
      };
    }
    
    const isOriginal = Object.keys(writers).some(
      (domain) =>
        normalizeUrl(leaf.href).startsWith(domain) &&
        writers[domain] === leaf.identity,
    );
    
    const result = {
      ...leaf,
      displayName: ensData.displayName,
      avatars: [], // No longer fetching avatars
      isOriginal,
    };
    
    // Cache the enhanced data for 1 hour
    cache.set(cacheKey, result, 3600);
    
    return result;
  }

  // Process stories with a timeout
  const STORIES_TIMEOUT_MS = 1500;
  let stories = [];
  try {
    const storiesPromise = Promise.all(storyPromises.map(enhance));
    stories = await Promise.race([
      storiesPromise,
      new Promise(resolve => setTimeout(() => resolve([]), STORIES_TIMEOUT_MS))
    ]);
  } catch (err) {
    console.error("Error enhancing stories:", err);
    // Return empty array on error
    stories = [];
  }

  async function addMetadata(post) {
    // Use cache for metadata
    const cacheKey = `post-metadata-${post.href}`;
    const cachedMetadata = cache.get(cacheKey);
    
    if (cachedMetadata) {
      return {
        ...post,
        metadata: cachedMetadata
      };
    }
    
    let result;
    try {
      result = await metadata(post.href);
      // Cache the result for 24 hours
      cache.set(cacheKey, result, 24 * 3600);
    } catch (err) {
      return null;
    }
    return {
      ...post,
      metadata: result,
    };
  }
  
  // Set a timeout for posts loading to avoid blocking the page
  const POSTS_TIMEOUT_MS = 500; // Only wait 500ms max for posts
  
  // Use Promise.race to either get posts or timeout
  let posts = [];
  try {
    const postsPromise = (async () => {
      // Only process the first 3 posts
      const postsToProcess = originalPosts.slice(0, 3);
      const loadedPosts = [];
      
      // Process posts sequentially
      for (const post of postsToProcess) {
        const postWithMetadata = await addMetadata(post);
        if (postWithMetadata) {
          loadedPosts.push(postWithMetadata);
        }
        // Stop once we have 3 posts
        if (loadedPosts.length >= 3) break;
      }
      return loadedPosts;
    })();
    
    const timeoutPromise = new Promise(resolve => {
      setTimeout(() => resolve([]), POSTS_TIMEOUT_MS);
    });
    
    posts = await Promise.race([postsPromise, timeoutPromise]);
  } catch (err) {
    console.error("Error loading posts:", err);
    posts = []; // Fallback to empty posts on error
  }

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
              ${posts && posts.length > 0
                ? html`<tr>
                    <td>
                      <hr />
                      <b style="font-size: 16px; padding: 5px 15px; color: black;">
                        <span>LATEST POSTS</span>
                      </b>
                      ${posts.map(Post)}
                    </td>
                  </tr>
                  <tr style="height: 15px;">
                    <td></td>
                  </tr>`
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
