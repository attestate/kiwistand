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
  ttl: oneSec * 60 * 5, // 5min
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

// Cache for moderation lists in dev mode
let moderationCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getLists() {
  // Use cache in dev mode
  if (env.NODE_ENV === "dev" && moderationCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return moderationCache;
  }

  // Parallelize all getConfig calls
  const [
    pinnedResult,
    addressesResult,
    linksResult,
    imagesResult,
    titlesResult,
    hrefsResult,
    messagesResult,
    labelsResult,
    profilesResult
  ] = await Promise.allSettled([
    getConfig("pinned"),
    getConfig("banlist_addresses"),
    getConfig("banlist_links"),
    getConfig("banlist_images"),
    getConfig("moderation_titles"),
    getConfig("moderation_hrefs"),
    getConfig("banlist_messages"),
    getLabels(),
    getConfig("banlist_profiles")
  ]);

  // Process results
  let pinned = [];
  if (pinnedResult.status === "fulfilled") {
    pinned = pinnedResult.value.map(({ link }) =>
      normalizeUrl(link, { stripWWW: false }),
    );
  } else {
    log(`pinned: Couldn't get config: ${pinnedResult.reason}`);
  }

  let addresses = [];
  if (addressesResult.status === "fulfilled") {
    addresses = addressesResult.value.map(({ address }) => address.toLowerCase());
  } else {
    log(`banlist_addresses: Couldn't get config: ${addressesResult.reason}`);
  }

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

  let messages = [];
  if (messagesResult.status === "fulfilled") {
    messages = messagesResult.value;
  } else {
    log(`banlist_messages: Couldn't get config: ${messagesResult.reason}`);
  }

  let labels = {};
  if (labelsResult.status === "fulfilled") {
    labels = labelsResult.value;
  } else {
    log(`labels: Couldn't get config: ${labelsResult.reason}`);
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

  // Merge profile addresses into the main addresses banlist
  const mergedAddresses = [...new Set([...addresses, ...profiles])];

  const result = {
    pinned,
    hrefs,
    messages,
    titles,
    addresses: mergedAddresses,
    links,
    images,
    labels,
    profiles,
  };

  // Cache result in dev mode
  if (env.NODE_ENV === "dev") {
    moderationCache = result;
    cacheTimestamp = Date.now();
  }

  return result;
}

export function flag(leaves, config) {
  return leaves.map((leaf) => {
    const flag = config.messages.find(
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
      const alternativeTitle = config.titles[normalizeUrl(leaf.href)];
      const nextTitle = alternativeTitle ? alternativeTitle : leaf.title;

      const alternativeHref = config.hrefs[normalizeUrl(leaf.href)];
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
    .filter(({ href }) => !config.links.includes(normalizeUrl(href)));

  // NOTE: When we change the URL of a story then any upvoter who upvotes the
  // story after the moderation will, for the first time, upvote a new link
  // which will then appear as a new submission on the new page. So as to avoid
  // this, for the /new page, we're removing all values from the "new" column
  // of the "moderation_hrefs" table
  if (path === "/new") {
    result = result.filter(
      ({ href }) => !Object.values(config.hrefs).includes(normalizeUrl(href)),
    );
  }
  result = result.map((leaf) => {
    const norm = normalizeUrl(leaf.href, { stripWWW: false });
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
