// @format
//
// "Featured on Kiwi News" badges. The author pings (src/farcaster-reach.mjs)
// record each story's best rank in the hot feed's top 3 in their state file
// ("peak"); this module reads that record in any process, renders the badge
// SVG (/badge/<index>.svg) and the snippet story pages show writers whose
// story reached the top 3. Without FC_AUTHOR_PINGS nothing is recorded, so
// badges show upvotes only and story pages show no snippet.
import { env } from "process";
import { readFileSync, statSync } from "fs";
import path from "path";

import { getSlug } from "./utils.mjs";

export const ORIGIN = "https://news.kiwistand.com";

export function statePath(vars = env) {
  return (
    vars.FC_REACH_STATE_FILE ||
    path.resolve(vars.CACHE_DIR || "cache", "farcaster-reach.json")
  );
}

export function indexKey(index) {
  return String(index || "").toLowerCase().replace(/^0x/, "");
}

// Story pages render in every worker, so the file is read again only when
// it changed.
let memo = { file: null, mtime: 0, peak: {} };
export function readPeaks(file = statePath()) {
  try {
    const { mtimeMs } = statSync(file);
    if (memo.file === file && memo.mtime === mtimeMs) return memo.peak;
    const peak = JSON.parse(readFileSync(file, "utf8")).peak || {};
    memo = { file, mtime: mtimeMs, peak };
    return peak;
  } catch (err) {
    return {};
  }
}

// The best hot feed rank (1-3) the story reached, or null.
export function peakRank(index, file) {
  const rank = readPeaks(file)[indexKey(index)]?.rank;
  return Number.isInteger(rank) && rank >= 1 && rank <= 3 ? rank : null;
}

function escapeXml(text) {
  return String(text).replace(
    /[<>&"']/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c],
  );
}

// Rough text width for the badge's 11px sans-serif.
const widthOf = (text) => Math.ceil([...text].length * 6.6) + 16;

export function badgeText({ rank, upvotes }) {
  const parts = [];
  if (rank) parts.push(`#${rank} on Kiwi`);
  if (Number.isInteger(upvotes)) parts.push(`${upvotes} upvote${upvotes === 1 ? "" : "s"}`);
  return parts.join(" · ") || "Kiwi News";
}

// A shields-style badge: "Featured on Kiwi News | #2 on Kiwi · 34 upvotes".
export function badgeSvg({ rank = null, upvotes = null } = {}) {
  const left = "Featured on Kiwi News";
  const right = badgeText({ rank, upvotes });
  const lw = widthOf(left);
  const rw = widthOf(right);
  const w = lw + rw;
  const label = `${left}: ${right}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${escapeXml(label)}"><title>${escapeXml(label)}</title><linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient><clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath><g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#3d3d3d"/><rect x="${lw}" width="${rw}" height="20" fill="#3c8a2e"/><rect width="${w}" height="20" fill="url(#s)"/></g><g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11"><text x="${lw / 2}" y="14">${escapeXml(left)}</text><text x="${lw + rw / 2}" y="14">${escapeXml(right)}</text></g></svg>`;
}

export function badgeUrl(index) {
  return `${ORIGIN}/badge/0x${indexKey(index)}.svg`;
}

export function storyPageUrl({ title, index }) {
  return `${ORIGIN}/stories/${getSlug(title)}?index=0x${indexKey(index)}`;
}

// What writers paste on their site or README.
export function badgeSnippets(story) {
  const img = badgeUrl(story.index);
  const link = storyPageUrl(story);
  return {
    html: `<a href="${link}"><img src="${img}" alt="Featured on Kiwi News" height="20"></a>`,
    markdown: `[![Featured on Kiwi News](${img})](${link})`,
  };
}

// Parses the route's "<index>.svg" (with or without 0x).
export function parseBadgeParam(param) {
  const match = String(param || "").match(/^(?:0x)?([a-fA-F0-9]{72})\.svg$/);
  return match ? `0x${match[1].toLowerCase()}` : null;
}
