//@format
import test from "ava";

import { hasName, showInHot, MIN_NAMED_UPVOTERS } from "../src/hotnames.mjs";

const named = { ens: "alice.eth" };
const nameless = { displayName: "0x1234…abcd" };
const profiles = {
  "0xa": { ens: "a.eth" },
  "0xb": { farcaster: { username: "b" } },
  "0xc": { kiwiProfile: { name: "carol" }, displayName: "carol" },
  "0xd": nameless,
};
const resolve = async (address) => profiles[address] || nameless;

test("a Kiwi nickname counts as a name", (t) => {
  t.true(hasName({ kiwiProfile: { name: "carol" } }));
  t.true(hasName(named));
  t.false(hasName(nameless));
  t.false(hasName(undefined));
});

test("a named submitter is always shown", async (t) => {
  t.true(await showInHot({ submitter: named, upvoters: [] }, resolve));
});

test("a nameless submitter needs enough named upvoters", async (t) => {
  t.is(MIN_NAMED_UPVOTERS, 2);
  const story = (upvoters) => ({
    identity: "0xS",
    submitter: nameless,
    upvoters: ["0xs", ...upvoters],
  });
  t.false(await showInHot(story([]), resolve));
  t.false(await showInHot(story(["0xa"]), resolve));
  t.false(await showInHot(story(["0xa", "0xd"]), resolve));
  t.true(await showInHot(story(["0xa", "0xc"]), resolve));
  t.true(await showInHot(story(["0xD", "0xB", "0xa"]), resolve));
});

test("the submitter's own upvote and duplicates don't count", async (t) => {
  const story = {
    identity: "0xA",
    submitter: nameless,
    upvoters: ["0xa", "0xA", "0xb"],
  };
  t.false(await showInHot(story, resolve));
});

test("an upvoter that fails to resolve doesn't count", async (t) => {
  const failing = async (address) => {
    if (address === "0xa") throw new Error("down");
    return profiles[address] || nameless;
  };
  const story = { identity: "0xs", submitter: nameless, upvoters: ["0xa", "0xb"] };
  t.false(await showInHot(story, failing));
});
