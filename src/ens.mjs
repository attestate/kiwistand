import { fetchBuilder, MemoryCache } from "node-fetch-cache";
import { allowlist } from "./chainstate/registry.mjs";

const fetch = fetchBuilder.withCache(
  new MemoryCache({
    ttl: 86400000, // 24 hours
  })
);

async function fetchENSData(address) {
  try {
    const response = await fetch(`https://ensdata.net/${address}`);
    const data = await response.json();

    const truncatedAddress =
      address.slice(0, 6) +
      "..." +
      address.slice(address.length - 4, address.length);

    // If ENS name exists, use it, otherwise use the truncated address
    const displayName = data.ens ? data.ens : truncatedAddress;

    // Add displayName and the original address to the returned object
    return {
      ...data,
      address,
      displayName,
    };
  } catch (error) {
    console.error(`Failed to fetch ENS data for address: ${address}`, error);

    const truncatedAddress =
      address.slice(0, 6) +
      "..." +
      address.slice(address.length - 4, address.length);

    // Include the address in the returned error object
    return {
      error: true,
      message: `Unable to resolve ${address} because it’s not registered on the Ethereum Name Service or is not linked to an Ethereum address.`,
      address,
      truncatedAddress,
      displayName: truncatedAddress,
    };
  }
}

export async function resolve(address) {
  // fetchENSData will return the cached data if it exists, or fetch it if it doesn't
  return await fetchENSData(address);
}

async function initializeCache() {
  let addresses = Array.from(await allowlist());
  while (addresses.length === 0) {
    await new Promise((r) => setTimeout(r, 5000)); // wait for 5 seconds
    addresses = await allowlist();
  }

  await Promise.all(addresses.map(resolve));
}

// NOTE: For nodes that have never downloaded and committed all addresses into
// LMDB during their first crawl, it may be that this function is launched and
// then initializeCache's `let addresses = Array.from(await allowlist());` will
// unexpectedly throw because it should wait for allowlist to be crawled at
// least onceit should wait for allowlist to be crawled at least once
setTimeout(initializeCache, 10000);
