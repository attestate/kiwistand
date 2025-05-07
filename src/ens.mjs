import { env } from "process";
import path from "path";

import DOMPurify from "isomorphic-dompurify";
import { fetchBuilder, FileSystemCache } from "node-fetch-cache";
import { providers, utils } from "ethers";

import { allowlist } from "./chainstate/registry.mjs";
import { fetchCache } from "./utils.mjs";
import cache from "./cache.mjs";
import log from "./logger.mjs";

const provider = new providers.JsonRpcProvider(env.RPC_HTTP_HOST);

const fsCache = new FileSystemCache({
  cacheDirectory: path.resolve(env.CACHE_DIR),
  ttl: 86400000 * 5, // 72 hours
});
const fetch = fetchBuilder.withCache(fsCache);
const fetchStaleWhileRevalidate = fetchCache(fetch, fsCache);

export async function toAddress(name) {
  const address = await provider.resolveName(name);
  if (address) return address;
  throw new Error("Couldn't convert to address");
}

async function fetchLensData(address) {
  try {
    utils.getAddress(address);
  } catch (err) {
    return;
  }
  const query = `
     query {
       profiles(request: {
         where: {
           ownedBy: ["${address}"]
         }
       }) {
         items {
           id,
           handle {
             fullHandle
           },
           metadata {
             bio,
             displayName,
             picture {
               ... on ImageSet {
                 optimized {
                   uri
                 }
               }
             }
           }
         }
       }
     }
   `;

  let response;
  try {
    const signal = AbortSignal.timeout(5000);
    response = await fetchStaleWhileRevalidate("https://api-v2.lens.dev/", {
      signal,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });
  } catch (err) {
    return;
  }

  let data;
  try {
    const result = await response.json();
    data = result.data;
  } catch (err) {
    return;
  }
  if (!data || !data.profiles.items.length) return;

  const { id, handle, metadata } = data.profiles.items[0];
  return {
    id,
    username: handle?.fullHandle,
    bio: metadata?.bio,
    displayName: metadata?.displayName,
    avatar: metadata?.picture?.optimized?.uri,
  };
}

export async function fetchENSData(address) {
  const endpoint = "https://api.ensdata.net/";

  try {
    let url = `${endpoint}${address}?farcaster=true`;
    if (env.ENSDATA_KEY) {
      // NOTE: If you're coming across this environment variable and you're
      // wondering why it wasn't documented, this is because its only meant to be
      // used by the Kiwi News production server.
      url += `&special=env.ENSDATA_KEY`;
    }

    const signal = AbortSignal.timeout(5000);
    const response = await fetchStaleWhileRevalidate(url, { signal });
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

// Create a prefix for ENS cache entries to ensure uniqueness
export const ENS_CACHE_PREFIX = "ens-profile-";

export async function resolve(address) {
  // Create a unique cache key with prefix to avoid collisions
  const cacheKey = `${ENS_CACHE_PREFIX}${address.toLowerCase()}`;

  // Check if we have the data in cache
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  // Create minimal profile for immediate return
  const truncatedAddress =
    address.slice(0, 6) +
    "..." +
    address.slice(address.length - 4, address.length);
  const minimalProfile = {
    address,
    truncatedAddress,
    displayName: truncatedAddress,
    safeAvatar: null,
  };

  // Trigger background fetch and update cache when done - don't await
  (async () => {
    try {
      const ensProfile = await fetchENSData(address);
      const lensProfile = await fetchLensData(address);

      let safeAvatar = ensProfile.avatar_small
        ? ensProfile.avatar_small
        : ensProfile.avatar;
      if (safeAvatar && !safeAvatar.startsWith("https")) {
        safeAvatar = ensProfile.avatar_url;
      }
      if (!safeAvatar && ensProfile?.farcaster?.avatar) {
        safeAvatar = ensProfile.farcaster.avatar;
      }
      if (!safeAvatar && lensProfile?.avatar) {
        safeAvatar = lensProfile.avatar;
      }

      let displayName = DOMPurify.sanitize(ensProfile.ens);
      if (!displayName && ensProfile?.farcaster?.username) {
        displayName = `@${DOMPurify.sanitize(ensProfile.farcaster.username)}`;
      }
      if (!displayName && lensProfile?.username) {
        displayName = `${DOMPurify.sanitize(lensProfile.username)}`;
      }
      if (!displayName) {
        displayName = ensProfile.truncatedAddress;
      }

      const completeProfile = {
        safeAvatar: DOMPurify.sanitize(safeAvatar),
        ...ensProfile,
        lens: lensProfile,
        displayName,
      };

      // Update cache with complete profile
      cache.set(cacheKey, completeProfile);
      log(`Updated ENS cache for ${address}`);
    } catch (err) {
      log(`Background ENS resolution failed for ${address}: ${err}`);
    }
  })().catch((err) => log(`Error in ENS background fetch: ${err}`));

  // Return minimal profile immediately
  return minimalProfile;
}
