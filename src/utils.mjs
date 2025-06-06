import path from "path";
import { fileURLToPath } from "url";

import { Response, Request } from "node-fetch";
import { getCacheKey } from "node-fetch-cache";
import DOMPurify from "isomorphic-dompurify";
import slugify from "slugify";
import cache from "./cache.mjs"; // Import the default cache

slugify.extend({ "′": "", "'": "", "'": "", '"': "" });

// NOTE: This is an extension of node-fetch-cache where we're loading the
// to-be-cached data in the background while returning an error to the caller
// in the meantime. What this does is that it stops blocking requests from
// being resolved, for example, in the ens module.
export function fetchCache(fetch, fileSystemCache) {
  // Renamed 'cache' param to avoid conflict
  if (!fetch || !fileSystemCache) {
    throw new Error("fetch and fileSystemCache must be passed to fetchCache");
  }

  return async (url, options = {}) => {
    const cacheKey = getCacheKey(url, options);
    // Try getting from the file system cache first
    let cachedValue = await fileSystemCache.get(cacheKey);

    (async () => {
      try {
        const networkResponse = await fetch(url, options);
        if (networkResponse.ok) {
          const buffer = await networkResponse.buffer();
          // Update the default in-memory cache (LRU) with this network response.
          cache.set(cacheKey, {
            // Use default cache.set
            bodyStream: buffer,
            metaData: {
              status: networkResponse.status,
              headers: networkResponse.headers.raw(),
            },
          });
        }
      } catch (error) {
        console.error(`Error fetching and caching data for ${url}:`, error);
      }
    })();

    if (cachedValue) {
      // NOTE: node-fetch-cache doesn't return a node-fetch Response, hence we're
      // casting it to one before handing it back to the business logic.
      return new Response(cachedValue.bodyStream, cachedValue.metaData);
    }
    // If file system cache missed, try the default in-memory cache (LRU)
    const staleValue = cache.get(cacheKey); // Use default cache.get
    if (staleValue) {
      return new Response(staleValue.bodyStream, staleValue.metaData);
    }

    throw new Error(`No cached data momentarily available for ${url}`);
  };
}

export function getSlug(title) {
  return slugify(DOMPurify.sanitize(title));
}

let lastCall;
export function logd(label = "") {
  const now = Date.now();
  if (lastCall === undefined) {
    console.log(`${label}${label ? ": " : ""}Delta: 0ms`);
  } else {
    console.log(`${label}${label ? ": " : ""}Delta: ${now - lastCall}ms`);
  }

  if (label === "reset") {
    lastCall = undefined;
  } else {
    lastCall = now;
  }
}

function dirname() {
  const filename = fileURLToPath(import.meta.url);
  return path.dirname(filename);
}

export function truncate(comment, maxLength = 260) {
  if (
    !comment ||
    (comment && comment.length <= maxLength) ||
    (comment && comment.length === 0)
  )
    return comment;
  return comment.slice(0, comment.lastIndexOf(" ", maxLength)) + "...";
}

export function truncateName(name) {
  const maxLength = 12;
  if (
    !name ||
    (name && name.length <= maxLength) ||
    (name && name.length === 0)
  )
    return name;
  return name.slice(0, maxLength) + "...";
}

export function isCloudflareImage(url) {
  return url && typeof url === "string" && url.includes("imagedelivery.net");
}

export function appdir() {
  return path.resolve(dirname(), "../");
}

export function elog(err, msg) {
  if (msg) {
    console.error(`Message: ${msg}`);
  }
  if (err && err.stack) {
    console.error(`Stack Trace: ${err.stack}`);
  } else if (err) {
    console.error(`Error: ${err}`);
  } else {
    console.error(`Error wasn't defined in elog: ${err}`);
  }
}

