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

import poaps from "./gnosis-poap-addresses.mjs";
const gnosisPoaps = poaps.map((p) => ethers.utils.getAddress(p));

const html = htm.bind(vhtml);

// NOTE: Only set this date in synchronicity with the src/launch.mjs date!!
const cutoffDate = new Date("2024-11-06");
const thresholdKarma = 3;
export function identityClassifier(upvoter) {
  let balance = 0;

  const cacheKey = `gnosis-pay-nft-${upvoter.identity}`;
  if (cache.has(cacheKey)) {
    balance = cache.get(cacheKey);
  } else {
    try {
      getGnosisPayNFT(upvoter.identity)
        .then((balance) => cache.set(cacheKey, balance))
        .catch((err) => log(`Error in getGnosisPayNFT: ${err.stack}`));
    } catch (err) {
      // noop
    }
  }
  const hasGnosisPoap = gnosisPoaps.includes(
    ethers.utils.getAddress(upvoter.identity),
  );
  const karmaScore = karma.resolve(upvoter.identity, cutoffDate);
  const hasGnosisPayNFT = balance > 0;
  return {
    ...upvoter,
    fromSponsorCommunity: hasGnosisPoap || hasGnosisPayNFT,
    isKiwi: karmaScore >= thresholdKarma,
  };
}
export function identityFilter(upvoter, submitter) {
  if (upvoter === submitter) {
    return upvoter;
  }
  try {
    upvoter = identityClassifier(upvoter);
  } catch (err) {
    log(`Error in identity classifier ${err.stack}`);
    throw err;
  }
  if (upvoter.fromSponsorCommunity || upvoter.isKiwi) {
    return upvoter;
  }
  throw new Error("Not eligible to upvote");
}

const provider = new ethers.providers.JsonRpcProvider(env.GNOSIS_RPC_HTTP_HOST);
export async function getGnosisPayNFT(address) {
  const contractAddress = "0x88997988a6a5aaf29ba973d298d276fe75fb69ab";
  const abi = [
    {
      inputs: [{ internalType: "address", name: "owner", type: "address" }],
      name: "balanceOf",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    },
  ];

  const contract = new ethers.Contract(contractAddress, abi, provider);

  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Timeout")), 5000);
  });

  let balance;
  try {
    balance = await Promise.race([contract.balanceOf(address), timeout]);
  } finally {
    clearTimeout(timeoutId);
  }

  const balanceNumber = balance.toNumber();
  return balanceNumber;
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

  const submissions = [];
  const CUTOFF = new Date("2025-12-12T23:59:59+01:00").getTime();
  for (const href of result.links) {
    try {
      const sub = await getSubmission(null, href, identityFilter);
      sub.upvoters = sub.upvoters
        .filter((vote) => vote.timestamp <= CUTOFF)
        .map(({ identity }) => identity);
      submissions.push(sub);
    } catch (err) {
      log(`Skipping submission ${href}, err ${err.stack}`);
    }
  }
  submissions.sort((a, b) => b.upvotes - a.upvotes);

  return submissions;
}

async function getAd() {
  const provider = new ethers.providers.JsonRpcProvider(
    env.OPTIMISM_RPC_HTTP_HOST,
  );

  const contractAddress = "0xFfcC6b6c5C066B23992758A4fC408F09d6Cc4EDA";
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

  let post = {
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
  const augmentedPost = await addMetadata(post);
  if (augmentedPost) {
    post = augmentedPost;
  }
  return post;
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
      score = score / Math.pow(decay, 6.5);

      story.score = score;
      return story;
    })
    .sort((a, b) => b.score - a.score);
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
    const adTTLSeconds = 60 * 5;
    getAd()
      .then((result) => cache.set(adCacheKey, result, [adTTLSeconds]))
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

  let currentQuery = "";
  if (page && domain) {
    currentQuery += `?page=${page}&domain=${domain}`;
  } else if (page && !domain) {
    currentQuery += `?page=${page}`;
  } else if (!page && domain) {
    currentQuery += `?domain=${domain}`;
  }

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
      <body
        data-instant-allow-query-string
        data-instant-allow-external-links
        ontouchstart=""
      >
        <div class="container">
          ${Sidebar(path)}
          <div id="hnmain" class="scaled-hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f8f8f7">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                ${SecondHeader(theme, "top")}
              </tr>
              ${stories
                .slice(0, 3)
                .map(
                  Row(
                    start,
                    "/",
                    "margin-bottom: 20px;",
                    null,
                    null,
                    null,
                    recentJoiners,
                    false,
                    currentQuery,
                  ),
                )}
              ${ad &&
              Row(
                start,
                "/",
                "margin-bottom: 20px;",
                null,
                null,
                null,
                recentJoiners,
                false,
                currentQuery,
              )(ad)}
              ${stories
                .slice(3, 8)
                .map((story, i) =>
                  Row(
                    start,
                    "/",
                    "margin-bottom: 20px;",
                    null,
                    null,
                    null,
                    recentJoiners,
                    false,
                    currentQuery,
                  )(story, i + 3),
                )}
              ${stories
                .slice(8)
                .map((story, i) =>
                  Row(
                    start,
                    "/",
                    "margin-bottom: 20px;",
                    null,
                    null,
                    null,
                    recentJoiners,
                    false,
                    currentQuery,
                  )(story, i + 8),
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
