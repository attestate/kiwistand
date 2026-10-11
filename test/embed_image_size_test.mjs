// @format
import test from "ava";
import sharp from "sharp";

import { measureImage } from "../src/parser.mjs";
import row, { embedImageSize } from "../src/views/components/row.mjs";
import Database from "better-sqlite3";
import { join } from "path";

// The row counts outbound clicks from the sqlite cache. Create only that
// table (as test/weekly_test.mjs does) so the shared test db keeps no
// foreign keys that other test files trip over.
test.before(() => {
  const db = new Database(join(process.env.CACHE_DIR, "database.db"));
  db.exec(
    `CREATE TABLE IF NOT EXISTS fingerprints (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL, hash TEXT NOT NULL, timestamp INTEGER NOT NULL);`,
  );
  db.close();
});

const png = (width, height) =>
  sharp({
    create: { width, height, channels: 3, background: "#888" },
  })
    .png()
    .toBuffer();

test("measureImage returns the real size of a usable image", async (t) => {
  t.deepEqual(await measureImage(await png(600, 820)), {
    width: 600,
    height: 820,
  });
});

test("measureImage reports the displayed size of an EXIF-rotated image", async (t) => {
  const rotated = await sharp(await png(800, 400))
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  t.deepEqual(await measureImage(rotated), { width: 400, height: 800 });
});

test("measureImage rejects images outside the preview limits", async (t) => {
  t.is(await measureImage(await png(200, 100)), null);
  t.is(await measureImage(await png(4100, 1000)), null);
  t.is(await measureImage(await png(300, 3100)), null);
});

test("embedImageSize uses real dimensions and falls back to 16:9", (t) => {
  t.deepEqual(embedImageSize(1200, 1640), { width: 1200, height: 1640 });
  t.deepEqual(embedImageSize("1200", "1640"), { width: 1200, height: 1640 });
  t.deepEqual(embedImageSize(), { width: 600, height: 338 });
  t.deepEqual(embedImageSize(0, 100), { width: 600, height: 338 });
  t.deepEqual(embedImageSize(NaN, 100), { width: 600, height: 338 });
});

const tweet = (metadata) => ({
  index: "0001",
  href: "https://x.com/someone/status/1234567890",
  title: "A tweet with a tall image",
  timestamp: Math.floor(Date.now() / 1000) - 60,
  identity: "0x0000000000000000000000000000000000000001",
  displayName: "someone",
  upvotes: 1,
  upvoters: [],
  metadata: {
    ogDescription: "Look at this",
    twitterCreator: "@someone",
    image: "https://pbs.twimg.com/media/tall.jpg",
    ...metadata,
  },
});

const tweetImg = (markup) => {
  const match = String(markup).match(/<img[^>]*alt="Tweet image"[^>]*>/);
  return match && match[0];
};

test("a tweet image gets its real width/height attributes", (t) => {
  const markup = row(0, "/new")(
    tweet({ imageWidth: 1200, imageHeight: 1640 }),
    0,
  );
  const img = tweetImg(markup);
  t.truthy(img);
  t.regex(img, /width="1200"/);
  t.regex(img, /height="1640"/);
  t.regex(img, /max-height: 125cqw/);
});

test("a tweet image from an older cache entry keeps the placeholder", (t) => {
  const img = tweetImg(row(0, "/new")(tweet({}), 0));
  t.truthy(img);
  t.regex(img, /width="600"/);
  t.regex(img, /height="338"/);
});

test("a Bluesky image gets its reported aspect ratio", (t) => {
  const markup = String(
    row(0, "/new")(
      {
        ...tweet({}),
        href: "https://bsky.app/profile/someone.bsky.social/post/3abc",
        metadata: {
          blueskyPost: {
            author: { handle: "someone.bsky.social", displayName: "someone" },
            text: "hi",
            images: ["https://cdn.bsky.app/img/feed_thumbnail/plain/x.jpg"],
            imageSizes: [{ width: 1000, height: 1500 }],
          },
        },
      },
      0,
    ),
  );
  const img = markup.match(/<img[^>]*alt="Post image"[^>]*>/)[0];
  t.regex(img, /width="1000"/);
  t.regex(img, /height="1500"/);
});

test("a Farcaster cast image gets Neynar's reported size", (t) => {
  const markup = String(
    row(0, "/new")(
      {
        ...tweet({}),
        href: "https://farcaster.xyz/someone/0xabc123",
        metadata: {
          farcasterCast: {
            author: { username: "someone", displayName: "someone" },
            text: "hi",
            hash: "0xabc123",
            embeds: [
              {
                url: "https://imagedelivery.net/x/y.png",
                metadata: { image: { width_px: 800, height_px: 1000 } },
              },
            ],
          },
        },
      },
      0,
    ),
  );
  const img = markup.match(/<img[^>]*alt="Cast image"[^>]*>/)[0];
  t.regex(img, /width="800"/);
  t.regex(img, /height="1000"/);
});
