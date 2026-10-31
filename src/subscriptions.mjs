import { env } from "process";

import { resolveIdentity } from "@attestate/delegator2";

import log from "./logger.mjs";
import { getSubmission } from "./cache.mjs";
import { verify } from "./id.mjs";
import { resolve, fetchENSData } from "./ens.mjs";
import * as email from "./email.mjs";
import { truncateComment } from "./views/activity.mjs";
import { getSlug } from "./utils.mjs";
import { sendNotification, getFidsFromAddresses } from "./neynar.mjs";
import * as moderation from "./views/moderation.mjs";
import { sendPushNotification } from "./onesignal.mjs";

const upvoteDefaults = {
  getSubmission: (index, href) => getSubmission(index, href),
  getLists: () => moderation.getLists(),
  resolve: (address) => resolve(address),
  fetchENSData: (address) => fetchENSData(address),
  getFids: (addresses) => getFidsFromAddresses(addresses),
  sendNeynar: (url, body, title, fids) =>
    sendNotification(url, body, title, fids),
  sendPush: (addresses, notification) =>
    sendPushNotification(addresses, notification),
};

// Tells a story's author that someone upvoted it.
//
// NOTE: `message.identity` is the upvoter when the caller knows it (the mini
// app's upvotes, http.mjs). A protocol message from POST /api/v1/messages
// (api.mjs) doesn't have it, as the schema doesn't allow the field, so the
// upvoter is the identity its signer resolves to through `delegations`: an
// upvote signed with a delegated key comes from the account.
export async function triggerUpvoteNotification(
  message,
  delegations = {},
  deps = {},
) {
  if (message.type !== "amplify") return;
  const d = { ...upvoteDefaults, ...deps };

  try {
    const upvoter =
      message.identity ?? resolveIdentity(delegations, verify(message));

    // Get the submission that was upvoted
    const submission = d.getSubmission(null, message.href);
    if (!submission || !submission.identity) return;

    // Don't notify if the upvoter is the author (a submission is its
    // author's first upvote)
    if (upvoter.toLowerCase() === submission.identity.toLowerCase()) return;

    // Banned users can neither send nor receive notifications
    let bannedAddresses = [];
    try {
      const policy = await d.getLists();
      bannedAddresses = policy.addresses || [];
    } catch (err) {
      log(`Failed to get banned addresses for upvote notification filtering: ${err}`);
    }
    if (bannedAddresses.includes(upvoter.toLowerCase())) return;

    // Get upvoter's display name and try to determine Neynar score
    const ensData = await d.resolve(upvoter);
    if (!ensData.displayName) return;

    // Determine Neynar quality score for the upvoter
    const MIN_NEYNAR_SCORE = parseFloat(env.MIN_NEYNAR_SCORE || "0.7");
    let neynarScore = typeof ensData.neynarScore === "number" ? ensData.neynarScore : 0;

    // If score is not known from cache, try fetching richer ENS/Neynar data
    if (!neynarScore || Number.isNaN(neynarScore)) {
      try {
        const richProfile = await d.fetchENSData(upvoter.toLowerCase());
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
        `Skipping Neynar upvote notification: score ${neynarScore} below threshold ${MIN_NEYNAR_SCORE} for ${upvoter}`,
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
      targetFids = await d.getFids(receivers);
    } catch (err) {
      log(`Failed to get FIDs for upvote Neynar notifications: ${err}`);
    }

    // Send Neynar notification if we have FID (production only)
    if (targetFids.length > 0 && env.NODE_ENV === "production") {
      try {
        const fcTitle = "New like"; // Max 32 chars
        const fcBody = `${ensData.displayName} upvoted: ${submission.title.substring(0, 128 - ensData.displayName.length - 11)}`; // Max 128 chars total
        
        await d.sendNeynar(url, fcBody, fcTitle, targetFids);
        log(`Sent upvote Neynar notification to FID ${targetFids[0]}`);
      } catch (err) {
        log(`Failed to send upvote Neynar notification: ${err}`);
      }
    }

    // Send OneSignal push notification for upvote
    try {
      await d.sendPush(receivers, {
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
