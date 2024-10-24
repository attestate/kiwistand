//@format
import { env } from "process";
import { URL } from "url";

import ethers from "ethers";
import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import {
  sub,
  differenceInSeconds,
  differenceInMinutes,
  isBefore,
} from "date-fns";
import DOMPurify from "isomorphic-dompurify";

import * as ens from "../ens.mjs";
import Header from "./components/header.mjs";
import SecondHeader from "./components/secondheader.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import { custom } from "./components/head.mjs";
import * as store from "../store.mjs";
import * as id from "../id.mjs";
import * as moderation from "./moderation.mjs";
import cache, {
  countOutbounds,
  getLastComment,
  getSubmission,
  listNewest,
} from "../cache.mjs";
import * as curation from "./curation.mjs";
import * as registry from "../chainstate/registry.mjs";
import log from "../logger.mjs";
import { EIP712_MESSAGE } from "../constants.mjs";
import Row, { addOrUpdateReferrer, extractDomain } from "./components/row.mjs";
import * as karma from "../karma.mjs";
import { metadata } from "../parser.mjs";

const html = htm.bind(vhtml);

// NOTE: Only set this date in synchronicity with the src/launch.mjs date!!
const cutoffDate = new Date("2024-10-12");
const thresholdKarma = 3;
export function identityClassifier(upvoter) {
  let votes = 0;

  const cacheKey = `nouns-votes-${upvoter.identity}`;
  if (cache.has(cacheKey)) {
    votes = cache.get(cacheKey);
  } else {
    try {
      getNounsVotes(upvoter.identity)
        .then((votesNumber) => cache.set(cacheKey, votesNumber))
        .catch((err) => log(`Error in getNounsVotes: ${err.stack}`));
    } catch (err) {
      // noop
    }
  }
  const karmaScore = karma.resolve(upvoter.identity, cutoffDate);
  return {
    ...upvoter,
    isNoun: votes > 0,
    isKiwi: karmaScore > thresholdKarma,
  };
}
export function identityFilter(upvoter, submitter) {
  if (upvoter === submitter) {
    return upvoter;
  }
  upvoter = identityClassifier(upvoter);
  if (upvoter.isNoun || upvoter.isKiwi) {
    return upvoter;
  }
  throw new Error("Not eligible to upvote");
}

const provider = new ethers.providers.JsonRpcProvider(env.RPC_HTTP_HOST);
export async function getNounsVotes(address) {
  const contractAddress = "0x9c8ff314c9bc7f6e59a9d9225fb22946427edc03";
  const abi = [
    {
      inputs: [{ internalType: "address", name: "account", type: "address" }],
      name: "getCurrentVotes",
      outputs: [{ internalType: "uint96", name: "", type: "uint96" }],
      stateMutability: "view",
      type: "function",
    },
  ];

  const contract = new ethers.Contract(contractAddress, abi, provider);
  const votes = await contract.getCurrentVotes(address);

  const votesNumber = votes.toNumber();
  return votesNumber;
}

export async function getContestStories() {
  const sheetName = "contest";

  let result;
  try {
    result = await curation.getSheet(sheetName);
  } catch (err) {
    log(`Error getting contest submissions ${err.stack}`);
    return [];
  }

  const submissions = result.links
    .map((href) => getSubmission(null, href, identityFilter))
    .map((submission) => {
      submission.upvoters = submission.upvoters.map(({ identity }) => identity);
      return submission;
    })
    .sort((a, b) => b.upvotes - a.upvotes);

  return submissions;
}

async function getAd() {
  const provider = new ethers.providers.JsonRpcProvider(
    env.OPTIMISM_RPC_HTTP_HOST,
  );

  const contractAddress = "0x2e78Fad843177343Feb2f1d5cb9699A061C59c06";
  const abi = [
    { inputs: [], name: "ErrUnauthorized", type: "error" },
    { inputs: [], name: "ErrValue", type: "error" },
    {
      inputs: [],
      name: "collateral",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "controller",
      outputs: [{ internalType: "address", name: "", type: "address" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "href",
      outputs: [{ internalType: "string", name: "", type: "string" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "price",
      outputs: [
        { internalType: "uint256", name: "nextPrice", type: "uint256" },
        { internalType: "uint256", name: "taxes", type: "uint256" },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "ragequit",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        { internalType: "string", name: "_title", type: "string" },
        { internalType: "string", name: "_href", type: "string" },
      ],
      name: "set",
      outputs: [],
      stateMutability: "payable",
      type: "function",
    },
    {
      inputs: [],
      name: "timestamp",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "title",
      outputs: [{ internalType: "string", name: "", type: "string" }],
      stateMutability: "view",
      type: "function",
    },
  ];

  const contract = new ethers.Contract(contractAddress, abi, provider);
  const title = (await contract.title()).slice(0, 80);
  const href = await contract.href();
  const timestamp = await contract.timestamp();
  const identity = await contract.controller();
  const collateral = await contract.collateral();
  const [price, taxes] = await contract.price();
  const submitter = await ens.resolve(identity);

  return {
    upvotes: 0,
    upvoters: [],
    avatars: [],
    title,
    href,
    collateral,
    price,
    taxes,
    identity,
    submitter,
    displayName: submitter.displayName,
    timestamp,
  };
}

const itemAge = (timestamp) => {
  const now = new Date();
  const ageInMinutes = differenceInMinutes(now, new Date(timestamp * 1000));
  return ageInMinutes;
};

function calculateUpvoteClickRatio(story) {
  const clicks = countOutbounds(
    addOrUpdateReferrer(story.href, story.identity),
  );
  return clicks === 0 ? 0 : story.upvotes / clicks;
}

function meanUpvoteRatio(leaves) {
  const ratios = leaves.map((story) => calculateUpvoteClickRatio(story));
  const sumRatios = ratios.reduce((sum, ratio) => sum + ratio, 0);
  return ratios.length > 0 ? sumRatios / ratios.length : 0;
}

export async function topstories(leaves) {
  const upvoteRatio = meanUpvoteRatio(leaves);
  return leaves
    .map((story) => {
      const commentCount =
        store.commentCounts.get(`kiwi:0x${story.index}`) || 0;
      let score;
      if (story.upvotes > 2) {
        score = Math.log(story.upvotes * 0.4 + commentCount * 0.6);
      } else {
        score = Math.log(story.upvotes);
      }

      const outboundClicks = countOutbounds(
        addOrUpdateReferrer(story.href, story.identity),
      );
      if (outboundClicks > 0) {
        score = score * 0.9 + 0.1 * Math.log(outboundClicks);
      }

      const storyRatio = calculateUpvoteClickRatio(story);
      const upvotePerformance = storyRatio / upvoteRatio;
      score *= upvotePerformance;

      const decay = Math.sqrt(itemAge(story.timestamp));
      score = score / Math.pow(decay, 3);

      story.score = score;
      return story;
    })
    .sort((a, b) => b.score - a.score);
}

export async function index(trie, page, domain) {
  const lookback = sub(new Date(), {
    weeks: 3,
  });
  const lookbackUnixTime = Math.floor(lookback.getTime() / 1000);
  const limit = -1;
  let leaves = listNewest(limit, lookbackUnixTime);

  const policy = await moderation.getLists();
  const path = "/";
  leaves = moderation.moderate(leaves, policy, path);

  const totalStories = parseInt(env.TOTAL_STORIES, 10);
  let storyPromises = await topstories(leaves);
  const threshold = 1;
  storyPromises = storyPromises.filter(({ upvotes }) => upvotes > threshold);

  if (domain)
    storyPromises = storyPromises.filter(
      ({ href }) => extractDomain(href) === domain,
    );

  const start = totalStories * page;
  const end = totalStories * (page + 1);
  storyPromises = storyPromises.slice(start, end);

  let writers = [];
  try {
    writers = await moderation.getWriters();
  } catch (err) {
    // noop
  }

  async function addMetadata(post) {
    let result;
    try {
      result = await metadata(post.href);
    } catch (err) {
      return null;
    }
    if (result && !result.image) return;

    return {
      ...post,
      metadata: result,
    };
  }

  async function resolveIds(storyPromises) {
    const stories = [];
    for await (let story of storyPromises) {
      const ensData = await ens.resolve(story.identity);

      let avatars = [];
      for await (let upvoter of story.upvoters.slice(0, 5)) {
        const profile = await ens.resolve(upvoter);
        if (profile.safeAvatar) {
          avatars.push(profile.safeAvatar);
        }
      }

      const lastComment = getLastComment(`kiwi:0x${story.index}`);
      if (lastComment && lastComment.identity) {
        lastComment.identity = await ens.resolve(lastComment.identity);
      }

      const isOriginal = Object.keys(writers).some(
        (domain) =>
          normalizeUrl(story.href).startsWith(domain) &&
          writers[domain] === story.identity,
      );

      const augmentedStory = await addMetadata(story);
      if (augmentedStory) {
        story = augmentedStory;
      }

      stories.push({
        ...story,
        lastComment,
        displayName: ensData.displayName,
        submitter: ensData,
        avatars: avatars,
        isOriginal,
      });
    }
    return stories;
  }
  const stories = await resolveIds(storyPromises);

  let originals = stories
    .filter((story) => story.isOriginal)
    .slice(0, 6)
    .map(addMetadata);
  originals = (await Promise.allSettled(originals))
    .filter(({ status, value }) => status === "fulfilled" && !!value)
    .map(({ value }) => value)
    .slice(0, 2);

  let ad;
  const adCacheKey = "ad-cache-key";
  if (cache.get(adCacheKey)) {
    ad = cache.get(adCacheKey);
  } else {
    getAd()
      .then((result) => cache.set(adCacheKey, result))
      .catch((err) => log(`Err in getAd: ${err.stack}`));
  }

  const contestStories = await getContestStories();
  const resolvedContestStories = await resolveIds(contestStories);
  return {
    contestStories: resolvedContestStories,
    ad,
    stories,
    originals,
    start,
  };
}

const expandSVG = html`<svg
  style="height: 1rem;"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 256 256"
>
  <rect width="256" height="256" fill="none" />
  <polyline
    points="80 176 128 224 176 176"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="24"
  />
  <polyline
    points="80 80 128 32 176 80"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="24"
  />
</svg>`;

export default async function (trie, theme, page, domain) {
  const mints = await registry.mints();
  const path = "/";
  const totalStories = parseInt(env.TOTAL_STORIES, 10);

  const content = await index(trie, page, domain);
  const { ad, originals, stories, start, contestStories } = content;

  let query = `?page=${page + 1}`;
  if (domain) {
    query += `&domain=${domain}`;
  }
  const ogImage = "https://news.kiwistand.com/kiwi_hot_feed_page.png";
  const recentJoiners = await registry.recents();
  return html`
    <html lang="en" op="news">
      <head>
        ${custom(ogImage)}
        <meta
          name="description"
          content="Kiwi News is the prime feed for hacker engineers building a decentralized future. All our content is handpicked and curated by crypto veterans."
        />
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
                ${SecondHeader(theme, "top")}
              </tr>
              <tr
                style="cursor: pointer;"
                onclick="document.querySelectorAll('.inverted-row').forEach(el => el.style.display =
 el.style.display === 'none' ? '' : 'none');"
              >
                <td>
                  <div
                    style="background-color: #f1ca50; height: 2.3rem;display: flex; justify-content: start; align-items: center; padding-left: 1rem; gap: 1rem; color: white;"
                  >
                    <span
                      style="height: 2.3rem;display: flex; justify-content: center; align-items: center; gap: 1rem; color: black;"
                    >
                      <svg
                        style="height: 4rem; margin-top:0.5rem; margin-right:-1.7rem;"
                        viewBox="0 0 320 320"
                        xmlns="http://www.w3.org/2000/svg"
                        shape-rendering="crispEdges"
                      >
                        <rect width="100%" height="100%" fill="none" />
                        <rect
                          width="60"
                          height="10"
                          x="100"
                          y="110"
                          fill="#ff638d"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="60"
                          height="10"
                          x="170"
                          y="110"
                          fill="#cc0595"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="10"
                          height="10"
                          x="100"
                          y="120"
                          fill="#ff638d"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="20"
                          height="10"
                          x="110"
                          y="120"
                          fill="#ffffff"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="20"
                          height="10"
                          x="130"
                          y="120"
                          fill="#000000"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="10"
                          height="10"
                          x="150"
                          y="120"
                          fill="#ff638d"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="10"
                          height="10"
                          x="170"
                          y="120"
                          fill="#cc0595"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="20"
                          height="10"
                          x="180"
                          y="120"
                          fill="#ffffff"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="20"
                          height="10"
                          x="200"
                          y="120"
                          fill="#000000"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="10"
                          height="10"
                          x="220"
                          y="120"
                          fill="#cc0595"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="30"
                          height="10"
                          x="70"
                          y="130"
                          fill="#ab36be"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="10"
                          height="10"
                          x="100"
                          y="130"
                          fill="#ff638d"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="20"
                          height="10"
                          x="110"
                          y="130"
                          fill="#ffffff"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="20"
                          height="10"
                          x="130"
                          y="130"
                          fill="#000000"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="10"
                          height="10"
                          x="150"
                          y="130"
                          fill="#ff638d"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="10"
                          height="10"
                          x="160"
                          y="130"
                          fill="#ab36be"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="10"
                          height="10"
                          x="170"
                          y="130"
                          fill="#cc0595"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="20"
                          height="10"
                          x="180"
                          y="130"
                          fill="#ffffff"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="20"
                          height="10"
                          x="200"
                          y="130"
                          fill="#000000"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="10"
                          height="10"
                          x="220"
                          y="130"
                          fill="#cc0595"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="10"
                          height="10"
                          x="70"
                          y="140"
                          fill="#cc0595"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="10"
                          height="10"
                          x="100"
                          y="140"
                          fill="#ff638d"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="20"
                          height="10"
                          x="110"
                          y="140"
                          fill="#ffffff"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="20"
                          height="10"
                          x="130"
                          y="140"
                          fill="#000000"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="10"
                          height="10"
                          x="150"
                          y="140"
                          fill="#ff638d"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="10"
                          height="10"
                          x="170"
                          y="140"
                          fill="#cc0595"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="20"
                          height="10"
                          x="180"
                          y="140"
                          fill="#ffffff"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="20"
                          height="10"
                          x="200"
                          y="140"
                          fill="#000000"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="10"
                          height="10"
                          x="220"
                          y="140"
                          fill="#cc0595"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="10"
                          height="10"
                          x="70"
                          y="150"
                          fill="#cc0595"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="10"
                          height="10"
                          x="100"
                          y="150"
                          fill="#ff638d"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="20"
                          height="10"
                          x="110"
                          y="150"
                          fill="#ffffff"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="20"
                          height="10"
                          x="130"
                          y="150"
                          fill="#000000"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="10"
                          height="10"
                          x="150"
                          y="150"
                          fill="#ff638d"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="10"
                          height="10"
                          x="170"
                          y="150"
                          fill="#cc0595"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="20"
                          height="10"
                          x="180"
                          y="150"
                          fill="#ffffff"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="20"
                          height="10"
                          x="200"
                          y="150"
                          fill="#000000"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="10"
                          height="10"
                          x="220"
                          y="150"
                          fill="#cc0595"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="60"
                          height="10"
                          x="100"
                          y="160"
                          fill="#ff638d"
                          shape-rendering="crispEdges"
                        />
                        <rect
                          width="60"
                          height="10"
                          x="170"
                          y="160"
                          fill="#cc0595"
                          shape-rendering="crispEdges"
                        />
                      </svg>
                      ❤️ 🥝
                      <span
                        style="text-decoration: underline; display:flex;justify-content: center; align-items: center; gap:1rem;"
                      ></span>
                    </span>
                    <span
                      style="display:flex;justify-content: center; align-items: center; gap:1rem;"
                      >Show/Hide submissions ${expandSVG}</span
                    >
                  </div>
                </td>
              </tr>
              ${contestStories &&
              contestStories.map(
                Row(
                  start,
                  "/",
                  undefined,
                  null,
                  null,
                  null,
                  recentJoiners,
                  true,
                ),
              )}
              ${stories
                .slice(0, 3)
                .map(
                  Row(start, "/", undefined, null, null, null, recentJoiners),
                )}
              ${ad && Row(start, "/", "", null, null, null, recentJoiners)(ad)}
              ${stories
                .slice(3, 8)
                .map(
                  Row(start, "/", undefined, null, null, null, recentJoiners),
                )}
              ${stories
                .slice(8)
                .map(
                  Row(start, "/", undefined, null, null, null, recentJoiners),
                )}
              ${stories.length < totalStories
                ? ""
                : html`<tr style="height: 50px">
                    <td>
                      <a
                        style="padding: 20px 0 0 20px; font-size: 1.1rem;"
                        href="${query}"
                      >
                        More
                      </a>
                    </td>
                  </tr>`}
            </table>
            ${Footer(theme, path)}
          </div>
        </div>
      </body>
    </html>
  `;
}
