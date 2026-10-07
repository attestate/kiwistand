// Compares the AI titles two Claude models write for real X and Farcaster
// submissions, so a model switch (e.g. Sonnet 4.5 -> Haiku 5.5) can be
// checked before or after it ships. Run on a machine with
// ANTHROPIC_API_KEY in .env (the node server):
//
//   node scripts/eval-titles.mjs [modelA] [modelB] [count]
//   node scripts/eval-titles.mjs claude-sonnet-4-5 claude-haiku-5-5 20
//
// It takes tweets and casts from the live Hot and New feeds, builds the same
// prompt the parser uses ("Tweet by @handle: text"), asks both models for a
// title, checks each against the hard title rules and writes a side-by-side
// table to eval-titles.md for a human to judge the rest (accuracy, tone).
// Cost: two short calls per post, well under a cent for 20 posts on Haiku.
import "dotenv/config";
import { writeFileSync } from "fs";

import { generateClaudeTitle } from "../src/parser.mjs";

const [modelA = "claude-sonnet-4-5", modelB = "claude-haiku-5-5", count = "20"] =
  process.argv.slice(2);
const limit = Number(count);

async function feed(name) {
  const response = await fetch(`https://news.kiwistand.com/api/v1/feeds/${name}`);
  const body = await response.json();
  return body.data?.stories ?? [];
}

// Hard rules from GUIDELINES that can be checked mechanically.
function checks(title, handle) {
  const failed = [];
  if (!title) return ["no title"];
  if (title.length > 80) failed.push(`${title.length} chars`);
  if (handle && !title.toLowerCase().startsWith(`${handle.toLowerCase()}:`)) {
    failed.push(`doesn't start with "${handle}:"`);
  }
  const words = title.replace(/^@\S+:\s*/, "").split(/\s+/).filter((w) => /^[a-z]/i.test(w));
  const capitalized = words.filter((w) => /^[A-Z]/.test(w)).length;
  if (words.length >= 5 && capitalized / words.length > 0.7) failed.push("title case");
  return failed;
}

const seen = new Set();
const posts = [];
for (const story of [...(await feed("hot")), ...(await feed("new"))]) {
  const meta = story.metadata ?? {};
  const isTweet = meta.twitterCreator && meta.ogDescription;
  const cast = meta.farcasterCast;
  if (seen.has(story.index) || (!isTweet && !cast?.text)) continue;
  seen.add(story.index);
  const handle = isTweet
    ? meta.twitterCreator
    : cast.author?.username && `@${cast.author.username}`;
  const text = (isTweet ? meta.ogDescription : cast.text).replace(/<br\s*\/?>/g, "\n");
  posts.push({
    handle,
    current: story.title,
    // The same prompt the parser builds.
    content: isTweet ? `Tweet by ${handle}: ${text}` : `Cast by ${cast.author.username}: ${text}`,
  });
  if (posts.length >= limit) break;
}
if (!posts.length) {
  console.error("No tweets or casts in the feeds right now.");
  process.exit(1);
}

async function run(model, content) {
  const start = Date.now();
  const title = await generateClaudeTitle(content, model);
  return { title, ms: Date.now() - start };
}

const rows = [];
const totals = { [modelA]: { ms: 0, failed: 0 }, [modelB]: { ms: 0, failed: 0 } };
for (const post of posts) {
  const [a, b] = await Promise.all([run(modelA, post.content), run(modelB, post.content)]);
  const failedA = checks(a.title, post.handle);
  const failedB = checks(b.title, post.handle);
  totals[modelA].ms += a.ms;
  totals[modelB].ms += b.ms;
  if (failedA.length) totals[modelA].failed++;
  if (failedB.length) totals[modelB].failed++;
  rows.push({ post, a, b, failedA, failedB });
  console.log(`\n${post.content.slice(0, 120).replace(/\n/g, " ")}`);
  console.log(`  ${modelA}: ${a.title} (${a.ms}ms) ${failedA.join(", ")}`);
  console.log(`  ${modelB}: ${b.title} (${b.ms}ms) ${failedB.join(", ")}`);
}

const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const lines = [
  `# Title eval: ${modelA} vs ${modelB}`,
  "",
  `${posts.length} posts from the Hot and New feeds, ${new Date().toISOString()}.`,
  "",
  `| | ${modelA} | ${modelB} |`,
  "|---|---|---|",
  `| Rule failures | ${totals[modelA].failed} / ${posts.length} | ${totals[modelB].failed} / ${posts.length} |`,
  `| Average latency | ${Math.round(totals[modelA].ms / posts.length)} ms | ${Math.round(totals[modelB].ms / posts.length)} ms |`,
  "",
  `| Post | Current title | ${modelA} | ${modelB} |`,
  "|---|---|---|---|",
  ...rows.map(({ post, a, b, failedA, failedB }) =>
    `| ${cell(post.content.slice(0, 200))} | ${cell(post.current)} | ${cell(a.title)}${failedA.length ? ` ⚠️ ${failedA.join(", ")}` : ""} | ${cell(b.title)}${failedB.length ? ` ⚠️ ${failedB.join(", ")}` : ""} |`,
  ),
];
writeFileSync("eval-titles.md", lines.join("\n") + "\n");
console.log(`\nWrote eval-titles.md`);
process.exit(0);
