import fetch from "node-fetch";
import { utils } from "ethers";
import log from "./logger.mjs";
import normalizeUrl from "normalize-url";
import {
  getCommentAuthorById,
  getSubmission,
  isReactionComment,
} from "./cache.mjs";
import { getSlug } from "./utils.mjs";

/**
 * Purges Cloudflare cache for the specified URL.
 * Requires the environment variables:
 *   CF_API_TOKEN - Your Cloudflare API token.
 *   CF_ZONE_ID   - Your Cloudflare Zone ID.
 *
 * @param {string} url - The URL to purge from Cloudflare's cache.
 * @returns {Promise<Object>} - The JSON response from Cloudflare API.
 * @throws {Error} If the purge fails or credentials are missing.
 */
export async function purgeCache(url) {
  const token = process.env.CF_API_TOKEN;
  const zoneId = process.env.CF_ZONE_ID;
  if (process.env.NODE_ENV !== "production") {
    log("Cloudflare purge skipped: Not in production environment");
    return;
  }
  if (!token || !zoneId) {
    log("Cloudflare purge skipped: Missing API token or zone ID");
    return;
  }
  const purgeUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`;
  const body = { files: [url] };
  const response = await fetch(purgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!data.success) {
    throw new Error(`Failed to purge cache: ${JSON.stringify(data)}`);
  }
  log(`Successfully purged: ${url}`);
  return data;
}

/**
 * Purges everything Cloudflare has cached for the zone, including what the
 * worker (cf-worker.js) keeps in its own cache. Cached pages point at the
 * news.css and JS bundles of the build that rendered them, so after a deploy
 * they'd keep serving the old styles for days. Same credentials as
 * purgeCache.
 */
export async function purgeEverything() {
  const token = process.env.CF_API_TOKEN;
  const zoneId = process.env.CF_ZONE_ID;
  if (process.env.NODE_ENV !== "production") {
    log("Cloudflare purge skipped: Not in production environment");
    return;
  }
  if (!token || !zoneId) {
    log("Cloudflare purge skipped: Missing API token or zone ID");
    return;
  }
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ purge_everything: true }),
    },
  );
  const data = await response.json();
  if (!data.success) {
    throw new Error(`Failed to purge everything: ${JSON.stringify(data)}`);
  }
  log("Successfully purged everything");
  return data;
}

/**
 * Invalidates activity page caches for all users affected by a new message.
 * @param {Object} message - The message object
 */
export function invalidateActivityCaches(message) {
  if (message.type === "amplify") {
    invalidateUpvoteActivityCaches(message);
  } else if (message.type === "comment") {
    invalidateCommentActivityCaches(message);
  }
}

function invalidateNotifications(address) {
  purgeCache(`https://news.kiwistand.com/activity?address=${address}`).catch(
    (err) => log(`Failed to purge activity cache: ${err}`),
  );
  // NOTE: Purges match the URL exactly, so cover the spellings clients use
  // (the iOS app sends the checksummed address), and purge again once every
  // HTTP worker has the new message, in case a reader refetched in between.
  const spellings = new Set([address]);
  try {
    spellings.add(utils.getAddress(address));
    spellings.add(address.toLowerCase());
  } catch {}
  const purgeApi = () =>
    spellings.forEach((spelling) =>
      purgeCache(
        `https://news.kiwistand.com/api/v1/activity?address=${spelling}`,
      ).catch((err) => log(`Failed to purge activity cache: ${err}`)),
    );
  purgeApi();
  setTimeout(purgeApi, 10000);
}

/**
 * Invalidates activity caches when an upvote is added
 */
function invalidateUpvoteActivityCaches(message) {
  try {
    // Skip normalization for text posts and kiwi references
    const normalizedHref = (message.href.startsWith('data:') || message.href.startsWith('kiwi:'))
      ? message.href
      : normalizeUrl(message.href, { stripWWW: false });

    // Get the submission to find its author
    const submission = getSubmission(null, normalizedHref);
    if (submission && submission.identity) {
      invalidateNotifications(submission.identity);
      
      // Also invalidate the story page cache so the upvote count updates
      const slug = getSlug(submission.title);
      const storyUrl = `https://news.kiwistand.com/stories/${slug}?index=0x${submission.index}`;
      purgeCache(storyUrl).catch((err) => 
        log(`Failed to purge story page cache: ${err}`)
      );
      // NOTE: The iOS app reads the same data as JSON.
      purgeCache(
        `https://news.kiwistand.com/api/v1/stories?index=0x${submission.index}`,
      ).catch((err) => log(`Failed to purge story API cache: ${err}`));
      for (const tab of ["submissions", "top"]) {
        purgeCache(
          `https://news.kiwistand.com/upvotes?address=${submission.identity}&format=json&tab=${tab}`,
        ).catch((err) => log(`Failed to purge profile API cache: ${err}`));
      }
    }
  } catch (error) {
    log(`Error invalidating upvote activity cache: ${error}`);
  }
}

/**
 * Invalidates activity caches when a comment or emoji reaction is added
 */
function invalidateCommentActivityCaches(message) {
  try {
    // For emoji reactions, find the comment author
    if (isReactionComment(message.title)) {
      const commentId = message.href;
      const commentAuthor = getCommentAuthorById(commentId);

      if (commentAuthor) {
        invalidateNotifications(commentAuthor);
      }
      return;
    }

    // Regular comment - invalidate submission author and all previous commenters
    const [, submissionIndex] = message.href.split(":");
    const submission = getSubmission(submissionIndex);

    if (!submission) return;

    // Get all involved addresses (submission author + commenters)
    const addresses = new Set();

    if (submission.identity) {
      addresses.add(submission.identity);
    }

    if (submission.comments && Array.isArray(submission.comments)) {
      submission.comments.forEach((comment) => {
        if (comment.identity) {
          addresses.add(comment.identity);
        }
      });
    }

    addresses.forEach((address) => invalidateNotifications(address));
  } catch (error) {
    log(`Error invalidating comment activity cache: ${error}`);
  }
}
