// @format
import test from "ava";
import { join } from "path";
import { env } from "process";

import Database from "better-sqlite3";

import {
  RETURNING_AFTER_DAYS,
  hasName,
  classify,
  awayFor,
  creditFor,
  creditText,
  creditForStory,
} from "../src/credit.mjs";
import { getPreviousSubmission } from "../src/cache.mjs";
import CreditLine from "../src/views/components/credit.mjs";

const DAY = 24 * 60 * 60;
const NOW = Date.UTC(2026, 9, 11) / 1000;
const ADDRESS = "0xC0B37550389d7569a1f23f2A4721b04689353D80";

test("the returning threshold is 90 days", (t) => {
  t.is(RETURNING_AFTER_DAYS, 90);
});

test("hasName rejects addresses and empty names", (t) => {
  t.true(hasName("alice.eth"));
  t.true(hasName("@alice"));
  t.true(hasName("maya"));
  // Names that merely start with 0x are fine.
  t.true(hasName("0xmike"));
  t.true(hasName("0xabc.eth"));
  t.false(hasName("0xC0B3...3D80"));
  t.false(hasName("0xc0b3…3d80"));
  t.false(hasName(ADDRESS));
  t.false(hasName(""));
  t.false(hasName("   "));
  t.false(hasName(null));
  t.false(hasName(undefined));
  t.false(hasName(42));
});

test("classify: first story ever is new", (t) => {
  t.is(classify(NOW, null), "new");
  t.is(classify(NOW, undefined), "new");
});

test("classify: back after 90+ days is returning", (t) => {
  t.is(classify(NOW, NOW - 90 * DAY), "returning");
  t.is(classify(NOW, NOW - 400 * DAY), "returning");
});

test("classify: a recent previous story gets no credit", (t) => {
  t.is(classify(NOW, NOW - 89 * DAY), null);
  t.is(classify(NOW, NOW - 3 * DAY), null);
  t.is(classify(NOW, NOW - 90 * DAY + 1), null);
});

test("classify: bad input gets no credit", (t) => {
  t.is(classify(undefined, null), null);
  t.is(classify(NaN, null), null);
  t.is(classify(NOW, "yesterday"), null);
});

test("awayFor puts the gap in words", (t) => {
  t.is(awayFor(90 * DAY), "3 months");
  t.is(awayFor(155 * DAY), "5 months");
  t.is(awayFor(364 * DAY), "12 months");
  t.is(awayFor(365 * DAY), "1 year");
  t.is(awayFor(800 * DAY), "2 years");
});

test("creditFor: new and returning curators with a name", (t) => {
  const fresh = creditFor({
    displayName: "alice.eth",
    timestamp: NOW,
    previous: null,
  });
  t.deepEqual(fresh, { kind: "new", name: "alice.eth" });
  t.is(creditText(fresh), "First story from alice.eth — welcome!");

  const back = creditFor({
    displayName: "alice.eth",
    timestamp: NOW,
    previous: NOW - 155 * DAY,
  });
  t.deepEqual(back, { kind: "returning", name: "alice.eth", away: "5 months" });
  t.is(creditText(back), "alice.eth is back after 5 months");
});

test("creditFor: regulars get no credit", (t) => {
  t.is(
    creditFor({
      displayName: "alice.eth",
      timestamp: NOW,
      previous: NOW - 10 * DAY,
    }),
    null,
  );
  t.is(creditText(null), "");
});

test("creditFor: no name, no credit (never a 0x address)", (t) => {
  for (const displayName of ["0xC0B3...3D80", ADDRESS, "", null, undefined]) {
    t.is(creditFor({ displayName, timestamp: NOW, previous: null }), null);
    t.is(
      creditFor({ displayName, timestamp: NOW, previous: NOW - 200 * DAY }),
      null,
    );
  }
});

test("creditForStory uses the lookup and fails quietly", (t) => {
  const story = { identity: ADDRESS, timestamp: NOW };
  t.deepEqual(
    creditForStory(story, "maya", () => null),
    { kind: "new", name: "maya" },
  );
  t.deepEqual(creditForStory(story, "maya", () => NOW - 120 * DAY), {
    kind: "returning",
    name: "maya",
    away: "4 months",
  });
  t.is(creditForStory(story, "maya", () => NOW - DAY), null);
  t.is(
    creditForStory(story, "maya", () => {
      throw new Error("db down");
    }),
    null,
  );
  // No name: the database isn't even asked.
  let asked = false;
  t.is(
    creditForStory(story, "0xC0B3...3D80", () => {
      asked = true;
      return null;
    }),
    null,
  );
  t.false(asked);
  t.is(creditForStory({ timestamp: NOW }, "maya", () => null), null);
});

test("CreditLine renders the web credit, never for an address", (t) => {
  const fresh = CreditLine({ kind: "new", name: "maya" }, ADDRESS);
  t.true(fresh.includes("First story from"));
  t.true(fresh.includes(`href="/upvotes?address=${ADDRESS}"`));
  t.true(fresh.includes(">maya</a>"));

  const back = CreditLine(
    { kind: "returning", name: "alice.eth", away: "5 months" },
    ADDRESS,
  );
  t.true(back.includes(">alice.eth</a> is back after 5 months"));

  t.is(CreditLine(null, ADDRESS), null);
  t.is(CreditLine({ kind: "new", name: "0xC0B3...3D80" }, ADDRESS), null);
  t.is(CreditLine({ kind: "returning", name: "maya" }, ADDRESS), null);
  // Names are escaped.
  const escaped = CreditLine({ kind: "new", name: "<b>x</b>" }, ADDRESS);
  t.false(escaped.includes("<b>"));
});

const CURATOR = "0x00000000000000000000000000000000c4ed17a1";
const OTHER = "0x00000000000000000000000000000000c4ed17a2";
const seeds = [
  ["c1", CURATOR, NOW - 400 * DAY],
  ["c2", CURATOR, NOW - 200 * DAY],
  ["c3", CURATOR, NOW],
  ["c4", OTHER, NOW - 5 * DAY],
];
const sid = (id) => `kiwi:0x${id.padStart(72, "0")}`;

function openTestDb() {
  const db = new Database(join(env.CACHE_DIR, "database.db"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY NOT NULL, href TEXT NOT NULL UNIQUE, title TEXT NOT NULL, timestamp INTEGER NOT NULL, signer TEXT NOT NULL, identity TEXT NOT NULL);
  `);
  return db;
}

function cleanup(db) {
  for (const [id] of seeds) {
    db.prepare(`DELETE FROM submissions WHERE id = ?`).run(sid(id));
  }
}

test.before(() => {
  const db = openTestDb();
  cleanup(db);
  for (const [id, identity, timestamp] of seeds) {
    db.prepare(
      `INSERT INTO submissions (id, href, title, timestamp, signer, identity) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(sid(id), `https://credit.example/${id}`, id, timestamp, identity, identity);
  }
  db.close();
});

test.after.always(() => {
  const db = openTestDb();
  cleanup(db);
  db.close();
});

test("getPreviousSubmission finds the curator's story before this one", (t) => {
  t.is(getPreviousSubmission(CURATOR, NOW), NOW - 200 * DAY);
  t.is(getPreviousSubmission(CURATOR, NOW - 200 * DAY), NOW - 400 * DAY);
  t.is(getPreviousSubmission(CURATOR, NOW - 400 * DAY), null);
  t.is(getPreviousSubmission(OTHER, NOW - 5 * DAY), null);
  t.is(getPreviousSubmission("0xnobody", NOW), null);

  // End to end: back after 200 days, first story ever.
  t.deepEqual(
    creditForStory({ identity: CURATOR, timestamp: NOW }, "maya", getPreviousSubmission),
    { kind: "returning", name: "maya", away: "6 months" },
  );
  t.deepEqual(
    creditForStory(
      { identity: CURATOR, timestamp: NOW - 400 * DAY },
      "maya",
      getPreviousSubmission,
    ),
    { kind: "new", name: "maya" },
  );
});
