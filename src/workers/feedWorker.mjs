// @format
import feed from "../views/feed.mjs";
import cache from "../cache.mjs";
import normalizeUrl from "normalize-url";
import {
  initializeLtCache,
  initializeImpressions,
  initializeShares,
} from "../cache.mjs";

// Initialize SQLite tables once when this worker thread starts
initializeLtCache();
initializeImpressions();
initializeShares();

export default async function ({ theme, variant, page = 0, domain = null, identity = undefined, hash = undefined, metadataMap = {} }) {
  // Pre-populate this worker's isolated LRU cache from the main process
  // metadata map so cachedMetadata() gets cache hits during rendering.
  for (const [href, data] of Object.entries(metadataMap)) {
    try {
      const normalized = normalizeUrl(href, { stripWWW: false });
      if (!cache.has(normalized)) {
        cache.set(normalized, data);
      }
    } catch {}
  }
  // trie is not used inside feed generation - all data comes from SQLite
  return feed(null, theme, page, domain, identity, hash, variant);
}
