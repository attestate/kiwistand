// @format
import path from "path";
import { env } from "process";

import { fetchBuilder, FileSystemCache } from "node-fetch-cache";
import normalizeUrl from "normalize-url";

import * as id from "../id.mjs";
import log from "../logger.mjs";
import { EIP712_MESSAGE } from "../constants.mjs";
import { fetchCache } from "../utils.mjs";

const cache = new FileSystemCache({
  cacheDirectory: path.resolve(env.CACHE_DIR),
  ttl: 60000 * 60, // 60min
});
const fetch = fetchBuilder.withCache(cache);
const fetchStaleWhileRevalidate = fetchCache(fetch, cache);

const url =
  "https://opensheet.elk.sh/1kh9zHwzekLb7toabpdSfd87pINBpyVU6Q8jLliBXtEc/";
export async function getConfig(sheet) {
  const signal = AbortSignal.timeout(5000);
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
  const defaultObj = {
    addresses: [],
    titles: {},
    hrefs: {},
    links: [],
    messages: [],
  };

  let addrResponse;
  try {
    addrResponse = await getConfig("banlist_addresses");
  } catch (err) {
    log(`banlist_addresses: Couldn't get config: ${err.toString()}`);
    return defaultObj;
  }
  // TODO: Should start using ethers.utils.getAddress
  const addresses = addrResponse.map(({ address }) => address.toLowerCase());

  let linkResponse;
  try {
    linkResponse = await getConfig("banlist_links");
  } catch (err) {
    log(`banlist_links: Couldn't get config: ${err.toString()}`);
    return defaultObj;
  }
  const links = linkResponse.map(({ link }) => normalizeUrl(link));

  let titleResponse;
  try {
    titleResponse = await getConfig("moderation_titles");
  } catch (err) {
    log(`moderation_titles: Couldn't get config: ${err.toString()}`);
    return defaultObj;
  }
  const titles = {};
  for (let obj of titleResponse) {
    if (!obj.link || !obj.title) continue;
    titles[normalizeUrl(obj.link)] = obj.title;
  }

  let hrefResponse;
  try {
    hrefResponse = await getConfig("moderation_hrefs");
  } catch (err) {
    log(`moderation_hrefs: Couldn't get config: ${err.toString()}`);
    return defaultObj;
  }
  const hrefs = {};
  for (let obj of hrefResponse) {
    if (!obj.old || !obj.new) continue;
    hrefs[normalizeUrl(obj.old)] = normalizeUrl(obj.new);
  }

  let messages;
  try {
    messages = await getConfig("banlist_messages");
  } catch (err) {
    log(`banlist_messages: Couldn't get config: ${err.toString()}`);
    return defaultObj;
  }
  return {
    hrefs,
    messages,
    titles,
    addresses,
    links,
  };
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
  return result;
}
