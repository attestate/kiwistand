// @format
//
// How the preview audits score a link preview (shared by
// preview-audit.mjs and preview-audit-http.mjs, so both measure the same).
import { setTimeout as sleep } from "timers/promises";

import { isGenericImage, isGenericTitle, twitterFrontends } from "../src/parser.mjs";

export function hostOf(href) {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "invalid-url";
  }
}

export function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    sleep(ms).then(() => {
      throw new Error(`Audit timeout after ${ms}ms`);
    }),
  ]);
}

// A preview is "good" when it renders as an embed (tweet, cast, Bluesky
// post, or an image post uploaded to Kiwi, which the site shows as the image
// itself) or has an image that isn't a Cloudflare challenge page.
export function score(href, data) {
  const host = hostOf(href);
  const isTweet = twitterFrontends.includes(host) || host === "firefly.social";
  const embed = Boolean(
    data.farcasterCast ||
      data.blueskyPost ||
      data.isXArticle ||
      host === "imagedelivery.net" ||
      (isTweet && data.ogDescription),
  );
  const title = Boolean(data.ogTitle) && !isGenericTitle(data.ogTitle, host);
  // A site-wide logo (see isGenericImage) doesn't count as an image, whichever
  // parser produced it.
  const image = Boolean(data.image) && !isGenericImage(data.image);
  const description = Boolean(data.ogDescription);
  const cloudflare = Boolean(data.isCloudflareChallenge);
  const good = embed || (image && !cloudflare);

  const failures = [];
  if (cloudflare) failures.push("cloudflare");
  if (!embed && !title) failures.push("no_title");
  if (!embed && !image) failures.push("no_image");
  if (!embed && !description) failures.push("no_description");
  return { good, embed, title, image, description, cloudflare, failures };
}
