//@format
import test from "ava";
import { mkdtempSync, readFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

import { parse, link, row, save } from "../src/reports.mjs";

const STORY =
  "0x6adb46ba6e4d8732f3aa74ccaa63998d7b8d1562abf208e81cdd993adee8507fdba01f24";
const USER = "0xee324c588cef1bf1c1360883e4318834af66366d";
const NOW = Date.UTC(2026, 10, 14, 9, 30);

test("parse accepts story, comment and user reports", (t) => {
  t.deepEqual(parse({ type: "story", id: STORY, reason: " spam " }), {
    type: "story",
    target: STORY,
    reason: "spam",
  });
  t.is(parse({ type: "comment", id: `kiwi:${STORY}` }).reason, "");
  t.is(parse({ type: "user", id: USER }).target, USER);
  t.is(parse({ type: "account-deletion", id: USER }).type, "account-deletion");
});

test("parse rejects unknown types, odd IDs and long reasons", (t) => {
  t.throws(() => parse({ type: "post", id: STORY }));
  t.throws(() => parse({ type: "story" }));
  t.throws(() => parse({ type: "story", id: "" }));
  t.throws(() => parse({ type: "story", id: "<script>" }));
  t.throws(() => parse({ type: "story", id: "x".repeat(201) }));
  t.throws(() => parse({ type: "story", id: STORY, reason: 5 }));
  t.throws(() => parse({ type: "story", id: STORY, reason: "x".repeat(1001) }));
  t.throws(() => parse(undefined));
});

test("link points moderators to the story or the user", (t) => {
  t.is(
    link({ type: "story", target: STORY }),
    `https://news.kiwistand.com/stories?index=${STORY}`,
  );
  t.is(
    link({ type: "story", target: STORY.slice(2) }),
    `https://news.kiwistand.com/stories?index=${STORY}`,
  );
  t.is(
    link({ type: "user", target: USER }),
    `https://news.kiwistand.com/upvotes?address=${USER}`,
  );
  t.is(
    link({ type: "account-deletion", target: USER }),
    `https://news.kiwistand.com/upvotes?address=${USER}`,
  );
  t.is(link({ type: "comment", target: `kiwi:${STORY}` }), null);
});

test("row quotes fields and defuses formulas", (t) => {
  const report = { type: "user", target: USER, reason: '=HYPERLINK("x")' };
  t.is(
    row(report, NOW),
    `"2026-11-14T09:30:00.000Z","user","${USER}","'=HYPERLINK(""x"")",` +
      `"https://news.kiwistand.com/upvotes?address=${USER}"\n`,
  );
});

test("save appends to reports.csv with a header once", (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "reports-"));
  save(parse({ type: "story", id: STORY, reason: "spam" }), NOW, dir);
  save(parse({ type: "comment", id: `kiwi:${STORY}` }), NOW, dir);
  const lines = readFileSync(path.join(dir, "reports.csv"), "utf8")
    .trim()
    .split("\n");
  t.is(lines.length, 3);
  t.is(lines[0], `"time","type","id","reason","link"`);
  t.true(lines[1].includes(`"story","${STORY}","spam"`));
  t.true(lines[2].endsWith(`"comment","kiwi:${STORY}","",""`));
});
