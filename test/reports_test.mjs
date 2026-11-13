//@format
import test from "ava";
import Database from "better-sqlite3";

import { parse, link, save } from "../src/reports.mjs";

const STORY = "0x6adb46ba6e4d8732f3aa74ccaa63998d7b8d1562abf208e81cdd993adee8507fdba01f24";
const USER = "0xee324c588cef1bf1c1360883e4318834af66366d";

test("parse accepts story, comment and user reports", (t) => {
  t.deepEqual(parse({ type: "story", id: STORY, reason: " spam " }), {
    type: "story",
    target: STORY,
    reason: "spam",
  });
  t.is(parse({ type: "comment", id: `kiwi:${STORY}` }).reason, "");
  t.is(parse({ type: "user", id: USER }).target, USER);
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
  t.is(link({ type: "comment", target: `kiwi:${STORY}` }), null);
});

test("save keeps the report with an ID and a time", (t) => {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL,
    target TEXT NOT NULL, reason TEXT NOT NULL, created INTEGER NOT NULL)`);
  const report = { type: "user", target: USER, reason: "abuse" };
  const saved = save(report, 1_700_000_000_000, db);
  t.is(saved.id, 1);
  t.is(saved.created, 1_700_000_000);
  t.deepEqual(db.prepare("SELECT type, target, reason FROM reports").get(), report);
});
