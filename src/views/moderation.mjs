// @format
import { fetchBuilder, MemoryCache } from "node-fetch-cache";
import normalizeUrl from "normalize-url";

import * as id from "../id.mjs";
import log from "../logger.mjs";
import { EIP712_MESSAGE } from "../constants.mjs";

const fetch = fetchBuilder.withCache(
  new MemoryCache({
    ttl: 60000, // 1min
  })
);

const url =
  "https://opensheet.elk.sh/1kh9zHwzekLb7toabpdSfd87pINBpyVU6Q8jLliBXtEc/";
export async function getConfig(sheet) {
  const response = await fetch(url + sheet);
  if (response.ok) {
    return await response.json();
  } else {
    throw new Error("Couldn't convert to JSON");
  }
}

export async function getLists() {
  const defaultObj = {
    addresses: [],
    titles: {},
    links: [],
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
    titles[normalizeUrl(obj.link)] = obj.title;
  }
  return {
    titles,
    addresses,
    links,
  };
}

export function moderate(leaves, config) {
  return (
    leaves
      .map((leaf) => {
        const alternativeTitle = config.titles[normalizeUrl(leaf.href)];
        const nextTitle = alternativeTitle ? alternativeTitle : leaf.title;

        const cacheEnabled = true;
        return {
          ...leaf,
          address: id.ecrecover(leaf, EIP712_MESSAGE, cacheEnabled),
          title: nextTitle,
        };
      })
      // TODO: Should start using ethers.utils.getAddress
      .filter(
        ({ address }) => !config.addresses.includes(address.toLowerCase())
      )
      .filter(({ href }) => !config.links.includes(normalizeUrl(href)))
  );
}
