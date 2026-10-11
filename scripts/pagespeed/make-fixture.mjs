// Makes the fixture the PR page speed check runs the server with
// (test/fixtures/pagespeed/fixture.json), from news.kiwistand.com's public API.
//
// Run it again when the pages change shape, e.g. a new kind of story or
// metadata; the local Lighthouse floors in budgets.json may need adjusting
// afterwards.
//
//   node scripts/pagespeed/make-fixture.mjs
//
// It keeps what makes the pages representative: the stories' titles, links,
// link previews, comments, reactions, upvotes, summaries and how old each of
// them is. People are replaced by made-up profiles (seed.mjs signs their
// messages with throwaway keys), and no image is stored: only each image's
// size, so seed.mjs can generate one that is as big and as heavy. Stories
// that are image uploads (imagedelivery.net) are left out, their href is the
// image itself.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../../test/fixtures/pagespeed/fixture.json");
const BASE = (process.env.BASE_URL || "https://news.kiwistand.com").replace(/\/$/, "");
const MAX_STORIES = 45;
const headers = { "user-agent": "KiwiNewsPagespeedFixture/1.0" };

async function get(url, as = "json") {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
      if (res.ok) return as === "json" ? await res.json() : Buffer.from(await res.arrayBuffer());
      if (res.status < 500 || attempt >= 4) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (attempt >= 4) throw new Error(`${url}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
}

// The size of an image, so seed.mjs can stand in one that is as heavy.
const images = new Map();
async function image(url) {
  if (!url || typeof url !== "string" || !/^https?:/.test(url)) return null;
  if (images.has(url)) return images.get(url);
  let result = null;
  try {
    const buf = await get(url, "buffer");
    const meta = await sharp(buf).metadata();
    if (meta.width && meta.height) {
      result = { width: meta.width, height: meta.height, bytes: buf.length, format: meta.format };
    }
  } catch (err) {
    console.log(`image ${url}: ${err.message}`);
  }
  images.set(url, result);
  return result;
}

const fetchedAt = Math.floor(Date.now() / 1000);
const lists = await Promise.all(
  ["hot?page=0", "new", "best?period=week", "best?period=month"].map((feed) =>
    get(`${BASE}/api/v1/feeds/${feed}`).then((r) => r.data.stories),
  ),
);
const candidates = new Map();
for (const story of lists.flat()) {
  if (story.href.includes("imagedelivery.net")) continue;
  if (!candidates.has(story.index)) candidates.set(story.index, story);
}
const picked = [...candidates.values()].slice(0, MAX_STORIES);

// Real people become made-up profiles, numbered in order of appearance.
const people = new Map();
function person(identity) {
  const profile = typeof identity === "object" ? identity : null;
  const address = (profile ? profile.address : identity).toLowerCase();
  if (!people.has(address)) {
    people.set(address, { id: `p${String(people.size).padStart(2, "0")}`, source: null });
  }
  const entry = people.get(address);
  if (profile && !entry.source) entry.source = profile;
  return entry.id;
}

const stories = [];
for (const { index } of picked) {
  const { data } = await get(`${BASE}/api/v1/stories?index=0x${index}`);
  const seen = new Set();
  const upvotes = [];
  for (const u of data.upvoters) {
    const id = person(u.identity);
    // NOTE: The first upvote is the submission itself, and a person can
    // only upvote once.
    if (seen.has(id)) continue;
    seen.add(id);
    upvotes.push({ by: id, age: fetchedAt - u.timestamp });
  }
  const submitter = person(data.identity);
  const comments = data.comments.map((c) => ({
    by: person(c.identity),
    age: fetchedAt - c.timestamp,
    text: c.title,
    reactions: (c.reactions || []).flatMap((r) =>
      (r.reactors || []).map((reactor) => ({
        by: person(reactor),
        emoji: r.emoji,
      })),
    ),
  }));
  const meta = { ...(data.metadata || {}) };
  const media = {};
  for (const key of ["image", "twitterAuthorAvatar"]) {
    if (meta[key]) {
      const size = await image(meta[key]);
      if (size) media[key] = size;
      delete meta[key];
    }
  }
  delete meta.canonicalLink;
  let summary = null;
  try {
    const page = (await get(`${BASE}/stories?index=0x${index}`, "buffer")).toString();
    const m = /<details class="story-summary">[\s\S]*?<p>([\s\S]*?)<\/p>/.exec(page);
    if (m) summary = m[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  } catch (err) {
    console.log(`summary ${index}: ${err.message}`);
  }
  stories.push({
    title: data.title,
    href: data.href,
    age: fetchedAt - data.timestamp,
    by: submitter,
    upvotes: upvotes.filter((u) => u.by !== submitter),
    comments,
    metadata: meta,
    media,
    summary,
  });
  console.log(`${stories.length}/${picked.length} ${data.title.slice(0, 60)}`);
}

const profiles = {};
let n = 0;
for (const { id, source } of people.values()) {
  n++;
  const hasAvatar = Boolean(source?.safeAvatar);
  profiles[id] = {
    // NOTE: Made-up names of a typical length, real ones aren't needed.
    ens: `kiwireader${String(n).padStart(2, "0")}.eth`,
    description: source?.description ? "Reads and writes about crypto, the web and the people building it." : undefined,
    twitter: source?.twitter ? `kiwireader${n}` : undefined,
    url: source?.url ? "https://example.com" : undefined,
    farcaster: Boolean(source?.farcaster?.fid),
    neynarScore: source?.neynarScore || 0,
    avatar: hasAvatar ? (await image(source.safeAvatar)) || { width: 200, height: 200, bytes: 12000, format: "jpeg" } : null,
  };
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  out,
  JSON.stringify(
    {
      note: "Generated by scripts/pagespeed/make-fixture.mjs from news.kiwistand.com. Ages are seconds before the seed.",
      generated: new Date(fetchedAt * 1000).toISOString(),
      profiles,
      stories,
    },
    null,
    1,
  ) + "\n",
);
console.log(`Wrote ${path.relative(process.cwd(), out)}: ${stories.length} stories, ${Object.keys(profiles).length} profiles`);
