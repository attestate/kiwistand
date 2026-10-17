// @format
// The aspect ratio of a post's picture, so the feed and story page reserve
// its exact box before it loads (no layout shift) and show it whole.
//
// A post's href only has the picture's URL, so the server measures it once,
// in the background on the first render that needs it, and keeps the size in
// the lifetime cache (SQLite, shared by all processes). Until then the card
// uses a fixed box with the picture cropped to fill it.
import sharp from "sharp";

import { lifetimeCache } from "./cache.mjs";
import log from "./logger.mjs";
import { isPostImage } from "./web/src/post.mjs";
import { sizedImageUrl } from "./views/utils/imageLoading.mjs";

const KEY = "post-image-size:";
const RETRY_MS = 60 * 60 * 1000;
const pending = new Set();
const failed = new Map();

const key = (url) => KEY + url;

// { width, height } or null (unknown yet, or not a post picture).
export function postImageSize(url) {
  if (!isPostImage(url)) return null;
  let size = null;
  try {
    size = lifetimeCache.get(key(url));
  } catch {
    return null;
  }
  if (size && size.width > 0 && size.height > 0) return size;
  measure(url);
  return null;
}

export async function measure(url, fetcher = globalThis.fetch) {
  if (!isPostImage(url) || pending.has(url)) return null;
  const lastFailure = failed.get(url);
  if (lastFailure && Date.now() - lastFailure < RETRY_MS) return null;
  pending.add(url);
  try {
    // NOTE: A scaled-down copy has the same ratio; scale-down never makes a
    // small picture bigger, so its size is also the most it's shown at.
    const response = await fetcher(sizedImageUrl(url, 1200), {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(buffer).metadata();
    const rotated = metadata.orientation >= 5;
    const width = rotated ? metadata.height : metadata.width;
    const height = rotated ? metadata.width : metadata.height;
    if (!width || !height) throw new Error("no dimensions");
    const size = { width, height };
    lifetimeCache.set(key(url), size);
    failed.delete(url);
    return size;
  } catch (err) {
    failed.set(url, Date.now());
    log(`Couldn't measure post picture ${url}: ${err.message}`);
    return null;
  } finally {
    pending.delete(url);
  }
}

// The inline style that gives the picture's box its ratio (see .kn-post-media
// in news.css), or "" for the fixed box.
export function mediaStyle(size) {
  if (!size) return "";
  const width = Math.round(size.width);
  const height = Math.round(size.height);
  const ratio = (width / height).toFixed(4);
  return `--kn-post-ar: ${width} / ${height}; --kn-post-ratio: ${ratio}; --kn-post-w: ${width}px;`;
}
