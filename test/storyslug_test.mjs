// @format
import test from "ava";

import { buildSlugIndex, storyRedirect } from "../src/storyslug.mjs";

const A = "0x" + "a".repeat(72);
const B = "0x" + "b".repeat(72);

test("titles map to their slugs, the newest story wins a shared slug", (t) => {
  const index = buildSlugIndex([
    { id: `kiwi:${A}`, title: "Hello World: a test" },
    { id: `kiwi:${B}`, title: "Hello World: a test" },
    { id: "kiwi:", title: "No index" },
    { id: `kiwi:${B}`, title: "" },
  ]);
  t.is(index.get("Hello-World-a-test"), A);
  t.is(index.size, 1);
});

test("a story URL without index redirects to the story", (t) => {
  const find = (slug) => (slug === "Hello-World-a-test" ? A : null);
  t.is(
    storyRedirect("Hello-World-a-test", {}, find),
    `/stories/Hello-World-a-test?index=${A}`,
  );
  // Other parameters are kept, a broken index is replaced.
  t.is(
    storyRedirect(
      "Hello-World-a-test",
      { index: "0x12", commentIndex: "0x34", t: "1" },
      find,
    ),
    `/stories/Hello-World-a-test?commentIndex=0x34&index=${A}`,
  );
  t.is(storyRedirect("Unknown-story", {}, find), null);
  t.is(storyRedirect(undefined, {}, find), null);
  // The index it already has (a story that's gone) doesn't loop.
  t.is(storyRedirect("Hello-World-a-test", { index: A }, find), null);
});
