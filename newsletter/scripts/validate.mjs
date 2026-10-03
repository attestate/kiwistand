// Checks an exported email (out/Digest.html by default) before it's sent.
// Errors fail the run (exit 1), so the send workflow stops; warnings list
// CSS that some mail clients don't support (from caniemail.com via
// doiuse-email) for information.
//
//   node scripts/validate.mjs [out/Digest.html] [--min-stories 3]
import fs from "fs/promises";
import path from "path";
import { doIUseEmail } from "doiuse-email";
import { extractBody } from "../lib/html.mjs";

const args = process.argv.slice(2);
const file = path.resolve(args.find((arg) => !arg.startsWith("--")) || "out/Digest.html");
const minIndex = args.indexOf("--min-stories");
const minStories = minIndex === -1 ? 3 : parseInt(args[minIndex + 1], 10);

const html = await fs.readFile(file, "utf-8");
const errors = [];
const warnings = [];

// Gmail clips messages over ~102 KB and hides the rest behind a link.
const size = Buffer.byteLength(extractBody(html));
if (size > 100_000) errors.push(`body is ${size} bytes; Gmail clips emails over ~102 KB`);

const text = html
  .replace(/<style[\s\S]*?<\/style>/gi, "")
  .replace(/<[^>]+>/g, " ")
  .replace(/&[a-z#0-9]+;/gi, " ");
for (const bad of ["undefined", "NaN", "[object Object]", "Invalid URL", "Invalid Date"]) {
  if (text.includes(bad)) errors.push(`text contains "${bad}"`);
}
if (/\bnull\b/.test(text)) errors.push('text contains "null"');

const stories = (html.match(/>Read on Kiwi</g) || []).length;
if (stories < minStories) errors.push(`only ${stories} stories (need at least ${minStories})`);

for (const [, href] of html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/gi)) {
  if (!/^(https:\/\/|mailto:)/.test(href)) errors.push(`link isn't https: "${href.slice(0, 80)}"`);
  if (/^https:\/\/news\.kiwistand\.com/.test(href) && !href.includes("utm_source=")) {
    warnings.push(`Kiwi link without utm_source: ${href.slice(0, 80)}`);
  }
}

for (const [tag] of html.matchAll(/<img\b[^>]*>/gi)) {
  const src = tag.match(/\bsrc="([^"]*)"/i)?.[1] || "";
  if (!src.startsWith("https://")) errors.push(`image isn't https: "${src.slice(0, 80)}"`);
  // Outlook for Windows and older clients don't show WebP or SVG images.
  if (/\.(webp|svg)(\?|$)/i.test(src)) errors.push(`WebP/SVG image (not shown in Outlook): ${src.slice(0, 80)}`);
  if (!/\balt="/i.test(tag)) errors.push(`image without alt: ${src.slice(0, 80)}`);
  if (!/\bwidth="/i.test(tag)) warnings.push(`image without width attribute: ${src.slice(0, 80)}`);
}
if (/<svg\b/i.test(html)) errors.push("inline <svg> (Gmail and Outlook don't render it)");

if (!/prefers-color-scheme:\s*dark/.test(html)) errors.push("no dark-mode styles");
if (!/name="color-scheme" content="light dark"/.test(html)) errors.push('no <meta name="color-scheme" content="light dark">');

// Client support from caniemail.com. Elements and attributes every email
// has (body, link, role, target, margin…) are noise; the rest are listed.
const ignore = new Set([
  "<body> element",
  "<link> element",
  "role attribute",
  "target attribute",
  "lang attribute",
  "dir attribute",
  "width attribute",
  "height attribute",
  "margin",
  "padding",
  "line-height",
  "display",
  "text-align",
  "text-decoration",
  "font-weight",
  "border",
  "max-width",
  "!important keyword",
  "display:none",
  "opacity",
  "overflow",
  "outline",
  "word-break",
  "white-space",
]);
const report = doIUseEmail(html, {
  emailClients: ["gmail.*", "apple-mail.*", "outlook.*", "yahoo.*"],
});
const features = new Map();
for (const message of [...(report.errors || []), ...(report.warnings || [])]) {
  const match = message.match(/^`(.+?)` is (not supported|only partially supported) by `(.+?)`/);
  if (!match || ignore.has(match[1])) continue;
  const key = `${match[1]} (${match[2]})`;
  if (!features.has(key)) features.set(key, new Set());
  features.get(key).add(match[3]);
}
for (const [feature, clients] of features) {
  warnings.push(`${feature}: ${[...clients].join(", ")}`);
}

console.log(`Checked ${path.relative(process.cwd(), file)}: ${stories} stories, ${size} bytes`);
for (const warning of [...new Set(warnings)]) console.log(`  warning: ${warning}`);
for (const error of errors) console.log(`  ERROR: ${error}`);
if (errors.length) {
  console.log(`${errors.length} error(s)`);
  process.exit(1);
}
console.log("OK");
