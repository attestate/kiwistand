// @format
import path from "path";
import { env } from "process";

import { fetchBuilder, FileSystemCache } from "node-fetch-cache";
import normalizeUrl from "normalize-url";

import * as id from "../id.mjs";
import log from "../logger.mjs";
import { EIP712_MESSAGE } from "../constants.mjs";
import { fetchCache } from "../utils.mjs";

const oneSec = 1000;
const cache = new FileSystemCache({
  cacheDirectory: path.resolve(env.CACHE_DIR, "newcache"),
  ttl: oneSec * 60 * 1, // 1min
});
const fetch = fetchBuilder.withCache(cache);
const fetchStaleWhileRevalidate = fetchCache(fetch, cache);

const url =
  "https://opensheet.elk.sh/1kh9zHwzekLb7toabpdSfd87pINBpyVU6Q8jLliBXtEc/";
export async function getConfig(sheet) {
  const signal = AbortSignal.timeout(10000);
  const response = await fetchStaleWhileRevalidate(url + sheet, { signal });
  if (response.ok) {
    return await response.json();
  } else {
    throw new Error("Couldn't convert to JSON");
  }
}

export async function getActiveCanons() {
  let response;
  try {
    response = await getConfig("active_canons");
  } catch (err) {
    log(`active_canons: Couldn't get config: ${err.toString()}`);
    return ["publicgoods", "protocols", "farcaster"];
  }
  const links = response.map(({ canon }) => canon);
  return links;
}

export async function getFeedParameters() {
  const defaultFeedParams = {
    replacementFactor: 3,
    oldHours: 22,
    fold: 10,
    replacementThreshold: 1,
    decayStrength: 1,
  };
  let response;
  try {
    response = await getConfig("feed_parameters");
  } catch (err) {
    return defaultFeedParams;
  }

  if (response.length === 0) {
    return defaultFeedParams;
  }
  const {
    replacementFactor,
    replacementThreshold,
    oldHours,
    fold,
    decayStrength,
  } = response[0];
  return {
    replacementFactor: parseInt(replacementFactor, 10),
    oldHours: parseInt(oldHours, 10),
    fold: parseInt(fold, 10),
    replacementThreshold: parseInt(replacementThreshold, 10),
    decayStrength: parseFloat(decayStrength),
  };
}

export async function getFeeds() {
  const feeds = [];

  let response;
  try {
    response = await getConfig("feeds");
  } catch (err) {
    return feeds;
  }
  response.forEach(({ url }) => {
    feeds.push(url);
  });
  return feeds;
}

export async function getWriters() {
  const writers = {};

  let response;
  try {
    response = await getConfig("writers");
  } catch (err) {
    return writers;
  }
  response.forEach(({ domain, address }) => {
    writers[normalizeUrl(domain)] = address;
  });
  return writers;
}

export async function getLists() {
  // Parallelize all getConfig calls
  const [
    linksResult,
    imagesResult,
    titlesResult,
    hrefsResult,
    profilesResult
  ] = await Promise.allSettled([
    getConfig("banlist_links"),
    getConfig("banlist_images"),
    getConfig("moderation_titles"),
    getConfig("moderation_hrefs"),
    getConfig("banlist_profiles")
  ]);

  // Process results
  let links = [];
  if (linksResult.status === "fulfilled") {
    links = linksResult.value.map(({ link }) => normalizeUrl(link));
  } else {
    log(`banlist_links: Couldn't get config: ${linksResult.reason}`);
  }

  let images = [];
  if (imagesResult.status === "fulfilled") {
    images = imagesResult.value.map(({ link }) =>
      normalizeUrl(link, { stripWWW: false }),
    );
  } else {
    log(`banlist_images: Couldn't get config: ${imagesResult.reason}`);
  }

  let titles = {};
  if (titlesResult.status === "fulfilled") {
    for (let obj of titlesResult.value) {
      if (!obj.link || !obj.title) continue;
      titles[normalizeUrl(obj.link)] = obj.title;
    }
  } else {
    log(`moderation_titles: Couldn't get config: ${titlesResult.reason}`);
  }

  let hrefs = {};
  if (hrefsResult.status === "fulfilled") {
    for (let obj of hrefsResult.value) {
      if (!obj.old || !obj.new) continue;
      hrefs[normalizeUrl(obj.old)] = normalizeUrl(obj.new);
    }
  } else {
    log(`moderation_hrefs: Couldn't get config: ${hrefsResult.reason}`);
  }

  let profiles = [];
  if (profilesResult.status === "fulfilled") {
    profiles = profilesResult.value.map(({ profile }) => {
      // Extract address from profile URL like https://news.kiwistand.com/upvotes?address=0x...
      const url = new URL(profile);
      const address = url.searchParams.get('address');
      return address ? address.toLowerCase() : null;
    }).filter(Boolean);
  } else {
    log(`banlist_profiles: Couldn't get config: ${profilesResult.reason}`);
  }

  // Use profiles as the addresses banlist
  const addresses = profiles;

  const result = {
    pinned: [],  // Empty for backward compatibility
    hrefs,
    messages: [],  // Empty for backward compatibility
    titles,
    addresses,
    links,
    images,
    labels: {},  // Empty for backward compatibility
    profiles,
  };

  return result;
}

// Singleton cache for story page moderation config
let storyConfigCache = null;
let lastStoryConfigFetch = 0;
const CACHE_TTL = 60000; // 1 minute

// Internal function to fetch and process config
async function fetchStoryConfig() {
  // Parallelize only the necessary calls for story pages
  const [
    titlesResult,
    hrefsResult,
    profilesResult
  ] = await Promise.allSettled([
    getConfig("moderation_titles"),
    getConfig("moderation_hrefs"),
    getConfig("banlist_profiles")
  ]);

  // Process results
  let titles = {};
  if (titlesResult.status === "fulfilled") {
    for (const { title } of titlesResult.value) {
      const [word, action] = title.split(":").map((str) => str.trim());
      if (!titles[word]) titles[word] = [];
      if (action) titles[word].push(action);
    }
  } else {
    log(`moderation_titles: Couldn't get config: ${titlesResult.reason}`);
  }

  let hrefs = {};
  if (hrefsResult.status === "fulfilled") {
    for (const obj of hrefsResult.value) {
      hrefs[normalizeUrl(obj.old)] = normalizeUrl(obj.new);
    }
  } else {
    log(`moderation_hrefs: Couldn't get config: ${hrefsResult.reason}`);
  }

  let profiles = [];
  if (profilesResult.status === "fulfilled") {
    profiles = profilesResult.value.map(({ profile }) => {
      // Extract address from profile URL like https://news.kiwistand.com/upvotes?address=0x...
      const url = new URL(profile);
      const address = url.searchParams.get('address');
      return address ? address.toLowerCase() : null;
    }).filter(Boolean);
  } else {
    log(`banlist_profiles: Couldn't get config: ${profilesResult.reason}`);
  }

  // Use profiles as the addresses banlist
  const addresses = profiles;

  return {
    pinned: [],  // Empty for backward compatibility
    hrefs,
    messages: [],  // Empty for backward compatibility
    titles,
    addresses,
    links: [], // Empty for story pages
    images: [], // Empty for story pages
    labels: {},  // Empty for backward compatibility
    profiles,
  };
}

// Lightweight version for story pages (only fetches what's needed)
// Uses singleton pattern with background refresh
export async function getListsForStory() {
  const now = Date.now();
  const needsRefresh = now - lastStoryConfigFetch > CACHE_TTL;

  if (!storyConfigCache) {
    // First call ever: block and fetch
    storyConfigCache = await fetchStoryConfig();
    lastStoryConfigFetch = now;
  } else if (needsRefresh) {
    // Has cache but stale: return cached, refresh in background
    fetchStoryConfig()
      .then((config) => {
        storyConfigCache = config;
        lastStoryConfigFetch = Date.now();
      })
      .catch((err) => {
        log(`Background refresh of story config failed: ${err.toString()}`);
      });
  }

  return storyConfigCache;
}

export function flag(leaves, config) {
  return leaves.map((leaf) => {
    // Messages removed from config, return leaves as-is
    const flag = config.messages?.find?.(
      ({ index }) => index === `0x${leaf.index}`,
    );
    if (flag) {
      leaf.flagged = true;
      leaf.reason = flag.reason;
    }
    return leaf;
  });
}

export function moderate(leaves, config, path) {
  let result = leaves
    .map((leaf) => {
      // Skip normalization for text posts and kiwi references
      const normalizedLeafHref = (leaf.href.startsWith('data:') || leaf.href.startsWith('kiwi:'))
        ? leaf.href
        : normalizeUrl(leaf.href);

      const alternativeTitle = config.titles[normalizedLeafHref];
      const nextTitle = alternativeTitle ? alternativeTitle : leaf.title;

      const alternativeHref = config.hrefs[normalizedLeafHref];
      const nextHref = alternativeHref ? alternativeHref : leaf.href;

      return {
        ...leaf,
        href: nextHref,
        title: nextTitle,
      };
    })
    // TODO: Should start using ethers.utils.getAddress
    .filter(
      ({ identity }) => !config.addresses.includes(identity.toLowerCase()),
    )
    .filter(({ href }) => {
      // Skip normalization for text posts and kiwi references
      const normalizedHref = (href.startsWith('data:') || href.startsWith('kiwi:'))
        ? href
        : normalizeUrl(href);
      return !config.links.includes(normalizedHref);
    });

  // NOTE: When we change the URL of a story then any upvoter who upvotes the
  // story after the moderation will, for the first time, upvote a new link
  // which will then appear as a new submission on the new page. So as to avoid
  // this, for the /new page, we're removing all values from the "new" column
  // of the "moderation_hrefs" table
  if (path === "/new") {
    result = result.filter(
      ({ href }) => {
        // Skip normalization for text posts and kiwi references
        const normalizedHref = (href.startsWith('data:') || href.startsWith('kiwi:'))
          ? href
          : normalizeUrl(href);
        return !Object.values(config.hrefs).includes(normalizedHref);
      },
    );
  }
  result = result.map((leaf) => {
    // Skip normalization for text posts and kiwi references
    const norm = (leaf.href.startsWith('data:') || leaf.href.startsWith('kiwi:'))
      ? leaf.href
      : normalizeUrl(leaf.href, { stripWWW: false });
    return { ...leaf, label: (config.labels && config.labels[norm]) || "" };
  });
  return result;
}

export async function getLabels() {
  let labelsMapping = {};
  try {
    const response = await getConfig("labels");
    response.forEach(({ links, labels }) => {
      labelsMapping[normalizeUrl(links, { stripWWW: false })] = labels;
    });
  } catch (err) {
    log(`labels: Couldn't get labels: ${err.toString()}`);
  }
  return labelsMapping;
}
