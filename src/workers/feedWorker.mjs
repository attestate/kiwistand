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

export default async function ({ theme, variant }) {
  // trie is not used inside feed generation - all data comes from SQLite
  return feed(null, theme, 0, null, undefined, undefined, variant);
}
