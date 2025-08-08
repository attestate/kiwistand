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
  getUnixTime,
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
  countImpressions,
  countOutbounds,
  countShares,
  getLastComment,
  getSubmission,
  listNewest,
  // Removed getRecommendations import
} from "../cache.mjs";
import * as curation from "./curation.mjs";
import log from "../logger.mjs";
import { EIP712_MESSAGE } from "../constants.mjs";
import Row, { extractDomain } from "./components/row.mjs";
import * as karma from "../karma.mjs";
import { cachedMetadata } from "../parser.mjs";
import { getPredictedEngagement } from "../prediction.mjs";
import { getLeaderboard } from "../leaderboard.mjs";

import holders from "./holders.mjs";
const formatedHolders = holders.map((a) => ethers.utils.getAddress(a));

// Import twitterFrontends for checking Twitter/X links
import { twitterFrontends } from "../parser.mjs";

const html = htm.bind(vhtml);

// Helper function to check if a story is one of the allowed content types for predictions
// Based on debug view types: 2, 3, 4, 5, or 8
function isAllowedContentTypeForPrediction(story) {
  if (!story) return false;
  // Type 8: Any story with OG image
  const hasOgImage = story.metadata?.image && 
    story.metadata.image.startsWith("https://");
  
  // Type 2: Cloudflare image - href pointing to Cloudflare URL  
  const isCloudflareImage = story.href?.includes("cloudflare") || 
    story.href?.includes("imagedelivery.net");
  
  // Type 3: Twitter/X preview - check if URL is from Twitter/X frontends
  let isTwitterLink = false;
  try {
    if (story.href) {
      const url = new URL(story.href);
      isTwitterLink = Array.isArray(twitterFrontends) && twitterFrontends.some(domain => 
        url.hostname === domain || url.hostname === `www.${domain}`
      );
    }
  } catch (e) {
    // Invalid URL
  }
  const hasTwitterMetadata = story.metadata?.twitterCreator || 
    story.metadata?.twitterAuthorAvatar;
  const isTwitterPreview = isTwitterLink || hasTwitterMetadata;
  
  // Type 4: Farcaster preview - with farcasterCast metadata or warpcast/farcaster URLs
  const isFarcasterLink = story.href?.includes("warpcast.com") || 
    story.href?.includes("farcaster.xyz");
  const hasFarcasterCast = story.metadata?.farcasterCast;
  const isFarcasterPreview = isFarcasterLink || hasFarcasterCast;
  
  // Type 5: Comment preview - with lastComment object
  const hasLastComment = !!story.lastComment;
  
  return hasOgImage || isCloudflareImage || isTwitterPreview || 
    isFarcasterPreview || hasLastComment;
}

// --- Prediction Configuration ---
const PREDICTION_NEWNESS_THRESHOLD_SECONDS = 10 * 60 * 60; // 10 hours
const PREDICTION_LOW_ENGAGEMENT_UPVOTES = 2;
const PREDICTION_REPLACEMENT_COUNT = 10; // Number of oldest stories to replace
// --- End Prediction Configuration ---

// NOTE: Only set this date in synchronicity with the src/launch.mjs date!!
const cutoffDate = new Date("2025-01-15");
const thresholdKarma = 5;
export function identityClassifier(upvoter) {
  let balance = 0;

  const cacheKey = `neynar-score-${upvoter.identity}`;
  if (cache.has(cacheKey)) {
    balance = cache.get(cacheKey);
  } else {
    try {
      getNeynarScore(upvoter.identity)
        .then((balance) => cache.set(cacheKey, balance))
        .catch((err) => log(`Error in getNeynarScore: ${err.stack}`));
    } catch (err) {
      // noop
    }
  }
  const isHolder = formatedHolders.includes(
    ethers.utils.getAddress(upvoter.identity),
  );
  const karmaScore = karma.resolve(upvoter.identity, cutoffDate);
  const hasNeynarScore = balance > 90000;
  return {
    ...upvoter,
    isHolder,
    hasNeynarScore,
    fromSponsorCommunity: isHolder || hasNeynarScore,
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

const provider = new ethers.providers.JsonRpcProvider(env.BASE_RPC_HTTP_HOST);

export async function getNeynarScore(address) {
  const contractAddress = "0xd3C43A38D1D3E47E9c420a733e439B03FAAdebA8";
  const abi = [
    {
      inputs: [{ internalType: "address", name: "verifier", type: "address" }],
      name: "getScore",
      outputs: [{ internalType: "uint24", name: "", type: "uint24" }],
      stateMutability: "view",
      type: "function",
    },
  ];

  const contract = new ethers.Contract(contractAddress, abi, provider);

  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Timeout")), 5000);
  });

  let score;
  try {
    score = await Promise.race([contract.getScore(address), timeout]);
  } finally {
    clearTimeout(timeoutId);
  }

  return score;
}

const formatAge = (ageInMinutes) => {
  const hours = Math.floor(ageInMinutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${Math.floor(ageInMinutes)}m`;
};

const itemAge = (timestamp) => {
  const now = new Date();
  const ageInMinutes = differenceInMinutes(now, new Date(timestamp * 1000));
  return ageInMinutes;
};

// Calculate click-through rate (CTR) for a story
export function calculateCTR(story) {
  // Get normalized clicks and impressions counts
  const clicks = countOutbounds(story.href);
  const impressions = countImpressions(story.href);

  // Only calculate CTR if we have impressions, otherwise throw
  if (impressions > 0) {
    return clicks / impressions;
  }

  throw new Error("No impressions available for CTR calculation");
}

// Calculate upvote-to-click ratio
export function calculateUpvoteClickRatio(story) {
  const clicks = countOutbounds(story.href);
  const upvotes = story.upvotes;

  if (clicks > 0) {
    return upvotes / clicks;
  }
  throw new Error("No clicks available for CTR calculation");
}

function meanCTR(leaves) {
  const ctrs = [];
  for (let leaf of leaves) {
    try {
      const ctr = calculateCTR(leaf);
      ctrs.push(ctr);
    } catch (err) {
      // noop
    }
  }
  const sumCTRs = ctrs.reduce((sum, ctr) => sum + ctr, 0);
  if (ctrs.length > 0) {
    return sumCTRs / ctrs.length;
  }
  throw new Error("CTRs length is not available");
}

function meanUpvoteRatio(leaves) {
  const ratios = [];
  for (let leaf of leaves) {
    try {
      const ratio = calculateUpvoteClickRatio(leaf);
      ratios.push(ratio);
    } catch (err) {
      // noop
    }
  }
  const sumRatios = ratios.reduce((sum, ratio) => sum + ratio, 0);
  if (ratios.length > 0) {
    return sumRatios / ratios.length;
  }
  throw new Error("Ratios length is not available");
}

async function calculateNeynarUpvotes(upvoters) {
  let weightedUpvotes = 0;
  for (const upvoter of upvoters) {
    try {
      const profile = await ens.resolve(upvoter);
      const neynarScore = profile.neynarScore || 0;
      const upvoteValue = 1 + neynarScore;
      weightedUpvotes += upvoteValue;
    } catch (err) {
      weightedUpvotes += 1; // fallback to 1 if resolution fails
    }
  }
  return weightedUpvotes;
}

export async function topstories(leaves, algorithm = 'control') {
  // Check if we're using Lobsters algorithm
  const useLobstersAlgo = algorithm === 'lobsters';
  
  return Promise.allSettled(leaves
    .map(async (story) => {
      const commentCount =
        store.commentCounts.get(`kiwi:0x${story.index}`) || 0;
      const upvotes = await calculateNeynarUpvotes(story.upvoters);
      
      let score;
      
      if (useLobstersAlgo) {
        // Lobsters algorithm: negative hotness with simple time decay
        // Base score: log10(upvotes + comments*0.5)
        const baseScore = Math.log10(Math.max(1, upvotes + commentCount * 0.5));
        
        // Time penalty: hours_age / 2
        const hoursAge = itemAge(story.timestamp) / 60; // Convert minutes to hours
        const timePenalty = hoursAge / 2;
        
        // Lobsters uses negative scores for sorting (more negative = lower rank)
        // We'll invert this to keep positive scores for consistency with sorting
        score = baseScore - timePenalty;
        
        // Ensure score doesn't go negative (would break our sorting)
        score = Math.max(0.001, score);
      } else {
        // Original control algorithm
        // Add shares with double weight of upvotes
        const shares = countShares(story.href);
        const sharesAsUpvotes = shares * 2; // Each share counts as 2 upvotes
        
        if (upvotes > 2) {
          score = Math.log((upvotes + sharesAsUpvotes) * 0.4 + commentCount * 0.6);
        } else {
          score = Math.log(upvotes + sharesAsUpvotes);
        }

        const outboundClicks = countOutbounds(story.href) + 1;
        if (outboundClicks > 0) {
          score = score * 0.9 + 0.1 * Math.log(outboundClicks);
        }

        try {
          const upvoteRatio = meanUpvoteRatio(leaves);
          const storyRatio = calculateUpvoteClickRatio(story);
          const upvotePerformance = storyRatio / upvoteRatio;

          const clicks = countOutbounds(story.href);
          const sampleSize = upvotes + clicks;
          const confidenceFactor = Math.pow(
            Math.min(1, sampleSize / 1_000_000),
            2,
          );

          const adjustedPerformance = upvotePerformance * confidenceFactor;

          score *= adjustedPerformance;
        } catch (e) {
          // If Upvote-Click ratio can't be calculated, we just keep the current
          // score
        }

        // Try to apply CTR adjustment if available
        try {
          const meanCtrValue = meanCTR(leaves);
          const ctr = calculateCTR(story);
          const ctrPerformance = ctr / meanCtrValue;

          const impressions = countImpressions(story.href);
          const confidenceFactor = Math.pow(
            Math.min(1, impressions / 1_000_000),
            2,
          );

          const adjustedPerformance = ctrPerformance * confidenceFactor;

          score *= adjustedPerformance;
        } catch (e) {
          // If CTR can't be calculated, we just keep the current score
        }

        const scoreBeforeDecay = score;
        const storyAgeInDays = itemAge(story.timestamp) / (60 * 24); // Convert minutes to days
        const decay = Math.sqrt(itemAge(story.timestamp));

        // No freshness boost in control algorithm anymore
        
        if (storyAgeInDays < 5) {
          score = score / Math.pow(decay, 5);
        } else {
          score = score / Math.pow(decay, storyAgeInDays);
        }
      }

      story.score = score * 10000000;
      return story;
    }))
    .then(results => {
      return results
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value)
        .sort((a, b) => b.score - a.score);
    });
}

async function addMetadata(post) {
  const data = cachedMetadata(post.href);
  return {
    ...post,
    metadata: data,
  };
}


export async function index(
  trie,
  page,
  domain,
  lookback = sub(new Date(), {
    days: 3,
  }),
  paginate = true,
  appCuration = false,
  algorithm = 'control',
) {
  const lookbackUnixTime = Math.floor(lookback.getTime() / 1000);
  const limit = -1;
  let leaves = listNewest(limit, lookbackUnixTime); // Raw leaves for prediction candidates later

  const policy = await moderation.getLists();
  const path = "/";
  let moderatedLeaves = moderation.moderate(leaves, policy, path); // Use a different var name

  // 1. Calculate initial ranking based on ACTUAL engagement
  let rankedStories = await topstories(moderatedLeaves, algorithm); // Use moderated leaves with algorithm

  // 2. Filter ranked stories based on age/engagement rules
  rankedStories = rankedStories.filter(({ index, upvotes, timestamp }) => {
    const storyAgeInDays = itemAge(timestamp) / (60 * 24);
    const commentCount = store.commentCounts.get(`kiwi:0x${index}`) || 0;
    // Keep stories > 7 days old out of page 0 initially, but allow them on other pages
    if (page === 0 && storyAgeInDays > 7) {
      return false;
    }
    // General engagement filter (applied after ranking)
    if (storyAgeInDays <= 2) {
      return upvotes > 1;
    } else {
      // storyAgeInDays > 2
      return upvotes + commentCount > 3;
    }
  });

  // 3. Apply app curation if needed
  if (appCuration) {
    const sheetName = "app";
    let result;
    try {
      result = await curation.getSheet(sheetName);
    } catch (err) {
      // keep original rankedStories on error
    }
    if (result?.links) {
      const links = result.links.map((link) =>
        normalizeUrl(link, { stripWWW: false }),
      );
      rankedStories = rankedStories.filter(({ href }) =>
        links.includes(normalizeUrl(href, { stripWWW: false })),
      );
    }
  }

  // 4. Apply domain filter if needed
  if (domain)
    rankedStories = rankedStories.filter(
      ({ href }) => extractDomain(href) === domain,
    );

  // 5. Paginate the normally ranked stories
  const totalStories = parseInt(env.TOTAL_STORIES, 10);
  const start = totalStories * page;
  const end = totalStories * (page + 1);
  let pageStories = [];
  if (paginate) {
    pageStories = rankedStories.slice(start, end);
  } else {
    pageStories = rankedStories; // Use all if not paginating
  }

  // 6. Resolve IDs, add metadata for the current page
  let writers = [];
  try {
    writers = await moderation.getWriters();
  } catch (err) {
    // noop
  }

  async function resolveIds(storyPromises) {
    const stories = [];
    for await (let story of storyPromises) {
      const ensData = await ens.resolve(story.identity); // Resolve ENS for all stories on page

      let avatars = [];
      let upvoterProfiles = [];
      
      for await (let upvoter of story.upvoters) {
        const profile = await ens.resolve(upvoter);
        if (profile.safeAvatar) {
          upvoterProfiles.push({
            avatar: profile.safeAvatar,
            address: upvoter,
            neynarScore: profile.neynarScore || 0
          });
        }
      }
      // Sort by neynarScore descending and take top 5
      upvoterProfiles.sort((a, b) => b.neynarScore - a.neynarScore);
      avatars = upvoterProfiles.slice(0, 5).map(p => p.avatar);

      const lastComment = getLastComment(`kiwi:0x${story.index}`, policy.addresses || []);
      if (lastComment && lastComment.identity) {
        lastComment.identity = await ens.resolve(lastComment.identity);
        const uniqueIdentities = new Set(
          lastComment.previousParticipants
            .map((p) => p.identity)
            .filter((identity) => identity !== lastComment.identity),
        );
        const resolvedParticipants = await Promise.allSettled(
          [...uniqueIdentities].map((identity) => ens.resolve(identity)),
        );
        lastComment.previousParticipants = resolvedParticipants
          .filter(
            (result) =>
              result.status === "fulfilled" && result.value.safeAvatar,
          )
          .map((result) => ({
            identity: result.value.identity,
            safeAvatar: result.value.safeAvatar,
            displayName: result.value.displayName,
          }));
      }

      const isOriginal = Object.keys(writers).some(
        (domain) =>
          normalizeUrl(story.href).startsWith(domain) &&
          writers[domain] === story.identity,
      );

      const augmentedStory = await addMetadata(story); // Add metadata (like pagespeed)
      if (augmentedStory) {
        story = augmentedStory;
        const href = normalizeUrl(story.href, { stripWWW: false });
        if (href && policy?.images.includes(href) && story.metadata?.image) {
          delete story.metadata.image;
        }
      }

      const impressions = countImpressions(story.href); // Get impressions count

      stories.push({
        ...story,
        impressions, // Add impressions to the story object
        lastComment,
        displayName: ensData.displayName,
        submitter: ensData,
        avatars: avatars,
        isOriginal,
      });
    }
    return stories;
  }
  let stories = await resolveIds(pageStories); // Process the current page

  // 7. Filter based on resolved submitter name
  stories = stories.filter((story) => {
    const hasProperName =
      story.submitter &&
      (story.submitter.ens ||
        story.submitter.lens ||
        story.submitter.farcaster);
    return hasProperName;
  });

  // 8. Apply pagespeed boost and FINAL SORT before prediction injection
  stories = stories
    .map((story) => {
      if (story.metadata?.pagespeed) {
        const speedMultiplier = 0.5 + story.metadata.pagespeed / 100;
        story.score = (story.score || 0) * speedMultiplier;
      }
      return story;
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0)); // Sort by potentially boosted score

  // 9. Prediction Injection Logic (Page 0 ONLY - applied AFTER final sort)
  if (page === 0 && paginate && stories.length > 0) {
    // --- Find the indices of the N oldest stories in the current list ---
    const storiesWithOriginalIndex = stories.map((story, index) => ({
      ...story,
      originalIndex: index,
    }));

    storiesWithOriginalIndex.sort((a, b) => a.timestamp - b.timestamp); // Sort by timestamp ascending (oldest first)

    const numStoriesToConsider = Math.min(
      stories.length,
      PREDICTION_REPLACEMENT_COUNT,
    );
    const oldestStoryIndices = storiesWithOriginalIndex
      .slice(0, numStoriesToConsider)
      .map((story) => story.originalIndex); // Get original indices of the N oldest

    const numPotentialSlots = oldestStoryIndices.length;
    // --- End finding oldest stories ---

    if (numPotentialSlots > 0) {
      // Find candidates for prediction (new, low engagement, not already on page)
      // Use the original 'leaves' list for candidates
      const nowTimestampForAge = getUnixTime(new Date());
      
      // Pre-filter candidates based on basic criteria
      const potentialCandidates = leaves.filter(
        (leaf) =>
          nowTimestampForAge - leaf.timestamp <
            PREDICTION_NEWNESS_THRESHOLD_SECONDS &&
          leaf.upvotes <= PREDICTION_LOW_ENGAGEMENT_UPVOTES &&
          !stories.some((ps) => ps.index === leaf.index), // Ensure candidate isn't already on the final page list
      );
      
      // Load metadata and lastComment for candidates to check content type
      const candidatesWithMetadata = potentialCandidates.map((candidate) => {
        let metadata, lastComment;
        try {
          metadata = cachedMetadata(candidate.href);
        } catch (err) {
          log(`Error getting metadata for ${candidate.href}: ${err}`);
          metadata = null;
        }
        try {
          lastComment = getLastComment(`kiwi:0x${candidate.index}`, policy.addresses || []);
        } catch (err) {
          log(`Error getting last comment for ${candidate.index}: ${err}`);
          lastComment = null;
        }
        return { ...candidate, metadata, lastComment };
      });
      
      // Filter to only allowed content types
      const candidates = candidatesWithMetadata.filter(isAllowedContentTypeForPrediction);

      if (candidates.length > 0) {
        const predictionPromises = candidates.map(async (story) => {
          const prediction = await getPredictedEngagement(story);
          // Also pre-resolve ENS for potential replacements here
          const submitter = await ens.resolve(story.identity);
          const impressions = countImpressions(story.href); // Get impressions for candidate
          return {
            story: { ...story, submitter, impressions }, // metadata and lastComment already included
            prediction,
          }; // Combine story, resolved data, and prediction
        });
        const results = await Promise.allSettled(predictionPromises);

        let predicted = results
          .filter(
            (r) =>
              r.status === "fulfilled" &&
              r.value.prediction &&
              !r.value.prediction.predictionError &&
              r.value.story.submitter && // Ensure submitter was resolved
              (r.value.story.submitter.ens ||
                r.value.story.submitter.lens ||
                r.value.story.submitter.farcaster), // Ensure submitter has a proper name
          )
          .map((r) => {
            const { story, prediction } = r.value;
            const predictedScore =
              prediction.predictedUpvotes + prediction.predictedComments;
            // Return the fully resolved story object with predictedScore
            return { ...story, predictedScore };
          });

        // --- MODERATE PREDICTED STORIES ---
        if (predicted.length > 0) {
          predicted = moderation.moderate(predicted, policy, path);
        }
        // --- END MODERATION ---

        if (predicted.length > 0) {
          // Sort predicted stories by their predicted score (desc)
          predicted.sort((a, b) => b.predictedScore - a.predictedScore);

          const numToActuallyReplace = Math.min(
            numPotentialSlots,
            predicted.length,
          );

          if (numToActuallyReplace > 0) {
            // Select the indices of the oldest stories to replace (already sorted by age implicitly)
            const indicesToReplace = oldestStoryIndices.slice(
              0,
              numToActuallyReplace,
            );
            // Select the top predicted stories to use as replacements
            const replacementStories = predicted.slice(0, numToActuallyReplace);

            // Pre-resolve additional data (avatars, lastComment) for replacement stories
            const finalReplacementPromises = replacementStories.map(
              async (story) => {
                let avatars = [];
                for await (let upvoter of story.upvoters.slice(0, 5)) {
                  const profile = await ens.resolve(upvoter);
                  if (profile.safeAvatar) avatars.push(profile.safeAvatar);
                }
                const lastComment = getLastComment(`kiwi:0x${story.index}`, policy.addresses || []);
                if (lastComment && lastComment.identity) {
                  lastComment.identity = await ens.resolve(
                    lastComment.identity,
                  );
                  // Resolve participants if needed (simplified here)
                }
                const isOriginal = Object.keys(writers).some(
                  (d) =>
                    normalizeUrl(story.href).startsWith(d) &&
                    writers[d] === story.identity,
                );
                // Apply pagespeed boost to the predicted story's score if applicable
                if (story.metadata?.pagespeed) {
                  const speedMultiplier = 0.5 + story.metadata.pagespeed / 100;
                  // Note: Predicted stories don't have an original 'score' from topstories.
                  // We might need a different way to handle score or just use 0.
                  story.score = 0 * speedMultiplier; // Or some base score?
                } else {
                  story.score = 0; // Ensure score property exists
                }

                // Impressions already added when creating candidates
                return {
                  ...story,
                  avatars,
                  lastComment,
                  isOriginal,
                  displayName: story.submitter.displayName, // Already resolved
                };
              },
            );
            const finalReplacementStories = (
              await Promise.allSettled(finalReplacementPromises)
            )
              .filter((r) => r.status === "fulfilled")
              .map((r) => r.value);

            // Ensure we still have enough valid final replacements
            const numFinalReplacements = Math.min(
              indicesToReplace.length,
              finalReplacementStories.length,
            );

            if (numFinalReplacements > 0) {
              // Create a map from the original array index to the final replacement story
              const replacementMap = new Map();
              for (let i = 0; i < numFinalReplacements; i++) {
                replacementMap.set(
                  indicesToReplace[i], // Use the original index of the story being replaced
                  finalReplacementStories[i],
                );
              }

              // Build the final stories array using the map
              stories = stories.map((originalStory, index) => {
                return replacementMap.get(index) || originalStory;
              });
            }
          }
        }
      }
    }
  }

  // 10. Handle pinned story (after potential replacements)
  let pinnedStory;
  if (policy?.pinned?.length > 0 && page === 0) {
    const pinnedUrl = policy.pinned[0];
    const pinnedIndex = stories.findIndex(
      (story) => normalizeUrl(story.href, { stripWWW: false }) === pinnedUrl,
    );
    if (pinnedIndex !== -1) {
      [pinnedStory] = stories.splice(pinnedIndex, 1); // Remove from list and store
    }
  }

  // 11. Handle originals (after potential replacements and pin removal)
  // Note: Originals might have been replaced by predictions if they were old.
  // We filter from the *final* stories list.
  let originals = stories.filter((story) => story.isOriginal).slice(0, 2); // Take top 2 originals *remaining* in the list

  // 12. FINAL FILTER: Remove stories older than 2 days
  const twoDaysInSeconds = 2 * 24 * 60 * 60;
  const nowTimestamp = getUnixTime(new Date());
  stories = stories.filter(
    (story) => nowTimestamp - story.timestamp <= twoDaysInSeconds,
  );

  // Return final data
  return {
    pinnedStory, // This will be rendered separately at the top
    stories, // This is the main list, potentially modified by predictions, pin removed, and finally filtered by age
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

export default async function (trie, theme, page, domain, identity, hash, variant) {
  const path = "/";
  const totalStories = parseInt(env.TOTAL_STORIES, 10);

  // Removed Stripe URLs

  // Map variant to algorithm
  const algorithm = variant === 'lobsters' ? 'lobsters' : 'control';
  
  // Always call the standard index function, regardless of identity/hash
  const content = await index(trie, page, domain, sub(new Date(), { days: 3 }), true, false, algorithm);

  // Destructure content
  const { originals, stories, start, pinnedStory } = content;

  let currentQuery = "";
  if (page && domain) {
    currentQuery += `?page=${page}&domain=${domain}`;
  } else if (page && !domain) {
    currentQuery += `?page=${page}`;
  } else if (!page && domain) {
    currentQuery += `?domain=${domain}`;
  }

  // Construct query for the 'More' link (next page)
  let query = `?page=${page + 1}`;
  if (domain) {
    query += `&domain=${domain}`;
  }
  // Removed adding identity to the query string

  // Removed A/B Test for Support Banner and supportBannerComponent variable

  const ogImage = "https://news.kiwistand.com/kiwi_hot_feed_page.png";
  const title = undefined;
  const description = undefined;
  const twitterCard = undefined;
  const prefetch = ["/new?cached=true", "/submit", "/best", "/community"];
  return html`
    <html lang="en" op="news">
      <head>
        ${custom(ogImage, title, description, twitterCard, prefetch, null, null, variant)}
        <meta
          name="description"
          content="Crypto news for builders"
        />
        <script
          defer
          src="https://unpkg.com/@zoralabs/zorb@^0.0/dist/zorb-web-component.umd.js"
        ></script>
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
              ${
                // Render pinned story only if it exists
                pinnedStory &&
                Row(
                  start, // Use start index from content
                  "/",
                  "margin-bottom: 20px;",
                  null,
                  null,
                  null,
                  false,
                  undefined,
                  true, // isPinned = true
                )(pinnedStory)
              }
              ${stories // Render first 3 stories
                .slice(0, 3)
                .map(
                  Row(
                    start, // Use start index from content
                    "/",
                    "margin-bottom: 20px;",
                    null,
                    null,
                    null,
                    false,
                    currentQuery,
                  ),
                )}
              ${stories // Render remaining stories
                .slice(3)
                .map(
                  (story, i) =>
                    Row(
                      start, // Use start index from content
                      "/",
                      "margin-bottom: 20px;",
                      null,
                      null,
                      null,
                      false,
                      currentQuery,
                    )(story, i + 3), // Adjust index offset
                )}
            </table>
            ${Footer(theme, path)}
          </div>
        </div>
      </body>
    </html>
  `;
}
