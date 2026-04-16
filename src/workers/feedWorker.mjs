// @format
import feed from "../views/feed.mjs";
import {
  initializeLtCache,
  initializeImpressions,
  initializeShares,
} from "../cache.mjs";

// Initialize SQLite tables once when this worker thread starts
initializeLtCache();
initializeImpressions();
initializeShares();

export default async function ({ theme, page = 0, domain = null, identity = undefined, hash = undefined }) {
  // trie is not used inside feed generation - all data comes from SQLite
  return feed(null, theme, page, domain, identity, hash);
}
