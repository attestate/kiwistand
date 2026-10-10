// @format
import test from "ava";
import { join } from "path";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { env } from "process";

import Database from "better-sqlite3";
import normalizeUrl from "normalize-url";

import * as isoweek from "../src/isoweek.mjs";
import {
  getWeekStories,
  getNeighbourTimestamps,
  listWeeks,
} from "../src/cache.mjs";
import {
  autoIntro,
  selectStories,
  parseIntro,
  readIntro,
  topSources,
} from "../src/weekly.mjs";
import {
  buildWeeklySitemap,
  buildSitemapIndex,
  STATIC_SITEMAP,
} from "../src/sitemap.mjs";
import {
  weekPage,
  indexPage,
  weekJsonLd,
  weekTitle,
  groupWeeks,
} from "../src/views/weekly.mjs";

const unix = (y, m, d, h = 0) => Date.UTC(y, m - 1, d, h) / 1000;
const W = (year, week) => ({ year, week });
// Saturday 10 October 2026, in 2026-W41.
const NOW = Date.UTC(2026, 9, 10, 12);

test("weekOf handles ISO year boundaries", (t) => {
  t.deepEqual(isoweek.weekOf(unix(2026, 10, 10)), W(2026, 41));
  t.deepEqual(isoweek.weekOf(unix(2026, 10, 5)), W(2026, 41));
  t.deepEqual(isoweek.weekOf(unix(2026, 10, 4, 23)), W(2026, 40));
  // 2026 starts on a Thursday, so it has a week 53 that ends in 2027.
  t.deepEqual(isoweek.weekOf(unix(2025, 12, 29)), W(2026, 1));
  t.deepEqual(isoweek.weekOf(unix(2026, 12, 31)), W(2026, 53));
  t.deepEqual(isoweek.weekOf(unix(2027, 1, 3, 23)), W(2026, 53));
  t.deepEqual(isoweek.weekOf(unix(2027, 1, 4)), W(2027, 1));
  // 2025-W01 starts in December 2024.
  t.deepEqual(isoweek.weekOf(unix(2024, 12, 30)), W(2025, 1));
  t.deepEqual(isoweek.weekOf(unix(2024, 12, 29)), W(2024, 52));
  t.deepEqual(isoweek.weekOf(unix(2021, 1, 3)), W(2020, 53));
});

test("weeksInYear and range", (t) => {
  t.is(isoweek.weeksInYear(2026), 53);
  t.is(isoweek.weeksInYear(2025), 52);
  t.is(isoweek.weeksInYear(2020), 53);
  t.is(isoweek.weeksInYear(2021), 52);
  t.deepEqual(isoweek.range(W(2026, 41)), {
    start: unix(2026, 10, 5),
    end: unix(2026, 10, 12),
  });
  t.deepEqual(isoweek.range(W(2025, 1)), {
    start: unix(2024, 12, 30),
    end: unix(2025, 1, 6),
  });
  t.deepEqual(isoweek.range(W(2026, 53)), {
    start: unix(2026, 12, 28),
    end: unix(2027, 1, 4),
  });
  t.deepEqual(isoweek.range(W(2027, 1)).start, unix(2027, 1, 4));
});

test("parse and format", (t) => {
  t.is(isoweek.format(W(2026, 5)), "2026-W05");
  t.is(isoweek.path(W(2026, 41)), "/weekly/2026-W41");
  t.deepEqual(isoweek.parse("2026-W41"), W(2026, 41));
  t.deepEqual(isoweek.parse("2026-w5"), W(2026, 5));
  t.deepEqual(isoweek.parse("2026W05"), W(2026, 5));
  t.deepEqual(isoweek.parse("2026-W53"), W(2026, 53));
  t.is(isoweek.parse("2025-W53"), null);
  t.is(isoweek.parse("2026-W00"), null);
  t.is(isoweek.parse("2026-W54"), null);
  t.is(isoweek.parse("2026-10"), null);
  t.is(isoweek.parse("2026-W411"), null);
  t.is(isoweek.parse(undefined), null);
});

test("resolveRequest: canonical redirects, 404s and the current week", (t) => {
  const resolve = (value) => isoweek.resolveRequest(value, NOW);
  t.deepEqual(resolve("2026-W41"), {
    status: 200,
    week: W(2026, 41),
    isCurrent: true,
  });
  t.deepEqual(resolve("2026-W40"), {
    status: 200,
    week: W(2026, 40),
    isCurrent: false,
  });
  t.deepEqual(resolve("2026-w40"), {
    status: 308,
    location: "/weekly/2026-W40",
  });
  t.deepEqual(resolve("2026-W5"), { status: 308, location: "/weekly/2026-W05" });
  t.deepEqual(resolve("2026W05"), { status: 308, location: "/weekly/2026-W05" });
  t.deepEqual(resolve("2026-W42"), { status: 404 });
  t.deepEqual(resolve("2027-W01"), { status: 404 });
  t.deepEqual(resolve("2025-W53"), { status: 404 });
  t.deepEqual(resolve("latest"), { status: 404 });
});

test("date ranges", (t) => {
  t.is(isoweek.shortRange(W(2026, 41)), "Oct 5–11");
  t.is(isoweek.shortRange(W(2026, 40)), "Sep 28–Oct 4");
  t.is(isoweek.longRange(W(2026, 41)), "Mon 5 to Sun 11 October 2026");
  t.is(
    isoweek.longRange(W(2026, 40)),
    "Mon 28 September to Sun 4 October 2026",
  );
  t.is(
    isoweek.longRange(W(2026, 1)),
    "Mon 29 December 2025 to Sun 4 January 2026",
  );
  t.is(
    weekTitle(W(2026, 41)),
    "Top crypto stories, week 41 2026 (Oct 5–11)",
  );
});

const story = (n, href, extra = {}) => ({
  index: `${n}`.padStart(72, "0"),
  title: `Story ${n}`,
  href,
  identity: "0x0000000000000000000000000000000000000001",
  displayName: "alice.eth",
  timestamp: unix(2026, 10, 6),
  upvotes: 10 - n,
  comments: n,
  ...extra,
});

test("autoIntro", (t) => {
  const stories = [
    story(1, "https://github.com/a/b"),
    story(2, "https://www.x.com/a/status/1"),
    story(3, "https://github.com/c/d"),
    story(4, "https://x.com/b/status/2"),
    story(5, "https://paragraph.com/@a/b"),
    story(6, "data:text/plain;charset=utf-8,hello"),
  ];
  t.deepEqual(topSources(stories), ["github.com", "x.com"]);
  t.is(
    autoIntro(W(2026, 40), stories),
    "The 6 top stories on Kiwi News from Mon 28 September to Sun 4 October 2026, ranked by upvotes, comments and clicks, with 21 comments in total. Most-shared sources: github.com, x.com.",
  );
  t.is(
    autoIntro(W(2026, 41), [story(1, "https://example.com/a")], true),
    "The top story on Kiwi News so far this week (Mon 5 to Sun 11 October 2026), ranked by upvotes, comments and clicks, with 1 comment in total.",
  );
});

test("parseIntro and readIntro", async (t) => {
  t.deepEqual(parseIntro("First line\nstill first.\r\n\r\n\n  Second  \n\n"), [
    "First line still first.",
    "Second",
  ]);
  const dir = mkdtempSync(join(tmpdir(), "weekly-intro-"));
  writeFileSync(join(dir, "2026-W40.md"), "Hello <b>world</b>.\n\nBye.\n");
  t.deepEqual(await readIntro(W(2026, 40), dir), ["Hello <b>world</b>.", "Bye."]);
  t.is(await readIntro(W(2026, 39), dir), null);
});

// A small seeded week: 2024-W10 (Mon 4 to Sun 10 March 2024).
const SEED_WEEK = W(2024, 10);
const BANNED = "0x00000000000000000000000000000000000000bb";
const ALICE = "0x00000000000000000000000000000000000000aa";
const seeds = [
  // id, href, timestamp, identity, upvotes, comments, clicks
  ["a1", "https://a.example/one", unix(2024, 3, 4, 1), ALICE, 5, 0, 0],
  ["b2", "https://b.example/two", unix(2024, 3, 5), ALICE, 2, 4, 2],
  ["c3", "https://c.example/banned-author", unix(2024, 3, 6), BANNED, 9, 0, 0],
  ["d4", "https://d.example/banned-link", unix(2024, 3, 7), ALICE, 8, 0, 0],
  ["e5", "https://imagedelivery.net/x/y/public", unix(2024, 3, 8), ALICE, 7, 0, 0],
  ["f6", "https://f.example/low", unix(2024, 3, 10, 23), ALICE, 0, 0, 0],
  // Outside the week, on both sides.
  ["g7", "https://g.example/before", unix(2024, 2, 20), ALICE, 20, 0, 0],
  ["h8", "https://h.example/after", unix(2024, 3, 11), ALICE, 20, 0, 0],
];
const sid = (id) => `kiwi:0x${id.padStart(72, "0")}`;

function openTestDb() {
  const db = new Database(join(env.CACHE_DIR, "database.db"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY NOT NULL, href TEXT NOT NULL UNIQUE, title TEXT NOT NULL, timestamp INTEGER NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS upvotes (id TEXT PRIMARY KEY NOT NULL, href TEXT NOT NULL, timestamp INTEGER NOT NULL, title TEXT NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY NOT NULL, submission_id TEXT NOT NULL, timestamp INTEGER NOT NULL, title TEXT NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS fingerprints (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL, hash TEXT NOT NULL, timestamp INTEGER NOT NULL);
  `);
  return db;
}

function cleanup(db) {
  for (const [id, href] of seeds) {
    db.prepare(`DELETE FROM submissions WHERE id = ?`).run(sid(id));
    db.prepare(`DELETE FROM upvotes WHERE href = ?`).run(href);
    db.prepare(`DELETE FROM comments WHERE submission_id = ?`).run(sid(id));
    db.prepare(`DELETE FROM fingerprints WHERE url = ?`).run(href);
  }
}

test.before(() => {
  const db = openTestDb();
  cleanup(db);
  for (const [id, href, timestamp, identity, upvotes, comments, clicks] of seeds) {
    db.prepare(
      `INSERT INTO submissions (id, href, title, timestamp, signer, identity) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(sid(id), href, `Title ${id}`, timestamp, identity, identity);
    for (let i = 0; i < upvotes; i++) {
      db.prepare(
        `INSERT INTO upvotes (id, href, timestamp, title, signer, identity) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(`up-${id}-${i}`, href, timestamp + 60, `Title ${id}`, ALICE, ALICE);
    }
    for (let i = 0; i < comments; i++) {
      // The last comment arrives three weeks later.
      db.prepare(
        `INSERT INTO comments (id, submission_id, timestamp, title, signer, identity) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(`c-${id}-${i}`, sid(id), timestamp + i * 7 * 86400, "hi", ALICE, ALICE);
    }
    for (let i = 0; i < clicks; i++) {
      db.prepare(
        `INSERT INTO fingerprints (url, hash, timestamp) VALUES (?, ?, ?)`,
      ).run(href, `hash-${i}`, timestamp);
      // Repeat clicks from the same reader don't count twice.
      db.prepare(
        `INSERT INTO fingerprints (url, hash, timestamp) VALUES (?, ?, ?)`,
      ).run(href, `hash-${i}`, timestamp);
    }
  }
  db.close();
});

test.after.always(() => {
  const db = openTestDb();
  cleanup(db);
  db.close();
});

test("getWeekStories ranks one week like the newsletter", (t) => {
  const { start, end } = isoweek.range(SEED_WEEK);
  const stories = getWeekStories(start, end, 40);
  // b2: (2 + 1) * 3 + 4 * 2 + 2 = 19 beats a1: (5 + 1) * 3 = 18.
  t.deepEqual(
    stories.map((s) => [s.index.replace(/^0+/, ""), s.upvotes, s.comments, s.clicks]),
    [
      ["c3", 10, 0, 0],
      ["d4", 9, 0, 0],
      ["e5", 8, 0, 0],
      ["b2", 3, 4, 2],
      ["a1", 6, 0, 0],
      ["f6", 1, 0, 0],
    ],
  );
  t.is(getWeekStories(start, end, 2).length, 2);
});

test("selectStories applies moderation and drops image uploads", (t) => {
  const { start, end } = isoweek.range(SEED_WEEK);
  const policy = {
    titles: { [normalizeUrl("https://a.example/one")]: "Better title" },
    hrefs: {},
    addresses: [BANNED],
    links: [normalizeUrl("https://d.example/banned-link")],
    labels: {},
  };
  const stories = selectStories(getWeekStories(start, end, 40), policy);
  t.deepEqual(
    stories.map((s) => s.index.replace(/^0+/, "")),
    ["b2", "a1", "f6"],
  );
  t.is(stories[1].title, "Better title");
  t.is(selectStories(getWeekStories(start, end, 40), policy, 1).length, 1);
});

test("getNeighbourTimestamps and listWeeks", (t) => {
  const { start, end } = isoweek.range(SEED_WEEK);
  const { previous, next } = getNeighbourTimestamps(start, end);
  t.deepEqual(isoweek.weekOf(previous), W(2024, 8));
  t.deepEqual(isoweek.weekOf(next), W(2024, 11));

  const find = (rows) =>
    rows.find((row) => isoweek.compare(isoweek.weekOf(row.start), SEED_WEEK) === 0);
  const plain = find(listWeeks());
  t.is(plain.start, start);
  t.is(plain.stories, 6);
  t.is(plain.lastActivity, unix(2024, 3, 10, 23));
  // With activity, b2's last comment (3 weeks after it was posted) counts.
  t.is(find(listWeeks({ activity: true })).lastActivity, unix(2024, 3, 5) + 3 * 7 * 86400);
});

test("weekly sitemap lists past and current weeks", (t) => {
  const xml = buildWeeklySitemap(
    [
      { start: isoweek.range(W(2026, 42)).start, stories: 1, lastActivity: unix(2026, 10, 13) },
      { start: isoweek.range(W(2026, 41)).start, stories: 3, lastActivity: unix(2026, 10, 10) },
      { start: isoweek.range(W(2026, 1)).start, stories: 3, lastActivity: unix(2026, 2, 1) },
    ],
    NOW,
  );
  t.true(
    xml.includes(
      "<url><loc>https://news.kiwistand.com/weekly/2026-W41</loc><lastmod>2026-10-10</lastmod></url>",
    ),
  );
  t.true(
    xml.includes(
      "<url><loc>https://news.kiwistand.com/weekly/2026-W01</loc><lastmod>2026-02-01</lastmod></url>",
    ),
  );
  t.false(xml.includes("2026-W42"));
  t.true(
    buildSitemapIndex(["2026-10"]).includes(
      "<loc>https://news.kiwistand.com/sitemap-weekly.xml</loc>",
    ),
  );
  t.true(STATIC_SITEMAP.includes("<loc>https://news.kiwistand.com/weekly</loc>"));
});

const renderStories = [
  story(1, "https://github.com/a/b", {
    title: 'Fusaka & "blobs" <explained>',
    summary: "A short summary of the article.",
  }),
  story(2, "data:text/plain;charset=utf-8,hello", { summary: null }),
  story(3, "https://vitalik.eth.limo/general/2026/10/06/post.html", {
    summary: "Another summary.",
  }),
];

test("weekJsonLd is a CollectionPage with an ItemList of story URLs", (t) => {
  const data = JSON.parse(weekJsonLd(W(2026, 40), renderStories, "desc"));
  t.is(data["@type"], "CollectionPage");
  t.is(data.url, "https://news.kiwistand.com/weekly/2026-W40");
  t.is(data.mainEntity["@type"], "ItemList");
  t.is(data.mainEntity.numberOfItems, 3);
  t.deepEqual(data.mainEntity.itemListElement[2], {
    "@type": "ListItem",
    position: 3,
    url: `https://news.kiwistand.com/stories/Story-3?index=0x${renderStories[2].index}`,
    name: "Story 3",
  });
  t.false(weekJsonLd(W(2026, 40), renderStories, "desc").includes("<"));
});

test("weekPage renders the week", async (t) => {
  const page = await weekPage(null, {
    week: W(2026, 40),
    isCurrent: false,
    stories: renderStories,
    previous: W(2026, 38),
    next: W(2026, 41),
    intro: null,
  });
  t.is(page.match(/<h1[ >]/g).length, 1);
  t.true(page.includes("<title>Top crypto stories, week 40 2026 (Sep 28–Oct 4) | Kiwi News</title>"));
  t.true(page.includes('<link rel="canonical" href="https://news.kiwistand.com/weekly/2026-W40"'));
  // Relative stylesheet/script paths must not resolve under /weekly/.
  t.true(page.includes('<base href="/"'));
  t.true(page.includes('<script type="application/ld+json">'));
  t.true(page.includes(`href="/stories/Story-3?index=0x${renderStories[2].index}"`));
  t.true(page.includes("Fusaka &amp; &quot;blobs&quot; &lt;explained&gt;"));
  t.true(page.includes("(github.com)"));
  t.true(page.includes("A short summary of the article."));
  t.is(page.match(/AI summary/g).length, 1);
  t.true(page.includes("The 3 top stories on Kiwi News from Mon 28 September"));
  t.true(page.includes('href="/weekly/2026-W38"'));
  t.true(page.includes('href="/weekly/2026-W41"'));
  t.true(page.includes('<newsletter-card data-source="weekly">'));
  // No inline scripts besides the JSON-LD.
  const inline = page.match(/<script(?![^>]*\bsrc=)[^>]*>/g) || [];
  t.deepEqual(inline, ['<script type="application/ld+json">']);

  const withIntro = await weekPage(null, {
    week: W(2026, 40),
    isCurrent: true,
    stories: [renderStories[1]],
    previous: null,
    next: null,
    intro: ["Editorial <b>intro</b>."],
  });
  t.true(withIntro.includes("<p>Editorial &lt;b&gt;intro&lt;/b&gt;.</p>"));
  t.false(withIntro.includes("AI summary"));
  t.false(withIntro.includes('rel="prev"'));
});

test("indexPage groups weeks by year and month", async (t) => {
  const weeks = [W(2026, 41), W(2026, 40), W(2026, 1), W(2025, 52)].map(
    (week) => ({ week }),
  );
  const groups = groupWeeks(weeks);
  t.deepEqual(
    groups.map(({ year, months }) => [year, months.map((m) => m.month)]),
    [
      [2026, [9, 0]],
      [2025, [11]],
    ],
  );
  const page = await indexPage(null, weeks, NOW);
  t.is(page.match(/<h1[ >]/g).length, 1);
  t.true(page.includes('<link rel="canonical" href="https://news.kiwistand.com/weekly"'));
  t.true(page.includes('href="/weekly/2026-W01"'));
  t.true(page.includes("Week 41: Oct 5–11"));
  t.true(page.includes("(this week)"));
  t.true(page.includes("since December 2025"));
});
