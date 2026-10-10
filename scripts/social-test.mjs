#!/usr/bin/env node
// @format
//
// Checks the social posting setup (X, Farcaster, Telegram) from the server.
//
//   node scripts/social-test.mjs
//     Shows which channels are enabled. Posts nothing.
//   node scripts/social-test.mjs --dry-run
//     Also prints what would be posted for today's top story, per channel.
//   node scripts/social-test.mjs --channel x|farcaster|telegram --send
//     Sends ONE post of today's top story (not yet posted there) to that
//     channel. It is recorded in
//     the dedupe state, so the daily automatic post won't repeat it.
//
// The top story comes from the public API (KIWI_API_URL, defaults to
// https://news.kiwistand.com), so this works next to the running node.
import "dotenv/config";
import { env, argv, exit } from "process";

import {
  CHANNELS,
  statusLines,
  missingEnv,
  preview,
  postStory,
  minUpvotes,
  loadState,
  wasPosted,
  defaultStatePath,
  storyUrl,
} from "../src/social-posting.mjs";

function arg(name) {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
}

const dryRun = argv.includes("--dry-run");
const send = argv.includes("--send");
const channel = arg("--channel");

if (channel && !CHANNELS.includes(channel)) {
  console.error(`Unknown channel "${channel}", use one of: ${CHANNELS.join(", ")}`);
  exit(1);
}
if (send && !channel) {
  console.error("--send needs --channel x|farcaster|telegram");
  exit(1);
}

for (const line of statusLines()) console.log(line);

if (!dryRun && !send) {
  console.log(
    "\nNothing posted. Use --dry-run to preview, or --channel <name> --send to post once.",
  );
  exit(0);
}

async function topStories() {
  const base = env.KIWI_API_URL || "https://news.kiwistand.com";
  const response = await fetch(`${base}/api/v1/feeds/best?period=day`);
  if (!response.ok) {
    throw new Error(`GET ${base}/api/v1/feeds/best failed: HTTP ${response.status}`);
  }
  const json = await response.json();
  return json?.data?.stories || [];
}

const stories = await topStories();
const min = minUpvotes();
const state = loadState(defaultStatePath());
// NOTE: With --channel, skip stories already posted there so --send can't
// be a no-op.
const story = stories.find(
  (s) =>
    s.index &&
    s.title &&
    (s.upvotes || 0) >= min &&
    !(channel && wasPosted(state, s, channel)),
);
if (!story) {
  console.error(`No unposted story of the last 24h has at least ${min} upvotes.`);
  exit(1);
}

const url = storyUrl(story);
console.log(`\nTop story: ${story.title} (${story.upvotes} upvotes)\n${url}`);

for (const name of channel ? [channel] : CHANNELS) {
  const post = preview(name, story, url);
  const posted = wasPosted(state, story, name) ? " [already posted]" : "";
  console.log(`\n--- ${name}${posted} ---\n${post.text}`);
  if (post.embeds) console.log(`embeds: ${post.embeds.join(", ")}`);
}

if (!send) exit(0);

const missing = missingEnv(channel);
if (missing.length) {
  console.error(`\n${channel} is not configured, missing: ${missing.join(", ")}`);
  exit(1);
}

console.log(`\nSending to ${channel}...`);
const results = await postStory(story, { channels: [channel], url });
const result = results[channel];
if (result.success) {
  console.log(`OK${result.id ? `, id ${result.id}` : ""}`);
  exit(0);
}
console.error(`FAILED: ${result.error}`);
exit(1);
