import { env } from "process";

import { resolveIdentity } from "@attestate/delegator2";

import log from "./logger.mjs";
import { getSubmission, getCommunity } from "./cache.mjs";
import { verify } from "./id.mjs";
import { createLimiter } from "./ratelimit.mjs";
import { resolve, fetchENSData } from "./ens.mjs";
import * as email from "./email.mjs";
import { truncateComment } from "./views/activity.mjs";
import { getSlug } from "./utils.mjs";
import { sendNotification, getFidsFromAddresses } from "./neynar.mjs";
import * as moderation from "./views/moderation.mjs";
import { sendPushNotification } from "./onesignal.mjs";

export async function triggerUpvoteNotification(message) {
  if (message.type !== "amplify") return;

  try {
    // Get the submission that was upvoted
    const submission = getSubmission(null, message.href);
    if (!submission || !submission.identity) return;

    // Don't notify if the upvoter is the author
    if (message.identity === submission.identity) return;

    // Banned users can neither send nor receive notifications
    let bannedAddresses = [];
    try {
      const policy = await moderation.getLists();
      bannedAddresses = policy.addresses || [];
    } catch (err) {
      log(`Failed to get banned addresses for upvote notification filtering: ${err}`);
    }
    if (bannedAddresses.includes(message.identity.toLowerCase())) return;

    // Get upvoter's display name and try to determine Neynar score
    const ensData = await resolve(message.identity);
    if (!ensData.displayName) return;

    // Determine Neynar quality score for the upvoter
    const MIN_NEYNAR_SCORE = parseFloat(env.MIN_NEYNAR_SCORE || "0.7");
    let neynarScore = typeof ensData.neynarScore === "number" ? ensData.neynarScore : 0;

    // If score is not known from cache, try fetching richer ENS/Neynar data
    if (!neynarScore || Number.isNaN(neynarScore)) {
      try {
        const richProfile = await fetchENSData(message.identity.toLowerCase());
        if (richProfile?.farcaster?.score && typeof richProfile.farcaster.score === "number") {
          neynarScore = richProfile.farcaster.score;
        }
      } catch (_) {
        // Ignore fetch errors; we'll fall back to default (0)
      }
    }

    // Only notify if upvoter meets Neynar quality threshold
    if (!(neynarScore >= MIN_NEYNAR_SCORE)) {
      log(
        `Skipping Neynar upvote notification: score ${neynarScore} below threshold ${MIN_NEYNAR_SCORE} for ${message.identity}`,
      );
      return;
    }

    // Filter out banned users from receiving notifications
    const receivers = [submission.identity].filter(
      receiver => !bannedAddresses.includes(receiver.toLowerCase())
    );

    if (receivers.length === 0) return;

    const slug = getSlug(submission.title);
    const url = `https://news.kiwistand.com/stories/${slug}?index=0x${submission.index}`;

    // Get FID for Neynar notification
    let targetFids = [];
    try {
      targetFids = await getFidsFromAddresses(receivers);
    } catch (err) {
      log(`Failed to get FIDs for upvote Neynar notifications: ${err}`);
    }

    // Send Neynar notification if we have FID (production only)
    if (targetFids.length > 0 && env.NODE_ENV === "production") {
      try {
        const fcTitle = "New like"; // Max 32 chars
        const fcBody = `${ensData.displayName} upvoted: ${submission.title.substring(0, 128 - ensData.displayName.length - 11)}`; // Max 128 chars total
        
        await sendNotification(
          url,
          fcBody,
          fcTitle,
          targetFids
        );
        log(`Sent upvote Neynar notification to FID ${targetFids[0]}`);
      } catch (err) {
        log(`Failed to send upvote Neynar notification: ${err}`);
      }
    }

    // Send OneSignal push notification for upvote
    try {
      await sendPushNotification(receivers, {
        title: "New like",
        body: `${ensData.displayName} upvoted your story: ${submission.title.substring(0, 100)}`,
        url: url,
      });
    } catch (err) {
      log(`Failed to send upvote OneSignal notification: ${err}`);
    }
  } catch (err) {
    log(`Error in triggerUpvoteNotification: ${err}`);
  }
}

export async function triggerNotification(message) {
  if (message.type !== "comment") return;

  const [_, index] = message.href.split("kiwi:");
  const submission = getSubmission(index);

  // Banned users can't send notifications and moderated stories don't
  // produce any. Continue unfiltered if moderation fails.
  let policy;
  try {
    policy = await moderation.getLists();
  } catch (err) {
    log(`Failed to get banned addresses for notification filtering: ${err}`);
  }
  const bannedAddresses = policy?.addresses || [];
  if (bannedAddresses.includes(message.identity.toLowerCase())) return;
  if (policy && moderation.isModerated(submission, policy)) return;

  const ensData = await resolve(message.identity);
  if (!ensData.displayName) return;

  const receivers = [
    submission.identity,
    ...submission.comments.map((comment) => comment.identity),
  ].filter((receiver) => receiver !== message.identity);

  // Filter out banned users from receiving notifications
  const uniqueReceivers = Array.from(new Set(receivers)).filter(
    receiver => !bannedAddresses.includes(receiver.toLowerCase())
  );

  const maxChars = 140;
  const slug = getSlug(submission.title);
  const url = `https://news.kiwistand.com/stories/${slug}?index=0x${submission.index}#0x${message.index}`;

  // Get FIDs for Neynar notifications
  let targetFids = [];
  try {
    targetFids = await getFidsFromAddresses(uniqueReceivers);
  } catch (err) {
    log(`Failed to get FIDs for Neynar notifications: ${err}`);
  }

  // Send Neynar notifications if we have FIDs (production only)
  if (targetFids.length > 0 && env.NODE_ENV === "production") {
    try {
      const fcTitle = "New comment"; // Max 32 chars
      const fcBody = `${ensData.displayName}: ${truncateComment(message.title, 128 - ensData.displayName.length - 2)}`; // Max 128 chars total
      
      await sendNotification(
        url,
        fcBody,
        fcTitle,
        targetFids
      );
      log(`Sent Neynar notifications to ${targetFids.length} FIDs`);
    } catch (err) {
      log(`Failed to send Neynar notifications: ${err}`);
    }
  }

  // Send OneSignal push notifications to iOS app users
  try {
    await sendPushNotification(uniqueReceivers, {
      title: `${ensData.displayName} replied`,
      body: truncateComment(message.title, maxChars),
      url: url,
    });
  } catch (err) {
    log(`Failed to send OneSignal notifications: ${err}`);
  }

  await Promise.allSettled(
    uniqueReceivers.map(async (receiver) => {
      await email.send(receiver, {
        sender: ensData.displayName,
        title: `New comment in: ${submission.title}`,
        message: message.title,
        data: { url },
      });
    }),
  );
}

// NOTE: A person who leaves and joins a community again within a day doesn't
// notify its owner again. In memory, like the rate limits (ratelimit.mjs):
// the window resets when the node restarts.
export const JOIN_NOTIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000;
let joinWindow = createLimiter({
  limit: 1,
  windowMs: JOIN_NOTIFICATION_WINDOW_MS,
});
export function resetJoinNotifications(now) {
  joinWindow = createLimiter({
    limit: 1,
    windowMs: JOIN_NOTIFICATION_WINDOW_MS,
    ...(now ? { now } : {}),
  });
}

const joinDefaults = {
  getCommunity: (id, delegations) => getCommunity(id, delegations),
  getLists: () => moderation.getLists(),
  resolve: (address) => resolve(address),
  fetchENSData: (address) => fetchENSData(address),
  getFids: (addresses) => getFidsFromAddresses(addresses),
  sendNeynar: (url, body, title, fids) =>
    sendNotification(url, body, title, fids),
  sendPush: (addresses, notification) =>
    sendPushNotification(addresses, notification),
};

// Tells a community's owner that someone joined it (protocol 14.0.0), with a
// Farcaster mini app notification and a push notification to the iOS app,
// like an upvote of their story (triggerUpvoteNotification): the joiner needs
// a name and a Neynar score of at least MIN_NEYNAR_SCORE, and banned profiles
// neither send nor receive. Called by the node's API (api.mjs) for a join it
// took, so a join synced from a peer doesn't notify again. The in-app
// notification is computed from the memberships table (views/activity.mjs).
//
// Returns the notification it sent, or null and why it didn't.
export async function triggerJoinNotification(message, delegations = {}, deps = {}) {
  const d = { ...joinDefaults, ...deps };
  const skip = (reason) => {
    log(`Skipping join notification: ${reason}`);
    return { sent: null, reason };
  };
  if (message?.type !== "join") return skip("not a join");

  try {
    const identity = resolveIdentity(delegations, verify(message));
    const community = d.getCommunity(message.community, delegations);
    if (!community) return skip("unknown community");
    const owner = community.owner;
    if (owner.toLowerCase() === identity.toLowerCase()) {
      return skip("the owner joined their own community");
    }

    let bannedAddresses = [];
    try {
      bannedAddresses = (await d.getLists()).addresses || [];
    } catch (err) {
      log(`Failed to get banned addresses for join notification filtering: ${err}`);
    }
    if (bannedAddresses.includes(identity.toLowerCase())) {
      return skip("the joiner is banned");
    }
    if (bannedAddresses.includes(owner.toLowerCase())) {
      return skip("the owner is banned");
    }

    const ensData = await d.resolve(identity);
    if (!ensData?.displayName) return skip("the joiner has no name");

    const MIN_NEYNAR_SCORE = parseFloat(env.MIN_NEYNAR_SCORE || "0.7");
    let neynarScore =
      typeof ensData.neynarScore === "number" ? ensData.neynarScore : 0;
    if (!neynarScore || Number.isNaN(neynarScore)) {
      try {
        const richProfile = await d.fetchENSData(identity.toLowerCase());
        if (typeof richProfile?.farcaster?.score === "number") {
          neynarScore = richProfile.farcaster.score;
        }
      } catch (_) {
        // Falls back to 0, as for upvotes.
      }
    }
    if (!(neynarScore >= MIN_NEYNAR_SCORE)) {
      return skip(`score ${neynarScore} below ${MIN_NEYNAR_SCORE}`);
    }

    const key = `${identity.toLowerCase()}|${community.id}`;
    if (!joinWindow.hit(key).allowed) {
      return skip("the same person joined again within the window");
    }

    const url = `https://news.kiwistand.com/c/${community.id}`;
    const title = "New member"; // Max 32 chars for Farcaster
    const body = `${ensData.displayName} joined ${community.name}`;
    const receivers = [owner];

    let targetFids = [];
    try {
      targetFids = await d.getFids(receivers);
    } catch (err) {
      log(`Failed to get FIDs for join Neynar notifications: ${err}`);
    }
    if (targetFids.length > 0 && env.NODE_ENV === "production") {
      try {
        await d.sendNeynar(url, body.substring(0, 128), title, targetFids);
      } catch (err) {
        log(`Failed to send join Neynar notification: ${err}`);
      }
    }

    try {
      await d.sendPush(receivers, { title, body, url });
    } catch (err) {
      log(`Failed to send join OneSignal notification: ${err}`);
    }
    return { sent: { receivers, title, body, url }, reason: null };
  } catch (err) {
    log(`Error in triggerJoinNotification: ${err}`);
    return { sent: null, reason: err.toString() };
  }
}
