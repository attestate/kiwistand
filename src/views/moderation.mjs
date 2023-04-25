// @format
import { fetchBuilder, MemoryCache } from "node-fetch-cache";
import normalizeUrl from "normalize-url";

import * as id from "../id.mjs";
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

export async function getBanlist() {
  const addrResponse = await getConfig("banlist_addresses");
  const addresses = addrResponse.map(({ address }) => address.toLowerCase());

  const linkResponse = await getConfig("banlist_links");
  const links = linkResponse.map(({ link }) => normalizeUrl(link));
  return {
    addresses,
    links,
  };
}

// TODO: In different views, sometimes this moderation function is used to
// generate the addresses of a poster, and sometimes id.ecrecover is used
// directly (e.g. for index.mjs, we add them in the editor picks).
export function moderate(leaves, config) {
  return leaves
    .map((leaf) => ({
      address: id.ecrecover(leaf, EIP712_MESSAGE),
      ...leaf,
    }))
    .filter(({ address }) => !config.addresses.includes(address.toLowerCase()))
    .filter(({ href }) => !config.links.includes(normalizeUrl(href)));
}
