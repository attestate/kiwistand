// Resolves /stories/<slug> without ?index= to the story it names.
//
// NOTE: Every link we make carries ?index= (row.mjs, story.mjs, the sitemap,
// RSS, the apps' share URLs), but URLs lose their query string elsewhere:
// the Coinbase Wallet SDK checks the page's Cross-Origin-Opener-Policy with
// a HEAD request to origin + pathname (a 404 and a console error on every
// story page it loads on), and people and tools that trim links. Those
// requests used to get a plain-text 404; now they're redirected to the story.
import { listSubmissionTitles } from "./cache.mjs";
import { getSlug } from "./utils.mjs";
import log from "./logger.mjs";

const TTL = 10 * 60 * 1000;
let slugs = null;
let builtAt = 0;

// rows: [{ id: "kiwi:0x…", title }], newest first. A slug shared by several
// stories resolves to the newest one.
export function buildSlugIndex(rows) {
  const index = new Map();
  for (const { id, title } of rows) {
    if (!id || !title) continue;
    const [, hex] = String(id).split("0x");
    if (!hex) continue;
    const slug = getSlug(title);
    if (slug && !index.has(slug)) index.set(slug, `0x${hex}`);
  }
  return index;
}

// NOTE: Rebuilt at most every TTL, not on a miss, so made-up slugs can't
// make the server re-read every title.
export function findStoryIndex(slug, now = Date.now()) {
  if (!slug) return null;
  if (!slugs || now - builtAt > TTL) {
    try {
      slugs = buildSlugIndex(listSubmissionTitles());
      builtAt = now;
    } catch (err) {
      log(`Couldn't build the story slug index: ${err.toString()}`);
      return null;
    }
  }
  return slugs.get(slug) || null;
}

// The URL to redirect a story request without a valid index to, or null.
export function storyRedirect(slug, query = {}, find = findStoryIndex) {
  const index = find(slug);
  // NOTE: The same index again would redirect to itself.
  if (!index || index === query.index) return null;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === "index" || key === "t" || value === undefined) continue;
    params.set(key, value);
  }
  params.set("index", index);
  return `/stories/${slug}?${params.toString()}`;
}
