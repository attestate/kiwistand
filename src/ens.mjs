import { env } from "process";
import path from "path";

import DOMPurify from "isomorphic-dompurify";
import { fetchBuilder, FileSystemCache } from "node-fetch-cache";
import { providers, utils } from "ethers";

import { allowlist } from "./chainstate/registry.mjs";
import { fetchCache } from "./utils.mjs";

const provider = new providers.JsonRpcProvider(env.RPC_HTTP_HOST);

const cache = new FileSystemCache({
  cacheDirectory: path.resolve(env.CACHE_DIR),
  ttl: 86400000 * 5, // 72 hours
});
const fetch = fetchBuilder.withCache(cache);
const fetchStaleWhileRevalidate = fetchCache(fetch, cache);

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
    response = await fetchStaleWhileRevalidate("https://api-v2.lens.dev/", {
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

async function fetchENSData(address) {
  let endpoint = "https://ensdata.net/";
  if (env.ENSDATA_KEY) {
    // NOTE: If you're coming across this environment variable and you're
    // wondering why it wasn't documented, this is because its only meant to be
    // used by the Kiwi News production server.
    endpoint += env.ENSDATA_KEY + "/";
  }

  try {
    const url = `${endpoint}${address}?farcaster=true`;
    const response = await fetchStaleWhileRevalidate(url);
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
  const profile = {
    safeAvatar: DOMPurify.sanitize(safeAvatar),
    ...ensProfile,
    lens: lensProfile,
    displayName,
  };
  return profile;
}
