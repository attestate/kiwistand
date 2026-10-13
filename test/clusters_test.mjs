import test from "ava";

import { parseGroups, arrange, candidates, describe, buildPrompt } from "../src/clusters.mjs";

const now = 1_800_000_000;
const story = (index, timestamp, title, extra = {}) => ({ index, timestamp, title, ...extra });

test("parseGroups keeps valid groups and drops the rest", (t) => {
  const list = [story("a", 4, "A"), story("b", 3, "B"), story("c", 2, "C"), story("d", 1, "D")];
  const groups = parseGroups(
    {
      groups: [
        { headline: "Ledger devices from a reseller had an implant", stories: [0, 2, 9] },
        { headline: "Only one", stories: [1] },
        { headline: "Reused story", stories: [2, 3] },
        { headline: "", stories: [1, 3] },
      ],
    },
    list,
  );
  t.deepEqual(groups, [
    { id: "c", headline: "Ledger devices from a reseller had an implant", members: ["a", "c"] },
  ]);
});

test("parseGroups survives a malformed answer", (t) => {
  t.deepEqual(parseGroups(null, []), []);
  t.deepEqual(parseGroups({ groups: [{ stories: "x" }] }, []), []);
});

test("arrange puts a group where its newest story was", (t) => {
  const stories = [story("n1", 9, "1"), story("g1", 8, "2"), story("n2", 7, "3"), story("g2", 6, "4")];
  const groups = new Map([
    ["g1", { id: "g2", headline: "H" }],
    ["g2", { id: "g2", headline: "H" }],
  ]);
  const out = arrange(stories, groups);
  t.deepEqual(out.map((e) => e.type), ["story", "group", "story"]);
  t.deepEqual(out[1].group.stories.map((s) => s.index), ["g1", "g2"]);
});

test("arrange shows a lone group member as a normal story", (t) => {
  const stories = [story("g1", 8, "2"), story("x", 7, "3")];
  const groups = new Map([["g1", { id: "g1", headline: "H" }]]);
  t.deepEqual(arrange(stories, groups).map((e) => e.type), ["story", "story"]);
});

test("candidates takes the last two days, newest first", (t) => {
  const list = candidates(
    [story("old", now - 3 * 86400, "old"), story("b", now - 100, "b"), story("a", now - 10, "a")],
    now,
  );
  t.deepEqual(list.map((s) => s.index), ["a", "b"]);
});

test("describe adds a tweet's text without links", (t) => {
  t.is(
    describe(story("a", 1, "@MagicalTux: spy SIM", { metadata: { ogDescription: "This is the spy SIM card https://t.co/x in a Ledger" } })),
    "@MagicalTux: spy SIM — This is the spy SIM card in a Ledger",
  );
  t.true(buildPrompt([story("a", 1, "Title")]).includes("[0] Title"));
});
