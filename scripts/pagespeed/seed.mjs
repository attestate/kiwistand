// Fills an empty DATA_DIR and CACHE_DIR from test/fixtures/pagespeed so the
// server can run offline with representative pages (local.mjs runs this).
//
// - Messages: each story, upvote, comment and emoji reaction becomes an
//   EIP-712 signed message, signed with a throwaway key per made-up person and
//   timestamped as long ago as in the fixture, so the hot feed looks like it
//   did. They go into the trie the node stores messages in; on start, the
//   node checks their signatures and builds its database from them.
// - Profiles (as if resolved from ENS), link previews and story summaries go
//   into the caches the server reads them from, so it never needs to fetch.
// - Images (avatars, link preview images) are generated with the fixture's
//   dimensions and roughly its byte sizes into ASSET_DIR, and referenced at
//   ASSET_ORIGIN: another origin, like the third-party hosts in production.
//
// Env: DATA_DIR, CACHE_DIR, ASSET_DIR, ASSET_ORIGIN (all required),
// FIXTURE (default test/fixtures/pagespeed/fixture.json).
import fs from "fs";
import path from "path";
import { env } from "process";
import { fileURLToPath } from "url";

import { Trie } from "@ethereumjs/trie";
import { keccak256 } from "ethereum-cryptography/keccak.js";
import { Wallet } from "ethers";
import normalizeUrl from "normalize-url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
for (const name of ["DATA_DIR", "CACHE_DIR", "ASSET_DIR", "ASSET_ORIGIN"]) {
  if (!env[name]) throw new Error(`${name} must be set`);
}
const fixture = JSON.parse(
  fs.readFileSync(
    path.resolve(root, env.FIXTURE || "test/fixtures/pagespeed/fixture.json"),
    "utf8",
  ),
);

// NOTE: Imported after the env checks, these open databases in CACHE_DIR.
const { default: LMDB } = await import("../../src/lmdb.mjs");
const { toDigest } = await import("../../src/id.mjs");
const { EIP712_DOMAIN, EIP712_MESSAGE } = await import("../../src/constants.mjs");
const cache = await import("../../src/cache.mjs");
const metadataCache = cache.default;
const summaries = await import("../../src/summaries.mjs");

const TTL = 30 * 24 * 60 * 60 * 1000;
const now = Math.floor(Date.now() / 1000);

// Images: a gradient with noise, as much noise as it takes to come close to
// the original's size, so the browser has as much to download and decode.
let seed = 1;
function random() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
async function makeImage(file, { width, height, bytes, format }) {
  // NOTE: Huge avatars are drawn small, but are downloaded in full: keep
  // the bytes, cap the pixels to keep the seed fast.
  const scale = Math.min(1, 1600 / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const hue = random() * 255;
  const encode = async (noise) => {
    const raw = Buffer.alloc(w * h * 3);
    let s = 7;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        const n = ((s / 0x7fffffff) - 0.5) * noise;
        const i = (y * w + x) * 3;
        raw[i] = Math.max(0, Math.min(255, hue + (x / w) * 80 + n));
        raw[i + 1] = Math.max(0, Math.min(255, 120 + (y / h) * 100 + n));
        raw[i + 2] = Math.max(0, Math.min(255, 200 - (x / w) * 120 + n));
      }
    }
    const img = sharp(raw, { raw: { width: w, height: h, channels: 3 } });
    return format === "png"
      ? img.png({ compressionLevel: 6 }).toBuffer()
      : format === "webp"
        ? img.webp({ quality: 80 }).toBuffer()
        : img.jpeg({ quality: 82 }).toBuffer();
  };
  let lo = 0;
  let hi = 160;
  let best = await encode(0);
  for (let i = 0; i < 7 && Math.abs(best.length - bytes) > bytes * 0.15; i++) {
    const mid = (lo + hi) / 2;
    const buf = await encode(mid);
    if (Math.abs(buf.length - bytes) < Math.abs(best.length - bytes)) best = buf;
    if (buf.length < bytes) lo = mid;
    else hi = mid;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, best);
}
const ext = (format) => (format === "png" ? "png" : format === "webp" ? "webp" : "jpg");
async function asset(name, size) {
  if (!size) return undefined;
  const rel = `${name}.${ext(size.format)}`;
  await makeImage(path.join(env.ASSET_DIR, rel), size);
  return `${env.ASSET_ORIGIN.replace(/\/$/, "")}/${rel}`;
}

// People: a throwaway key each, and an ENS-like profile.
const wallets = {};
for (const [id, p] of Object.entries(fixture.profiles)) {
  const key = Buffer.from(
    keccak256(Buffer.from(`kiwistand pagespeed fixture ${id}`)),
  ).toString("hex");
  const wallet = new Wallet(`0x${key}`);
  wallets[id] = wallet;
  const address = wallet.address;
  const avatar = await asset(`avatars/${id}`, p.avatar);
  const profile = {
    safeAvatar: avatar,
    address: address.toLowerCase(),
    avatar,
    avatar_small: avatar,
    avatar_url: avatar,
    ens: p.ens,
    ens_primary: p.ens,
    description: p.description,
    twitter: p.twitter,
    url: p.url,
    displayName: p.ens,
    truncatedAddress: `${address.slice(0, 6)}...${address.slice(-4)}`,
    neynarScore: p.neynarScore || 0,
    avatarChecked: true,
    ...(p.farcaster
      ? {
          farcaster: {
            fid: 100000 + Number(id.slice(1)),
            username: p.ens.replace(/\.eth$/, ""),
            display_name: p.ens.replace(/\.eth$/, ""),
            pfp_url: avatar || null,
            avatar,
          },
        }
      : {}),
  };
  for (const k of Object.keys(profile)) {
    if (profile[k] === undefined) delete profile[k];
  }
  await metadataCache.set(`ens-profile-${address.toLowerCase()}`, profile, {
    ttlMs: TTL,
  });
}

const trie = await Trie.create({
  db: new LMDB({ path: env.DATA_DIR, maxReaders: 500 }),
  useRootPersistence: true,
  useNodePruning: false,
});
async function put(by, message) {
  const signature = await wallets[by]._signTypedData(
    EIP712_DOMAIN,
    EIP712_MESSAGE,
    message,
  );
  const signed = { ...message, signature };
  const { index, canonical } = toDigest(signed);
  await trie.put(Buffer.from(index, "hex"), canonical);
  const address = wallets[by].address;
  inserted.push({ ...signed, index, signer: address, identity: address });
  return index;
}

const inserted = [];
let count = 0;
for (const [i, story] of fixture.stories.entries()) {
  const timestamp = now - story.age;
  const index = await put(story.by, {
    title: story.title,
    href: story.href,
    type: "amplify",
    timestamp,
  });
  count++;
  for (const upvote of story.upvotes) {
    await put(upvote.by, {
      title: story.title,
      href: story.href,
      type: "amplify",
      timestamp: Math.max(timestamp + 1, now - upvote.age),
    });
    count++;
  }
  let last = timestamp;
  for (const comment of story.comments) {
    const ts = Math.max(last + 1, now - comment.age);
    last = ts;
    const commentIndex = await put(comment.by, {
      title: comment.text,
      href: `kiwi:0x${index}`,
      type: "comment",
      timestamp: ts,
    });
    count++;
    for (const [j, reaction] of comment.reactions.entries()) {
      await put(reaction.by, {
        title: reaction.emoji,
        href: `kiwi:0x${commentIndex}`,
        type: "comment",
        timestamp: Math.min(now - 1, ts + 60 * (j + 1)),
      });
      count++;
    }
  }

  if (story.summary) summaries.write(index, story.summary);
  if (!/^https?:/.test(story.href)) continue;
  const metadata = { ...story.metadata };
  metadata.image = await asset(`og/s${i}`, story.media.image);
  metadata.twitterAuthorAvatar = await asset(
    `tw/s${i}`,
    story.media.twitterAuthorAvatar,
  );
  for (const k of Object.keys(metadata)) {
    if (metadata[k] === undefined) delete metadata[k];
  }
  await metadataCache.set(normalizeUrl(story.href, { stripWWW: false }), metadata, {
    ttlMs: TTL,
  });
}

// NOTE: A running node keeps its database between restarts, so like in
// production the server finds it filled (it only builds it from the trie
// when it's missing, and then other startup work races the build).
cache.initializeLtCache();
cache.initializeImpressions();
cache.initializeShares();
cache.initializeReactions();
cache.initialize(inserted);
cache.initializeNotifications();
cache.addCompoundIndexes();

console.log(
  `Seeded ${count} messages from ${fixture.stories.length} stories and ${Object.keys(wallets).length} people, images in ${env.ASSET_DIR}`,
);
// NOTE: Some imported modules keep timers or worker pools alive.
process.exit(0);
