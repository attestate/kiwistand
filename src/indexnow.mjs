// @format
//
// Tells IndexNow (Bing, Yandex, Seznam, Naver, ...) about new stories right
// after this node accepts them. It only runs with NODE_ENV=production, so dev
// nodes don't submit URLs of local test stories. api.mjs queues submissions
// accepted through this node's own API, never messages synced from peers.
// https://www.indexnow.org/documentation
import { env } from "process";

import log from "./logger.mjs";
import { getSlug } from "./utils.mjs";
import { isBlocked } from "./linksafety.mjs";
import { getLists, moderate } from "./views/moderation.mjs";

const HOST = "news.kiwistand.com";
const ENDPOINT = "https://api.indexnow.org/indexnow";
const FLUSH_DELAY = 60 * 1000;

let pending = [];
let timer;

// NOTE: Not a secret: IndexNow verifies that we own the host by fetching
// src/public/<KEY>.txt, which has to contain the key.
export const KEY = "b9674842be5435a92ee561b3b4db5b59";

export function key() {
  return env.NODE_ENV === "production" ? KEY : null;
}

// NOTE: Must match the story URLs in sitemap.mjs.
export function storyUrl({ title, index }) {
  return `https://${HOST}/stories/${getSlug(title)}?index=0x${index}`;
}

export function queue(story) {
  if (!key()) return;
  // NOTE: Starts the ChainPatrol check now so that its verdict is cached by
  // the time we flush.
  isBlocked(story.href);
  pending.push(story);
  if (!timer) {
    timer = setTimeout(() => flush(), FLUSH_DELAY);
    timer.unref();
  }
}

// Drops stories that moderation or ChainPatrol hides from the feeds.
async function visible(stories) {
  const kept = new Set(moderate(stories, await getLists()).map((s) => s.index));
  return stories.filter(({ index }) => kept.has(index));
}

export async function flush(filter = visible) {
  clearTimeout(timer);
  timer = undefined;
  const stories = pending;
  pending = [];
  const indexNowKey = key();
  if (!indexNowKey || stories.length === 0) return;

  try {
    const urlList = (await filter(stories)).map(storyUrl);
    if (urlList.length === 0) return;
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: HOST,
        key: indexNowKey,
        keyLocation: `https://${HOST}/${indexNowKey}.txt`,
        urlList,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    log(`indexnow: submitted ${urlList.length} url(s)`);
  } catch (err) {
    log(`indexnow: submission failed: ${err.message}`);
  }
}
