import { env } from "process";

import { fetchBuilder, MemoryCache } from "node-fetch-cache";
import { allowlist } from "./chainstate/registry.mjs";
import { utils } from "ethers";

const fetch = fetchBuilder.withCache(
  new MemoryCache({
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
  const response = await fetch(`https://ensdata.net/${name}`);
  const data = await response.json();
  if (data && data.address) return data.address;
  throw new Error("Couldn't convert to address");
}

async function fetchENSData(address) {
  try {
    const response = await fetch(`https://ensdata.net/${address}`);
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

  let displayName = ensProfile.ens;
  if (!displayName && fcProfile && fcProfile.username) {
    displayName = `@${fcProfile.username}`;
  }
  if (!displayName) {
    displayName = ensProfile.truncatedAddress;
  }
  const profile = {
    safeAvatar,
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
    for await (const address of addresses) {
      const profile = await resolve(address);
      if (profile && profile.ens) {
        try {
          await toAddress(profile.ens);
        } catch (err) {}
      }
    }
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
