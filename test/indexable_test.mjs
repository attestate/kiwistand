// @format
import test from "ava";
import { join } from "path";
import { env } from "process";

import Database from "better-sqlite3";
import htm from "htm";
import vhtml from "vhtml";

import {
  isIndexableStory,
  robotsMeta,
  MIN_SUMMARY_LENGTH,
} from "../src/indexable.mjs";
import { listSitemapEntries } from "../src/cache.mjs";
import { indexableEntries, buildMonthlySitemap } from "../src/sitemap.mjs";
import * as summaries from "../src/summaries.mjs";
import * as indexnow from "../src/indexnow.mjs";
import { isBanned } from "../src/views/moderation.mjs";
import { isIndexable } from "../src/views/story.mjs";

const html = htm.bind(vhtml);

const SUMMARY =
  "Client teams shipped the Fusaka upgrade on Ethereum mainnet on 3 December, raising the blob target and adding PeerDAS sampling. Core developers said the fork went smoothly and that the next upgrade, Glamsterdam, is planned for 2026.";
const ALICE = "0x00000000000000000000000000000000000000aa";
const BANNED = "0x00000000000000000000000000000000000000bb";
const policy = (extra = {}) => ({
  addresses: [],
  links: [],
  hrefs: {},
  titles: {},
  ...extra,
});

test("the summary fixture is long enough to count", (t) => {
  t.true(SUMMARY.length >= MIN_SUMMARY_LENGTH);
});

test("isIndexableStory: upvotes (including the submitter's)", (t) => {
  t.false(isIndexableStory({ upvotes: 1, comments: 0 }));
  t.false(isIndexableStory({ upvotes: 2, comments: 0 }));
  t.true(isIndexableStory({ upvotes: 3, comments: 0 }));
  t.true(isIndexableStory({ upvotes: 40, comments: 0 }));
  // Story pages have the upvoters array (submitter first) instead.
  t.false(isIndexableStory({ upvoters: [{}, {}], comments: [] }));
  t.true(isIndexableStory({ upvoters: [{}, {}, {}], comments: [] }));
  // A count wins over the array when both are there.
  t.false(isIndexableStory({ upvotes: 1, upvoters: [{}, {}, {}] }));
});

test("isIndexableStory: one comment is enough", (t) => {
  t.true(isIndexableStory({ upvotes: 1, comments: 1 }));
  t.true(isIndexableStory({ upvotes: 1, comments: [{ title: "Great read" }] }));
  t.false(isIndexableStory({ upvotes: 1, comments: [] }));
});

test("isIndexableStory: a summary counts with one upvote besides the submitter's", (t) => {
  const upvoted = { upvotes: 2, comments: 0 };
  t.true(isIndexableStory(upvoted, { summary: SUMMARY }));
  t.false(isIndexableStory(upvoted, { summary: "Too short." }));
  t.false(
    isIndexableStory(upvoted, {
      summary: ` ${"x".repeat(MIN_SUMMARY_LENGTH - 1)} `,
    }),
  );
  t.true(isIndexableStory(upvoted, { summary: "x".repeat(MIN_SUMMARY_LENGTH) }));
  t.false(isIndexableStory(upvoted, { summary: null }));
  t.false(isIndexableStory(upvoted, {}));
  t.false(isIndexableStory(upvoted));
  // Only the submitter's own upvote: a summary alone isn't enough.
  t.false(isIndexableStory({ upvotes: 1, comments: 0 }, { summary: SUMMARY }));
});

test("isIndexableStory: moderated stories are never indexable", (t) => {
  t.false(
    isIndexableStory(
      { upvotes: 50, comments: 10, hidden: true },
      { summary: SUMMARY },
    ),
  );
});

test("isIndexableStory: missing or odd data is not indexable", (t) => {
  t.false(isIndexableStory(null));
  t.false(isIndexableStory(undefined));
  t.false(isIndexableStory({}));
  t.false(isIndexableStory({ upvotes: "nope", comments: undefined }));
  t.true(isIndexableStory({ upvotes: "3" }));
});

test("isBanned: banned submitters and links, without ChainPatrol", (t) => {
  const config = policy({
    addresses: [BANNED],
    links: ["https://bad.example/x"],
  });
  t.true(isBanned({ identity: "0x00000000000000000000000000000000000000BB", href: "https://ok.example" }, config));
  t.true(isBanned({ identity: ALICE, href: "https://bad.example/x" }, config));
  t.true(isBanned({ identity: ALICE, href: "https://www.bad.example/x/" }, config));
  t.false(isBanned({ identity: ALICE, href: "https://ok.example" }, config));
  t.false(isBanned({ identity: ALICE, href: "data:text/plain,hi" }, config));
  t.false(isBanned({ identity: BANNED, href: "https://ok.example" }, null));
});

test("robotsMeta: weak story pages get noindex, strong ones don't", (t) => {
  const render = (story, summary, commentIndex = null) =>
    html`<head>
      ${robotsMeta({
        indexable: isIndexableStory(story, { summary }),
        commentIndex,
      })}
    </head>`.toString();
  // NOTE: One robots tag per page: noindex and Discover's large image
  // previews are merged, never two tags.
  const NOINDEX = `<meta name="robots" content="noindex, follow, max-image-preview:large">`;
  const INDEX = `<meta name="robots" content="max-image-preview:large">`;
  const tags = (page) => page.match(/name="robots"/g)?.length || 0;

  const weak = render({ upvotes: 1, comments: [] });
  t.true(weak.includes(NOINDEX));
  t.is(tags(weak), 1);

  const strong = render({ upvotes: 5, comments: [] });
  t.true(strong.includes(INDEX));
  t.is(tags(strong), 1);
  t.true(render({ upvotes: 2, comments: [] }, SUMMARY).includes(INDEX));
  t.true(render({ upvotes: 1, comments: [] }, SUMMARY).includes(NOINDEX));

  // A comment permalink duplicates its story, so it's always noindex.
  t.true(render({ upvotes: 5, comments: [] }, null, "0xabc").includes(NOINDEX));
});

test("story pages: isIndexable checks engagement, summary and moderation", async (t) => {
  const value = {
    title: "A story",
    href: "https://ok.example/story",
    identity: ALICE,
    upvotes: 1,
    upvoters: [{ identity: ALICE, timestamp: 1 }],
    comments: [],
  };
  const lists = (extra) => async () => policy(extra);

  t.false(await isIndexable("ab", value, { summary: null, getLists: lists() }));
  t.false(
    await isIndexable("ab", value, { summary: SUMMARY, getLists: lists() }),
  );
  t.true(
    await isIndexable(
      "ab",
      { ...value, upvotes: 2 },
      { summary: SUMMARY, getLists: lists() },
    ),
  );
  t.true(
    await isIndexable(
      "ab",
      { ...value, comments: [{ title: "Nice" }] },
      { summary: null, getLists: lists() },
    ),
  );
  t.false(
    await isIndexable(
      "ab",
      { ...value, upvotes: 9 },
      { summary: SUMMARY, getLists: lists({ addresses: [ALICE] }) },
    ),
  );
  // Unreachable moderation config doesn't hide the story.
  t.true(
    await isIndexable(
      "ab",
      { ...value, upvotes: 9 },
      {
        summary: null,
        getLists: async () => {
          throw new Error("sheet down");
        },
      },
    ),
  );
});

test("indexnow only pings indexable stories", (t) => {
  const data = {
    "01": { upvotes: 1, comments: [], summary: null },
    "02": { upvotes: 2, comments: [], summary: SUMMARY },
    "03": { upvotes: 4, comments: [], summary: null },
  };
  const stories = ["01", "02", "03", "04"].map((index) => ({ index }));
  const get = (index) => {
    if (!data[index]) throw new Error("not found");
    return data[index];
  };
  t.deepEqual(
    indexnow.indexable(stories, get).map(({ index }) => index),
    ["02", "03"],
  );
});

// Seeded in March 2019, a month no other test uses.
const unix = (y, m, d) => Date.UTC(y, m - 1, d) / 1000;
const MONTH = "2019-03";
const sid = (id) => `kiwi:0x${id.padStart(72, "0")}`;
const idx = (id) => id.padStart(72, "0");
const seeds = [
  // id, href, identity, upvotes (besides the submitter), comments
  ["ix1", "https://ix.example/weak", ALICE, 0, []],
  ["ix2", "https://ix.example/upvoted", ALICE, 2, []],
  ["ix3", "https://ix.example/discussed", ALICE, 0, [ALICE]],
  ["ix4", "https://ix.example/summarized", ALICE, 1, []],
  ["ix5", "https://ix.example/banned-author", BANNED, 9, [ALICE]],
  ["ix6", "https://ix.example/banned-link", ALICE, 9, []],
  // Its only comment is by a banned profile, which story pages hide.
  ["ix7", "https://ix.example/banned-commenter", ALICE, 0, [BANNED]],
  ["ix8", "https://ix.example/two-upvotes", ALICE, 1, []],
];

function openTestDb() {
  const db = new Database(join(env.CACHE_DIR, "database.db"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY NOT NULL, href TEXT NOT NULL UNIQUE, title TEXT NOT NULL, timestamp INTEGER NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS upvotes (id TEXT PRIMARY KEY NOT NULL, href TEXT NOT NULL, timestamp INTEGER NOT NULL, title TEXT NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY NOT NULL, submission_id TEXT NOT NULL, timestamp INTEGER NOT NULL, title TEXT NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL);
  `);
  return db;
}

function cleanup(db) {
  for (const [id, href] of seeds) {
    db.prepare(`DELETE FROM submissions WHERE id = ?`).run(sid(id));
    db.prepare(`DELETE FROM upvotes WHERE href = ?`).run(href);
    db.prepare(`DELETE FROM comments WHERE submission_id = ?`).run(sid(id));
  }
}

test.before(() => {
  const db = openTestDb();
  cleanup(db);
  seeds.forEach(([id, href, identity, upvotes, commenters], i) => {
    const timestamp = unix(2019, 3, 1 + i);
    db.prepare(
      `INSERT INTO submissions (id, href, title, timestamp, signer, identity) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(sid(id), href, `Story ${id}`, timestamp, identity, identity);
    for (let u = 0; u < upvotes; u++) {
      db.prepare(
        `INSERT INTO upvotes (id, href, timestamp, title, signer, identity) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(`ixup-${id}-${u}`, href, timestamp + 60, `Story ${id}`, ALICE, ALICE);
    }
    commenters.forEach((commenter, c) => {
      db.prepare(
        `INSERT INTO comments (id, submission_id, timestamp, title, signer, identity) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(`ixc-${id}-${c}`, sid(id), timestamp + 120, "hi", commenter, commenter);
    });
  });
  db.close();
  summaries.write(idx("ix4"), SUMMARY);
  // Unsafe (a link) and failed summaries don't count.
  summaries.write(idx("ix1"), `${SUMMARY} See https://evil.example/x`);
  summaries.write(idx("ix8"), null);
});

test.after.always(() => {
  const db = openTestDb();
  cleanup(db);
  db.close();
});

test("listSitemapEntries counts upvotes and comments", (t) => {
  const entries = listSitemapEntries(MONTH, [BANNED]);
  const byIndex = Object.fromEntries(entries.map((e) => [e.index, e]));
  t.is(byIndex[idx("ix1")].upvotes, 1);
  t.is(byIndex[idx("ix2")].upvotes, 3);
  t.is(byIndex[idx("ix3")].comments, 1);
  t.is(byIndex[idx("ix7")].comments, 0, "banned commenters don't count");
  t.is(listSitemapEntries(MONTH)[0].index, idx("ix8"), "newest first");
  t.is(
    listSitemapEntries(MONTH).find((e) => e.index === idx("ix7")).comments,
    1,
  );
});

test("listSafeSummaries skips unsafe and failed summaries", (t) => {
  const safe = summaries.listSafeSummaries();
  t.is(safe.get(idx("ix4")), SUMMARY);
  t.false(safe.has(idx("ix1")));
  t.false(safe.has(idx("ix8")));
});

test("monthly sitemap only lists indexable stories", (t) => {
  const config = policy({
    addresses: [BANNED],
    links: ["https://ix.example/banned-link"],
  });
  const entries = listSitemapEntries(MONTH, config.addresses);
  const kept = indexableEntries(entries, {
    policy: config,
    summaries: summaries.listSafeSummaries(),
  });
  t.deepEqual(
    kept.map(({ index }) => index),
    [idx("ix4"), idx("ix3"), idx("ix2")],
  );

  const xml = buildMonthlySitemap(kept);
  t.true(xml.includes(`/stories/Story-ix2?index=0x${idx("ix2")}</loc>`));
  t.true(xml.includes(`?index=0x${idx("ix3")}</loc>`));
  t.true(xml.includes(`?index=0x${idx("ix4")}</loc>`));
  for (const id of ["ix1", "ix5", "ix6", "ix7", "ix8"]) {
    t.false(xml.includes(`0x${idx(id)}<`), `${id} is left out`);
  }

  // Without a moderation config, nothing is treated as moderated.
  const unmoderated = indexableEntries(listSitemapEntries(MONTH), {
    summaries: summaries.listSafeSummaries(),
  }).map(({ index }) => index);
  t.true(unmoderated.includes(idx("ix5")));
  t.true(unmoderated.includes(idx("ix6")));
  t.true(unmoderated.includes(idx("ix7")));
});
