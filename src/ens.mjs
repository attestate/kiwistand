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
const cachedFetch = fetchBuilder.withCache(fsCache);
const fetchStaleWhileRevalidate = fetchCache(cachedFetch, fsCache);

export async function toAddress(name) {
  const address = await provider.resolveName(name);
  if (address) return address;
  throw new Error("Couldn't convert to address");
}

async function fetchNeynarData(address, forceFetch) {
  try {
    utils.getAddress(address);
  } catch (err) {
    return;
  }

  if (!env.NEYNAR_API_KEY) {
    return;
  }

  try {
    const url = `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${address}`;
    const signal = AbortSignal.timeout(5000);
    const fetchFn = forceFetch ? fetch : fetchStaleWhileRevalidate;
    const response = await fetchFn(url, {
      signal,
      headers: {
        "x-api-key": env.NEYNAR_API_KEY,
      },
    });

    if (!response.ok) {
      // Silently handle rate limits - they're expected
      if (response.status === 429) {
        // Rate limited
      }
      return;
    }

    const data = await response.json();

    // API returns data in format: {"0x...": [user_object]}
    const userData = data[address.toLowerCase()];
    if (!userData || !userData.length) {
      return;
    }

    const user = userData[0];
    return {
      farcaster: {
        fid: user.fid,
        username: user.username,
        display_name: user.display_name,
        pfp_url: user.pfp_url,
        bio: user.profile?.bio?.text,
        displayName: user.display_name,
        avatar: user.pfp_url,
        follower_count: user.follower_count,
        following_count: user.following_count,
        verified_addresses: user.verifications,
        power_badge: user.power_badge,
        score: user.score, // Neynar quality score
      },
    };
  } catch (err) {
    // Silently fail - these errors are common and expected
    return;
  }
}

async function fetchLensData(address, forceFetch) {
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
    const fetchFn = forceFetch ? fetch : fetchStaleWhileRevalidate;
    response = await fetchFn("https://api-v2.lens.dev/", {
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

export async function fetchENSData(address, forceFetch) {
  const endpoint = "https://api.ensdata.net/";

  try {
    let url = `${endpoint}${address}?farcaster=true`;
    if (env.ENSDATA_KEY) {
      // NOTE: If you're coming across this environment variable and you're
      // wondering why it wasn't documented, this is because its only meant to be
      // used by the Kiwi News production server.
      url += `&special=${env.ENSDATA_KEY}`;
    }

    const signal = AbortSignal.timeout(5000);
    const fetchFn = forceFetch ? fetch : fetchStaleWhileRevalidate;
    const response = await fetchFn(url, { signal });

    const data = await response.json();

    // Check if ENS returned an error in the JSON response
    if (data.error || !response.ok) {
      throw new Error(
        data.message ||
          `ENS API returned ${response.status}: ${response.statusText}`,
      );
    }
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
    // Silently handle ENS failures - they're common

    // Try Neynar as fallback
    try {
      const neynarData = await fetchNeynarData(address);
      if (neynarData) {
        const truncatedAddress =
          address.slice(0, 6) +
          "..." +
          address.slice(address.length - 4, address.length);

        return {
          ...neynarData,
          address,
          truncatedAddress,
          displayName: neynarData.farcaster.username
            ? `@${neynarData.farcaster.username}`
            : truncatedAddress,
        };
      }
    } catch (neynarError) {
      // Silently handle Neynar fallback failures
    }

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

export async function _resolve(normalizedAddress, forceFetch) {
  const ensProfile = await fetchENSData(normalizedAddress, forceFetch);
  const lensProfile = await fetchLensData(normalizedAddress, forceFetch);

  // If ENS failed and didn't return Neynar data, try Neynar independently
  let neynarProfile = null;
  if (ensProfile.error && !ensProfile.farcaster) {
    neynarProfile = await fetchNeynarData(normalizedAddress, forceFetch);
  }

  // Get Neynar score from API data (if available)
  let neynarScore = 0;
  if (ensProfile?.farcaster?.score) {
    neynarScore = ensProfile.farcaster.score;
  } else if (neynarProfile?.farcaster?.score) {
    neynarScore = neynarProfile.farcaster.score;
  }

  let safeAvatar = ensProfile.avatar_small
    ? ensProfile.avatar_small
    : ensProfile.avatar;
  if (safeAvatar && !safeAvatar.startsWith("https")) {
    safeAvatar = ensProfile.avatar_url;
  }
  if (!safeAvatar && ensProfile?.farcaster?.avatar) {
    safeAvatar = ensProfile.farcaster.avatar;
  }
  if (!safeAvatar && neynarProfile?.farcaster?.avatar) {
    safeAvatar = neynarProfile.farcaster.avatar;
  }
  if (!safeAvatar && lensProfile?.avatar) {
    safeAvatar = lensProfile.avatar;
  }

  let displayName = DOMPurify.sanitize(ensProfile.ens);
  if (!displayName && ensProfile?.farcaster?.username) {
    displayName = `@${DOMPurify.sanitize(ensProfile.farcaster.username)}`;
  }
  if (!displayName && neynarProfile?.farcaster?.username) {
    displayName = `@${DOMPurify.sanitize(neynarProfile.farcaster.username)}`;
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
    ...(neynarProfile && { neynar: neynarProfile }),
    lens: lensProfile,
    displayName,
    neynarScore,
  };
  return completeProfile;
}

export async function resolve(address, forceFetch = false) {
  // Normalize address for consistent cache keys and API calls
  const normalizedAddress = address.toLowerCase();
  const cacheKey = `${ENS_CACHE_PREFIX}${normalizedAddress}`;

  // Check if we have complete data in cache (not just minimal profile)
  if (cache.has(cacheKey) && !forceFetch) {
    const cached = cache.get(cacheKey);
    // Only return cached data if it's been fully resolved (has ENS, Farcaster, or Lens data)
    if (cached.ens || cached.farcaster || cached.lens || cached.neynar) {
      return cached;
    }
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

  if (!forceFetch) {
    // Trigger background fetch and update cache when done - don't await
    (async () => {
      try {
        const completeProfile = await _resolve(normalizedAddress);
        cache.set(cacheKey, completeProfile);

        return completeProfile;
      } catch (err) {
        // Silently handle background resolution failures
      }
    })().catch((err) => {
      // Silently handle background fetch errors
    });
  } else {
    return await _resolve(normalizedAddress, forceFetch);
  }

  // Return minimal profile immediately
  return minimalProfile;
}
