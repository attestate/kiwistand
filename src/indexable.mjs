// @format
// Which story pages we ask search engines to index. Most stories are a title,
// an outbound link and nothing else; thousands of those make Google treat the
// whole site as thin and index almost none of it. So only stories with real
// engagement or original text on the page are indexable; the rest render
// `noindex, follow` (crawlers still follow their links) and are left out of
// the sitemaps and IndexNow pings.
//
// NOTE: The same rule is used by story pages (src/views/story.mjs), the
// monthly sitemaps (src/sitemap.mjs), IndexNow (src/indexnow.mjs) and
// scripts/count-indexable-stories.mjs, so they never disagree.
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);

// Upvotes include the submitter's own (store.mjs and cache.mjs count the
// submission as the first upvote), so 3 means two other people upvoted it.
export const MIN_UPVOTES = 3;
export const MIN_COMMENTS = 1;
// The summary prompt (src/parser.mjs) asks for 60 to 110 words, roughly 350
// to 750 characters. Anything much shorter isn't enough original text to
// carry a page.
export const MIN_SUMMARY_LENGTH = 200;
// A summary alone made two thirds of all stories indexable (6,717 of 14,610
// on 2026-10-24), most with no reader interest at all. It now counts only
// together with at least one upvote from someone other than the submitter.
export const MIN_UPVOTES_WITH_SUMMARY = 2;

function count(value) {
  if (Array.isArray(value)) return value.length;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// `story.upvotes` is a count (cache.mjs, including the submitter) and
// `story.upvoters` an array (story pages); either works. Same for
// `story.comments` (a count or the array of comments, without reactions).
// `story.hidden` is true when moderation drops the story from the feeds.
// `summary` must already have passed isSafeSummary (getSummary() and
// summaries.listSafeSummaries() only return those).
export function isIndexableStory(story, { summary } = {}) {
  if (!story || story.hidden) return false;
  const upvotes =
    story.upvotes !== undefined ? count(story.upvotes) : count(story.upvoters);
  if (upvotes >= MIN_UPVOTES) return true;
  if (count(story.comments) >= MIN_COMMENTS) return true;
  return (
    upvotes >= MIN_UPVOTES_WITH_SUMMARY &&
    typeof summary === "string" &&
    summary.trim().length >= MIN_SUMMARY_LENGTH
  );
}

// The robots meta tag for a story page's <head>. Comment permalinks
// (?commentIndex=) duplicate their story page, so they're never indexed.
export function robotsMeta({ indexable, commentIndex = null }) {
  if (indexable && !commentIndex) return null;
  return html`<meta name="robots" content="noindex, follow" />`;
}
