import path from "path";
import { fileURLToPath } from "url";

import { Response } from "node-fetch";
import { getCacheKey } from "node-fetch-cache";

// NOTE: This is an extension of node-fetch-cache where we're loading the
// to-be-cached data in the background while returning an error to the caller
// in the meantime. What this does is that it stops blocking requests from
// being resolved, for example, in the ens module.
export function fetchCache(fetch, cache) {
  if (!fetch || !cache) {
    throw new Error("fetch and cache must be passed to fetchCache");
  }

  return async (url, options = {}) => {
    const cacheKey = getCacheKey(url, options);
    const cachedValue = await cache.get(cacheKey);

    (async () => {
      try {
        await fetch(url, options);
      } catch (error) {
        console.error(`Error fetching and caching data for ${url}:`, error);
      }
    })();

    if (cachedValue) {
      // NOTE: node-fetch-cache doesn't return a node-fetch Response, hence we're
      // casting it to one before handing it back to the business logic.
      return new Response(cachedValue.bodyStream, cachedValue.metaData);
    }

    throw new Error(`No cached data momentarily available for ${url}`);
  };
}

let lastCall;
export function logd(label = "") {
  const now = Date.now();
  if (lastCall === undefined) {
    console.log(`${label}${label ? ": " : ""}Delta: 0ms`);
  } else {
    console.log(`${label}${label ? ": " : ""}Delta: ${now - lastCall}ms`);
  }
  lastCall = now;
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
