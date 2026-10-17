import test from "ava";

import { visibleEntries, buildMonthlySitemap } from "../src/sitemap.mjs";

const entries = [
  { index: "aa", title: "Kept story", timestamp: 1760000000, href: "https://ok.example/a", identity: "0x1" },
  { index: "bb", title: "Banned submitter", timestamp: 1760000100, href: "https://ok.example/b", identity: "0xbad" },
  { index: "cc", title: "Banned link", timestamp: 1760000200, href: "https://spam.example/", identity: "0x2" },
];

// Stand-in for moderation.moderate: drops banned identities and links.
const fakeModerate = (leaves, policy) =>
  leaves.filter(
    ({ identity, href }) =>
      !policy.addresses.includes(identity) && !policy.links.includes(href),
  );

test("drops stories moderation hides", (t) => {
  const policy = { addresses: ["0xbad"], links: ["https://spam.example/"] };
  const kept = visibleEntries(entries, policy, fakeModerate);
  t.deepEqual(kept.map(({ index }) => index), ["aa"]);
});

test("keeps the original entries, not moderation's rewritten copies", (t) => {
  const rewrite = (leaves) => leaves.map((l) => ({ ...l, title: "Rewritten" }));
  const kept = visibleEntries(entries, { addresses: [], links: [] }, rewrite);
  t.deepEqual(kept.map(({ title }) => title), entries.map(({ title }) => title));
});

test("without moderation lists nothing is dropped", (t) => {
  t.is(visibleEntries(entries, undefined, fakeModerate), entries);
});

test("a dropped story's URL isn't in the monthly sitemap", (t) => {
  const policy = { addresses: ["0xbad"], links: [] };
  const xml = buildMonthlySitemap(visibleEntries(entries, policy, fakeModerate));
  t.true(xml.includes("index=0xaa"));
  t.false(xml.includes("index=0xbb"));
});
