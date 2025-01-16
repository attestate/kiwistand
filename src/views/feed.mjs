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
  getRecommendations,
} from "../cache.mjs";
import * as curation from "./curation.mjs";
import * as registry from "../chainstate/registry.mjs";
import log from "../logger.mjs";
import { EIP712_MESSAGE } from "../constants.mjs";
import Row, { addOrUpdateReferrer, extractDomain } from "./components/row.mjs";
import * as karma from "../karma.mjs";
import { metadata } from "../parser.mjs";

import holders from "./holders.mjs";
const formatedHolders = holders.map((a) => ethers.utils.getAddress(a));

const html = htm.bind(vhtml);

const ContestBanner = html`
  <div style="width: 100%; margin: 16px 0; font-family: var(--font-family);">
    <div
      style="border: 1px dotted rgba(219, 105, 141, 0.5); border-right: none; border-left: none;"
    >
      <!-- Header -->
      <div
        onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'"
        style="padding: 16px; background: #F6F6EF; cursor: pointer; display: flex; justify-content: space-between; align-items: center;"
      >
        <div style="display: flex; align-items: center; gap: 12px">
          <div style="width: 16px; height: 16px; background: #8a63d2;"></div>
          <span style="color: black; font-size: 14px"
            >"The Future of Farcaster" Contest</span
          >
        </div>
        <!-- Caret Icon -->
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 256 256"
        >
          <polyline
            points="208 96 128 176 48 96"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="16"
          />
        </svg>
      </div>

      <!-- Expandable Content -->
      <div
        style="display: none; background: white; border-top: 1px dotted rgba(219, 105, 141, 0.5)"
      >
        <!-- Key Info Grid -->
        <div
          style="display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px dotted rgba(219, 105, 141, 0.5)"
        >
          <div
            style="padding: 16px; display: flex; align-items: center; gap: 8px; border-right: 1px dotted rgba(219, 105, 141, 0.5)"
          >
            <!-- Calendar Icon -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 256 256"
              style="color: #828282"
            >
              <rect width="256" height="256" fill="none" />
              <rect
                x="40"
                y="40"
                width="176"
                height="176"
                rx="8"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="16"
              />
              <line
                x1="176"
                y1="24"
                x2="176"
                y2="56"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="16"
              />
              <line
                x1="80"
                y1="24"
                x2="80"
                y2="56"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="16"
              />
              <line
                x1="40"
                y1="88"
                x2="216"
                y2="88"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="16"
              />
            </svg>
            <div>
              <div style="color: black; font-size: 12px">
                Jan 20 - Feb 10, 2025
              </div>
              <div style="color: #828282; font-size: 10px">
                Submissions period
              </div>
            </div>
          </div>
          <div
            style="padding: 16px; display: flex; align-items: center; gap: 8px"
          >
            <!-- Trophy Icon -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 256 256"
              style="color: #828282"
            >
              <path
                d="M58,128H48A32,32,0,0,1,16,96V80a8,8,0,0,1,8-8H56"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="16"
              />
              <path
                d="M198,128h10a32,32,0,0,0,32-32V80a8,8,0,0,0-8-8H200"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="16"
              />
              <path
                d="M56,48H200v63.1c0,39.7-31.75,72.6-71.45,72.9A72,72,0,0,1,56,112Z"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="16"
              />
            </svg>
            <div>
              <div style="color: black; font-size: 12px">Prize Pool: 2 ETH</div>
              <div style="color: #828282; font-size: 10px">
                <span>Sponsored by </span>
                <a
                  href="https://purple.construction/"
                  target="_blank"
                  style="color: #8a63d2; text-decoration: none"
                  >Purple</a
                >
              </div>
            </div>
          </div>
        </div>

        <div style="padding: 16px">
          <!-- Writing Prompts -->
          <div style="margin-bottom: 24px">
            <h4
              style="margin: 0 0 12px 0; font-size: 14px; color: #828282; font-weight: normal"
            >
              Writing Prompts
            </h4>
            <div style="display: flex; flex-direction: column; gap: 8px">
              ${[
                "What updates, tweaks, or features could Farcaster clients do to become better for OGs and newcomers?",
                "Which Farcaster frontier—agents, games, mini-apps, alt clients, memecoins—has the highest potential to grow the ecosystem?",
                "How can crypto social legos create experiences that can't be found on web2 social networks?",
                "How can Farcaster amp up its marketing and growth activities to bring more new users?",
                "How could Farcaster go big without losing its soul?",
              ].map(
                (prompt) => html`
                  <div
                    style="padding: 12px; background: #F6F6EF; border: 1px dotted rgba(219, 105, 141, 0.5)"
                  >
                    <span style="color: black; font-size: 12px">${prompt}</span>
                  </div>
                `,
              )}
            </div>
          </div>

          <!-- How to Participate -->
          <div style="margin-bottom: 24px">
            <h4
              style="margin: 0 0 12px 0; font-size: 14px; color: #828282; font-weight: normal"
            >
              How to Participate
            </h4>
            <div style="display: flex; flex-direction: column; gap: 8px">
              <div
                style="padding: 12px; background: #F6F6EF; border: 1px dotted rgba(219, 105, 141, 0.5)"
              >
                <span style="font-size: 12px; color: black;"
                  >1. Write on any platform (Farcaster, Paragraph, Mirror,
                  etc.)</span
                >
              </div>
              <div
                style="padding: 12px; background: #F6F6EF; border: 1px dotted rgba(219, 105, 141, 0.5)"
              >
                <span style="font-size: 12px; color: black;"
                  >2. Submit your essay to Kiwi</span
                >
              </div>
              <div
                style="padding: 12px; background: #F6F6EF; border: 1px dotted rgba(219, 105, 141, 0.5)"
              >
                <span style="font-size: 12px; color: black;"
                  >3. Share on Farcaster (@kiwi & @purple) and X (@KiwiNewsHQ)
                  for extra distribution</span
                >
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; justify-content: flex-end; gap: 12px">
            <a
              href="https://t.me/+4AgHHzYl5QpmMjc8"
              target="_blank"
              style="text-decoration: none; padding: 8px 16px; background: rgba(0,0,0,0.2); color: black; font-size: 14px"
            >
              Join Writers Chat
            </a>
            <a
              href="https://paragraph.xyz/@kiwi-updates/farcaster-2026-writing-contest"
              target="_blank"
              style="text-decoration: none; padding: 8px 16px; background: black; color: white; font-size: 14px"
            >
              Learn More
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
`;

// NOTE: Only set this date in synchronicity with the src/launch.mjs date!!
const cutoffDate = new Date("2024-11-06");
const thresholdKarma = 3;
export function identityClassifier(upvoter) {
  let balance = 0;

  // TODO: Change to neynar score
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
  const isHolder = formatedHolders.includes(
    ethers.utils.getAddress(upvoter.identity),
  );
  const karmaScore = karma.resolve(upvoter.identity, cutoffDate);
  const hasGnosisPayNFT = balance > 0;
  return {
    ...upvoter,
    fromSponsorCommunity: isHolder || hasGnosisPayNFT,
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

export async function index(
  trie,
  page,
  domain,
  lookback = sub(new Date(), {
    weeks: 3,
  }),
  paginate = true,
  showAd = true,
  showContest = true,
) {
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
  if (paginate) {
    storyPromises = storyPromises.slice(start, end);
  }

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
  if (showAd) {
    const adCacheKey = "ad-cache-key";
    if (cache.get(adCacheKey)) {
      ad = cache.get(adCacheKey);
    } else {
      const adTTLSeconds = 60 * 5;
      getAd()
        .then((result) => cache.set(adCacheKey, result, [adTTLSeconds]))
        .catch((err) => log(`Err in getAd: ${err.stack}`));
    }
  }

  let resolvedContestStories;
  if (showContest) {
    const contestStories = await getContestStories();
    resolvedContestStories = await resolveIds(contestStories);
  }
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

async function recommended(trie, page, domain, identity, hash) {
  const lookback = sub(new Date(), {
    weeks: 3,
  });
  const paginate = false;
  const showAd = false;
  const showContest = false;

  const { ad, originals, stories } = await index(
    trie,
    page,
    domain,
    lookback,
    paginate,
    showAd,
    showContest,
  );

  let candidates = await getRecommendations(stories, hash, identity);
  candidates = candidates.filter(
    (story) => story.metadata?.image && story.submitter.displayName,
  );
  if (candidates.length === 0) {
    candidates = stories;
  }

  const totalStories = parseInt(env.TOTAL_STORIES, 10);
  const start = totalStories * page;
  const end = totalStories * (page + 1);
  candidates = candidates.slice(start, end);

  return {
    contestStories: [],
    ad,
    stories: candidates,
    originals,
    start,
  };
}

function Newsletter() {
  return html`
    <div
      class="newsletter-row"
      style="max-width: 100%; background-color: var(--middle-beige); border: 2px dotted rgba(219, 105, 141, 0.5); border-right: none; border-left: none; padding: 1rem; font-family: var(--font-family); box-sizing: border-box;"
    >
      <div
        style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1rem;"
      >
        <div style="flex: 1; margin-right: 1rem;">
          <h2
            style="font-size: 1.25rem; font-weight: bold; color: black; margin: 0 0 0.25rem 0;"
          >
            Join 1,300+ crypto builders
          </h2>
          <p style="color: #828282; font-size: 0.875rem; margin: 0;">
            Get curated crypto & web3 content delivered to your inbox.
          </p>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 256 256"
          style="width: 24px; height: 24px; flex-shrink: 0;"
        >
          <rect width="256" height="256" fill="none" />
          <polyline
            points="224 56 128 144 32 56"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="16"
          />
          <path
            d="M32,56H224a0,0,0,0,1,0,0V192a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V56A0,0,0,0,1,32,56Z"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="16"
          />
          <line
            x1="110.55"
            y1="128"
            x2="34.47"
            y2="197.74"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="16"
          />
          <line
            x1="221.53"
            y1="197.74"
            x2="145.45"
            y2="128"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="16"
          />
        </svg>
      </div>

      <form
        style="margin-bottom: 0;"
        id="subscribe-form"
        style="display: flex; flex-direction: column; gap: 1rem;"
        onsubmit="(async function(e) {
    e.preventDefault();
    const form = e.target;
    const email = form.querySelector('input[type=email]').value;
    const statusMsg = form.querySelector('#status-message');
    const submitBtn = form.querySelector('button');
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Subscribing...';
    submitBtn.style.backgroundColor = '#828282';
    submitBtn.style.borderColor = '#828282';
    
    try {
      const response = await fetch('https://paragraph.xyz/api/blogs/@kiwi-weekly/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) throw new Error('Subscription failed');
      
      statusMsg.style.display = 'block';
      statusMsg.style.color = 'black';
      statusMsg.textContent = '✓ Thank you for subscribing!';
      form.querySelector('input[type=email]').value = '';
    } catch (err) {
      statusMsg.style.display = 'block';
      statusMsg.style.color = 'rgba(219, 105, 141, 0.75)';
      statusMsg.textContent = 'Something went wrong. Please try again.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Subscribe';
      submitBtn.style.backgroundColor = 'black';
      submitBtn.style.borderColor = 'black';
    }
  })(event)"
      >
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <input
            type="email"
            placeholder="Enter your email"
            style="flex: 1; min-width: 200px; padding: 0.5rem 0.75rem; border: 1px dotted rgba(219, 105, 141, 0.5); background: white; color: black; box-sizing: border-box;"
            required
          />
          <button
            type="submit"
            style="padding: 0.5rem 1rem; background: black; color: white; border: 2px dotted rgba(219, 105, 141, 0.5); cursor: pointer; transition: all 0.2s; white-space: nowrap;"
            onmouseover="this.style.background='white'; this.style.color='black';"
            onmouseout="this.style.background='black'; this.style.color='white';"
          >
            Subscribe
          </button>
        </div>

        <div
          id="status-message"
          style="display: none; font-size: 0.875rem;"
        ></div>

        <div
          style="padding-top: 0.5rem; border-top: 1px dotted rgba(219, 105, 141, 0.3);"
        >
          <p style="font-size: 0.75rem; color: #828282; margin: 0;">
            Join the smartest minds in crypto. Our weekly newsletter includes
            insights from Vitalik Buterin, Stani Kulechov, and other top
            builders in the space.
          </p>
        </div>
      </form>
    </div>
  `;
}

export default async function (trie, theme, page, domain, identity, hash) {
  const mints = await registry.mints();
  const path = "/";
  const totalStories = parseInt(env.TOTAL_STORIES, 10);

  let content;
  if (identity || hash) {
    content = await recommended(trie, page, domain, identity, hash);
  } else {
    content = await index(trie, page, domain);
  }

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
  if (identity && !domain) {
    query += `&identity=${identity}`;
  }
  const ogImage = "https://news.kiwistand.com/kiwi_hot_feed_page.png";
  const title = undefined;
  const description = undefined;
  const twitterCard = undefined;
  const prefetch = [query, "/new?cached=true", "/submit", "/best"];
  const recentJoiners = await registry.recents();
  return html`
    <html lang="en" op="news">
      <head>
        ${custom(ogImage, title, description, twitterCard, prefetch)}
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
              <tr>
                <td>${ContestBanner}</td>
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
              <tr>
                <td>${Newsletter()}</td>
              </tr>

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
                      <div
                        style="width: 100%; padding: 32px 0; display: flex; justify-content: center;"
                      >
                        <a
                          data-no-instant
                          href=${query}
                          style="display: flex; align-items: center; gap: 8px; padding: 12px 24px; 
               background: white; color: #374151; border-radius: 2px; 
               box-shadow: 0 1px 3px rgba(0,0,0,0.12); border: 1px solid #e5e7eb;
               text-decoration: none; font-size: 16px;"
                        >
                          <span>More Stories</span>
                        </a>
                      </div>
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
