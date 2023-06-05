// @format
import { fetchBuilder, MemoryCache } from "node-fetch-cache";
import normalizeUrl from "normalize-url";

import * as id from "../id.mjs";
import log from "../logger.mjs";

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

export async function getBanlist() {
  let addrResponse;
  try {
    addrResponse = await getConfig("banlist_addresses");
  } catch (err) {
    log(`banlist_addresses: Couldn't get config: ${err.toString()}`);
    return {
      addresses: [],
      links: [],
    };
  }
  const addresses = addrResponse.map(({ address }) => address.toLowerCase());

  let linkResponse;
  try {
    linkResponse = await getConfig("banlist_links");
  } catch (err) {
    log(`banlist_links: Couldn't get config: ${err.toString()}`);
    return {
      addresses: [],
      links: [],
    };
  }
  const links = linkResponse.map(({ link }) => normalizeUrl(link));
  return {
    addresses,
    links,
  };
}

export function moderate(leaves, config) {
  const cacheEnabled = true;
  return leaves
    .map((leaf) => ({
      address: id.ecrecover(leaf, cacheEnabled),
      ...leaf,
    }))
    .filter(({ address }) => !config.addresses.includes(address.toLowerCase()))
    .filter(({ href }) => !config.links.includes(normalizeUrl(href)));
}
