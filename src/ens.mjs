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
    ttl: 86400000 * 3, // 72 hours
  }),
);

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
    const response = await fetch(`${endpoint}${address}?farcaster=true`);
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

    // NOTE: We used to have a function fetchFCData that would add the fields
    // {bio,displayName,username,avatar} to the ENS object and so to preserve
    // the ens module's expected returned value, we're now backfilling these
    // values even though fetchFCData doesn't exist anymore.
    if (data?.farcaster?.profile?.bio?.text) {
      data.farcaster.bio = data.farcaster.profile.bio.text;
    }
    if (data?.farcaster?.display_name) {
      data.farcaster.displayName = data.farcaster.display_name;
    }
    if (data?.farcaster?.pfp_url) {
      data.farcaster.avatar = data.farcaster.pfp_url;
    }

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

  let safeAvatar = ensProfile.avatar;
  if (safeAvatar && !safeAvatar.startsWith("https")) {
    safeAvatar = ensProfile.avatar_url;
  }
  if (!safeAvatar && ensProfile?.farcaster?.avatar) {
    safeAvatar = ensProfile.farcaster.avatar;
  }

  let displayName = DOMPurify.sanitize(ensProfile.ens);
  if (!displayName && ensProfile?.farcaster?.username) {
    displayName = `@${DOMPurify.sanitize(ensProfile.farcaster.username)}`;
  }
  if (!displayName) {
    displayName = ensProfile.truncatedAddress;
  }
  const profile = {
    safeAvatar: DOMPurify.sanitize(safeAvatar),
    ...ensProfile,
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
