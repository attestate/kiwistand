import { env } from "process";
import path from "path";
import DOMPurify from "isomorphic-dompurify";

import { fetchBuilder, FileSystemCache } from "node-fetch-cache";
import { allowlist } from "./chainstate/registry.mjs";
import { providers, utils } from "ethers";

const provider = new providers.JsonRpcProvider(env.RPC_HTTP_HOST);

const fetch = fetchBuilder.withCache(
  new FileSystemCache({
    cacheDirectory: path.resolve(env.CACHE_DIR),
    ttl: 86400000, // 24 hours
  }),
);

async function fetchFCData(address) {
  let response;
  try {
    response = await fetch(
      `https://api.phyles.xyz/v0/farcaster/users?address=${address.toLowerCase()}`,
    );
  } catch (err) {
    return;
  }
  let data;
  try {
    data = await response.json();
  } catch (err) {
    return;
  }
  if (
    data.error === "User not found" ||
    (data.users && Array.isArray(data.users) && data.users.length !== 1)
  )
    return;

  const { bio, display_name, pfp, username } = data.users[0];

  return {
    bio,
    displayName: display_name,
    avatar: pfp,
    username,
  };
}

export async function toAddress(name) {
  const address = await provider.resolveName(name);
  if (address) return address;
  throw new Error("Couldn't convert to address");
}

async function fetchENSData(address) {
  let endpoint = "https://ensdata.net/";
  if (env.ENSDATA_KEY) {
    // NOTE: If you're coming across this environment variable and you're
    // wondering why it wasn't documented, this is because its only meant to be
    // used by the Kiwi News production server.
    endpoint += env.ENSDATA_KEY + "/";
  }

  try {
    const response = await fetch(`${endpoint}${address}`);
    const data = await response.json();

    try {
      utils.getAddress(address);
    } catch (err) {
      if (data && data.address) {
        address = data.address;
      }
    }

    const truncatedAddress =
      address.slice(0, 6) +
      "..." +
      address.slice(address.length - 4, address.length);

    const displayName = data.ens ? data.ens : truncatedAddress;

    return {
      ...data,
      address,
      displayName,
      truncatedAddress,
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
  const ensProfile = await fetchENSData(address);
  const fcProfile = await fetchFCData(ensProfile.address);

  let safeAvatar = ensProfile.avatar;
  if (safeAvatar && !safeAvatar.startsWith("https")) {
    safeAvatar = ensProfile.avatar_url;
  }
  if (!safeAvatar && fcProfile && fcProfile.avatar) {
    safeAvatar = fcProfile.avatar;
  }

  let displayName = DOMPurify.sanitize(ensProfile.ens);
  if (!displayName && fcProfile && fcProfile.username) {
    displayName = `@${DOMPurify.sanitize(fcProfile.username)}`;
  }
  if (!displayName) {
    displayName = ensProfile.truncatedAddress;
  }
  const profile = {
    safeAvatar: DOMPurify.sanitize(safeAvatar),
    ...ensProfile,
    farcaster: fcProfile,
    displayName,
  };
  return profile;
}

async function initializeCache() {
  let addresses = Array.from(await allowlist());
  while (addresses.length === 0) {
    await new Promise((r) => setTimeout(r, 5000)); // wait for 5 seconds
    addresses = await allowlist();
  }

  if (addresses && Array.isArray(addresses)) {
    const promises = addresses.map(async (address) => {
      const profile = await resolve(address);
      if (profile && profile.ens) {
        try {
          await toAddress(profile.ens);
        } catch (err) {
          // ignore error
        }
      }
    });

    await Promise.allSettled(promises);
  }
}

// NOTE: For nodes that have never downloaded and committed all addresses into
// LMDB during their first crawl, it may be that this function is launched and
// then initializeCache's `let addresses = Array.from(await allowlist());` will
// unexpectedly throw because it should wait for allowlist to be crawled at
// least onceit should wait for allowlist to be crawled at least once
if (env.NODE_ENV === "production") {
  setTimeout(initializeCache, 30000);
}
