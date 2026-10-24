import test from "ava";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

import * as writers from "../src/writers.mjs";
import * as featured from "../src/featured.mjs";
import { FeaturedBadgeRow } from "../src/views/story.mjs";
import writersPage from "../src/views/writers.mjs";

const IDX = "a".repeat(72);

// --- Writers ------------------------------------------------------------

test("writerOf groups by site, and by handle on shared platforms", (t) => {
  t.is(writers.writerOf("https://www.vitalik.ca/general/2024/x.html").key, "vitalik.ca");
  t.is(writers.writerOf("https://x.com/Alice/status/1").key, "x.com/alice");
  t.is(writers.writerOf("https://twitter.com/alice/status/2").key, "x.com/alice");
  t.is(writers.writerOf("https://warpcast.com/bob/0xabc").key, "farcaster.xyz/bob");
  t.is(writers.writerOf("https://paragraph.xyz/@carol/post").key, "paragraph.xyz/@carol");
  t.is(writers.writerOf("https://x.com/i/article/1"), null);
  t.is(writers.writerOf("data:text/plain,hello"), null);
  t.is(writers.writerOf("kiwi:0x123"), null);
  t.is(writers.writerOf("not a url"), null);
});

test("leaderboard ranks writers by upvotes on their links", (t) => {
  const rows = [
    { index: "1", title: "A1", href: "https://a.com/1", upvotes: 5 },
    { index: "2", title: "A2", href: "https://a.com/2", upvotes: 4 },
    { index: "3", title: "B1", href: "https://b.com/1", upvotes: 8 },
    { index: "4", title: "X1", href: "https://x.com/al/status/1", upvotes: 2 },
    { index: "5", title: "Text", href: "data:text/plain,hi", upvotes: 50 },
    { index: "6", title: "A3", href: "https://a.com/3", upvotes: 1 },
    { index: "7", title: "A4", href: "https://a.com/4", upvotes: 1 },
  ];
  const board = writers.leaderboard(rows);
  t.deepEqual(
    board.map((e) => [e.rank, e.key, e.upvotes, e.count]),
    [
      [1, "a.com", 11, 4],
      [2, "b.com", 8, 1],
      [3, "x.com/al", 2, 1],
    ],
  );
  t.deepEqual(board[0].stories.map((s) => s.title), ["A1", "A2", "A3"]);
  t.is(board[0].stories[0].path, "/stories/A1?index=0x1");
  t.is(board[0].anchor, "w-a-com");
  t.is(writers.leaderboard(rows, { limit: 1 }).length, 1);
});

test("writerOf uses source keys: X mirrors, file hosts, Substack app links", (t) => {
  t.is(writers.writerOf("https://xcancel.com/Alice/status/1").key, "x.com/alice");
  t.is(writers.writerOf("https://xcancel.com/alice/status/1").url, "https://x.com/alice");
  t.is(writers.writerOf("https://open.substack.com/pub/kiwi/p/x").key, "kiwi.substack.com");
  t.is(writers.writerOf("https://files.catbox.moe/a.png"), null);
  t.is(writers.writerOf("https://docs.google.com/document/d/1"), null);
  t.is(writers.writerOf("https://imagedelivery.net/a/b/public"), null);
  t.is(writers.writerOf("https://firefly.social/post/farcaster/0xabc"), null);
});

test("leaderboard counts a writer's resubmissions once, the most upvoted", (t) => {
  const rows = [
    { index: "1", title: "Same story", href: "https://a.com/1", upvotes: 2 },
    { index: "2", title: "Same  Story ", href: "https://a.com/1?ref=x", upvotes: 9 },
    { index: "3", title: "Other title", href: "https://a.com/2", upvotes: 4 },
    { index: "4", title: "Other title, same link", href: "https://a.com/2", upvotes: 1 },
    { index: "5", title: "Unique", href: "https://a.com/3", upvotes: 1 },
    // The same title by another writer isn't a duplicate.
    { index: "6", title: "Same story", href: "https://b.com/1", upvotes: 3 },
  ];
  const board = writers.leaderboard(rows);
  t.deepEqual(
    board.map((e) => [e.key, e.upvotes, e.count]),
    [
      ["a.com", 14, 3],
      ["b.com", 3, 1],
    ],
  );
  t.deepEqual(
    board[0].stories.map((s) => [s.index, s.upvotes]),
    [
      ["2", 9],
      ["3", 4],
      ["5", 1],
    ],
  );
});

test("leaderboard merges Farcaster name and name.eth, and entryUrl finds both", (t) => {
  const board = writers.leaderboard([
    { index: "1", title: "A", href: "https://farcaster.xyz/al/0x1", upvotes: 2 },
    { index: "2", title: "B", href: "https://farcaster.xyz/al.eth/0x2", upvotes: 3 },
    { index: "3", title: "C", href: "https://warpcast.com/al.eth/0x3", upvotes: 1 },
  ]);
  t.deepEqual(
    board.map((e) => [e.key, e.upvotes, e.count, e.aliases]),
    [["farcaster.xyz/al.eth", 6, 3, ["farcaster.xyz/al"]]],
  );
  t.is(
    writers.entryUrl(board, "https://farcaster.xyz/al/0x9", "2026-10"),
    "https://news.kiwistand.com/writers?month=2026-10#w-farcaster-xyz-al-eth",
  );
});

test("leaderboard caps at 25 writers", (t) => {
  const rows = Array.from({ length: 40 }, (_, i) => ({
    index: String(i),
    title: `T${i}`,
    href: `https://site${i}.com/`,
    upvotes: i,
  }));
  const board = writers.leaderboard(rows);
  t.is(board.length, 25);
  t.is(board[0].key, "site39.com");
});

test("monthRange parses YYYY-MM and rejects the future and garbage", (t) => {
  const now = Date.parse("2026-10-24T12:00:00Z");
  const current = writers.monthRange(undefined, now);
  t.is(current.id, "2026-10");
  t.is(current.label, "October 2026");
  t.is(current.start, Date.parse("2026-10-01T00:00:00Z") / 1000);
  t.is(current.end, Date.parse("2026-11-01T00:00:00Z") / 1000);
  t.is(writers.monthRange("2026-02", now).end, Date.parse("2026-03-01T00:00:00Z") / 1000);
  t.is(writers.monthRange("2026-11", now), null);
  t.is(writers.monthRange("2026-13", now), null);
  t.is(writers.monthRange("<script>", now), null);
});

test("getLeaderboard keeps only the month's stories and moderates them", async (t) => {
  const range = writers.monthRange("2026-09", Date.parse("2026-10-24T00:00:00Z"));
  const rows = [
    { index: "1", title: "In", href: "https://a.com/1", upvotes: 3, timestamp: range.start + 10, identity: "0x1" },
    { index: "2", title: "Later", href: "https://a.com/2", upvotes: 9, timestamp: range.end + 10, identity: "0x1" },
    { index: "3", title: "Banned", href: "https://b.com/1", upvotes: 9, timestamp: range.start + 10, identity: "0xbad" },
  ];
  const board = await writers.getLeaderboard(range, {
    getBest: () => rows,
    moderation: {
      getLists: async () => ({}),
      moderate: (list) => list.filter((s) => s.identity !== "0xbad"),
    },
  });
  t.deepEqual(board.map((e) => [e.key, e.upvotes]), [["a.com", 3]]);
});

test("entryUrl links the writer's row only when they're on the board", (t) => {
  const board = writers.leaderboard([
    { index: "1", title: "A", href: "https://a.com/1", upvotes: 3 },
  ]);
  t.is(
    writers.entryUrl(board, "https://a.com/other", "2026-10"),
    "https://news.kiwistand.com/writers?month=2026-10#w-a-com",
  );
  t.is(writers.entryUrl(board, "https://b.com/x", "2026-10"), null);
});

test("writers page lists entries and says noindex below 10 entries", (t) => {
  const range = writers.monthRange("2026-09", Date.parse("2026-10-24T00:00:00Z"));
  const entries = writers.leaderboard([
    { index: "1", title: "Hello <b>", href: "https://a.com/1", upvotes: 3 },
  ]);
  const page = String(writersPage("light", { range, entries, previous: null }));
  t.true(page.includes("Top writers of September 2026"));
  t.true(page.includes('id="w-a-com"'));
  t.true(page.includes("Hello &lt;b&gt;"));
  t.true(page.includes('content="noindex, follow, max-image-preview:large"'));
  t.false(page.includes("<script>"));
  // Spaces around the meta, and between numbers and words.
  t.true(page.includes("</a> <span"));
  t.true(page.includes("3 upvotes · 1 story"));
  const list = page.match(/<ol class="n2-writers">.*?<\/ol>/s)[0];
  t.false(/\d(stories|story|upvotes?)\b/.test(list));
  t.false(/\S·|·\S/.test(list));
  t.false(list.includes("style="));
  const many = writers.leaderboard(
    Array.from({ length: 12 }, (_, i) => ({ index: String(i), title: `T${i}`, href: `https://s${i}.com/`, upvotes: 2 })),
  );
  const full = String(writersPage("light", { range, entries: many, previous: null }));
  t.false(full.includes("noindex"));
});

// --- Featured badge ------------------------------------------------------

test("badgeSvg shows rank and upvotes and escapes text", (t) => {
  const svg = featured.badgeSvg({ rank: 2, upvotes: 34 });
  t.true(svg.startsWith("<svg"));
  t.true(svg.includes("#2 on Kiwi · 34 upvotes"));
  t.true(svg.includes("Featured on Kiwi News"));
  t.is(featured.badgeText({ rank: null, upvotes: 1 }), "1 upvote");
  t.is(featured.badgeText({}), "Kiwi News");
});

test("parseBadgeParam accepts only story indexes", (t) => {
  t.is(featured.parseBadgeParam(`0x${IDX}.svg`), `0x${IDX}`);
  t.is(featured.parseBadgeParam(`${IDX.toUpperCase()}.svg`), `0x${IDX}`);
  t.is(featured.parseBadgeParam(`0x${IDX}.png`), null);
  t.is(featured.parseBadgeParam("../etc/passwd.svg"), null);
});

test("peakRank reads the reach state file, top 3 only", (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "featured-"));
  t.teardown(() => rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "reach.json");
  t.is(featured.peakRank(IDX, file), null);
  writeFileSync(file, JSON.stringify({ peak: { [IDX]: { rank: 2, at: 1 }, b: { rank: 7, at: 1 } } }));
  t.is(featured.peakRank(`0x${IDX}`, file), 2);
  t.is(featured.peakRank("b", file), null);
});

test("badge snippets link the story page and the badge", (t) => {
  const snippets = featured.badgeSnippets({ title: "Hello World", index: IDX });
  t.is(
    snippets.markdown,
    `[![Featured on Kiwi News](https://news.kiwistand.com/badge/0x${IDX}.svg)](https://news.kiwistand.com/stories/Hello-World?index=0x${IDX})`,
  );
  t.true(snippets.html.startsWith('<a href="https://news.kiwistand.com/stories/Hello-World'));
});

test("story page badge row has the snippets and no script", (t) => {
  const row = String(FeaturedBadgeRow({ title: "Hello World", index: IDX }, 1));
  t.true(row.includes("this story reached #1"));
  t.true(row.includes(`/badge/0x${IDX}.svg`));
  t.true(row.includes("&lt;a href="));
  t.false(row.includes("<script"));
});
