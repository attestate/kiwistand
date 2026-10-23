import test from "ava";
import sharp from "sharp";

import {
  fileName,
  titleStyle,
  commentStyle,
  displayName,
  cleanDomain,
  cleanTitle,
  cleanComment,
  topReactions,
  gradient,
  twemojiName,
  story,
  comment,
  render,
} from "../src/preview.mjs";

const address = "0x7a3fbe1c2d3e4f5a6b7c8d9e0f1a2b3c4d5ec21e";

test("preview files carry the version, so caches fetch the new cards", (t) => {
  t.is(fileName("abc"), "abc-v2.jpg");
  t.is(fileName("abc-comment-def", true), "abc-comment-def-v2-frame.jpg");
});

test("title size and line limit follow the title's length", (t) => {
  t.deepEqual(titleStyle("x".repeat(40), false), [84, 3]);
  t.deepEqual(titleStyle("x".repeat(40), true), [96, 4]);
  t.deepEqual(titleStyle("x".repeat(80), false), [68, 3]);
  t.deepEqual(titleStyle("x".repeat(80), true), [80, 4]);
  t.deepEqual(titleStyle("x".repeat(81), false), [56, 4]);
  t.deepEqual(titleStyle("x".repeat(81), true), [66, 5]);
});

test("comment size and line limit follow the comment's length", (t) => {
  t.deepEqual(commentStyle("x".repeat(40), false), [60, 2]);
  t.deepEqual(commentStyle("x".repeat(40), true), [72, 3]);
  t.deepEqual(commentStyle("x".repeat(90), false), [44, 3]);
  t.deepEqual(commentStyle("x".repeat(90), true), [52, 4]);
  t.deepEqual(commentStyle("x".repeat(180), false), [38, 4]);
  t.deepEqual(commentStyle("x".repeat(180), true), [44, 6]);
  t.deepEqual(commentStyle("x".repeat(181), false), [34, 4]);
  t.deepEqual(commentStyle("x".repeat(181), true), [38, 7]);
});

test("someone without a name shows as a shortened address", (t) => {
  t.is(displayName(null, address), "0x7a3f…c21e");
  t.is(displayName(address, address), "0x7a3f…c21e");
  t.is(displayName("0x7a3f...", address), "0x7a3f…c21e");
  t.is(displayName("rvolz.eth", address), "rvolz.eth");
});

test("names of 24 characters or more end in an ellipsis", (t) => {
  t.is(displayName("a".repeat(23), address), "a".repeat(23));
  t.is(displayName("a-really-long-ens-name-for-testing.eth", address), "a-really-long-ens-name…");
});

test("domains lose www., are lowercase and long ones are cut", (t) => {
  t.is(cleanDomain("WWW.GitHub.com"), "github.com");
  t.is(cleanDomain("attestate-research.blog.example.com"), "attestate-research.blog.ex…");
});

test("links in titles become their domain", (t) => {
  t.is(
    cleanTitle("Show Kiwi: https://github.com/attestate/kiwistand is now one command"),
    "Show Kiwi: github.com/… is now one command",
  );
  t.is(cleanTitle("See https://www.example.com"), "See example.com");
});

test("comments become one line of plain text", (t) => {
  t.is(
    cleanComment(
      "Running a **node** on a\n\nRaspberry Pi.   See [my notes](https://example.com) – _happy_ to help.\n> quoted\n# Heading `code`",
    ),
    "Running a node on a Raspberry Pi. See my notes – happy to help. quoted Heading code",
  );
  t.is(cleanComment("snake_case_name stays"), "snake_case_name stays");
});

test("at most four reactions, most used first", (t) => {
  const reactions = [
    { emoji: "👀", count: 1 },
    { emoji: "🔥", count: 12 },
    { emoji: "🥝", count: 7 },
    { emoji: "💯", count: 3 },
    { emoji: "🚀", count: 2 },
    { emoji: "🙏", count: 0 },
  ];
  t.deepEqual(
    topReactions(reactions).map((reaction) => reaction.emoji),
    ["🔥", "🥝", "💯", "🚀"],
  );
  t.deepEqual(topReactions(undefined), []);
});

test("the same address always gets the same gradient", (t) => {
  t.is(gradient(address), gradient(address.toUpperCase().replace("0X", "0x")));
  t.not(gradient(address), gradient("0x3be1aa22bb33cc44dd55ee66ff77889900aaf00d"));
  t.regex(gradient(address), /^linear-gradient\(135deg, #[0-9a-f]{6}, #[0-9a-f]{6}\)$/);
});

test("emoji map to Twemoji file names", (t) => {
  t.is(twemojiName("🥝"), "1f95d");
  t.is(twemojiName("❤️"), "2764");
  t.is(twemojiName("👩‍💻"), "1f469-200d-1f4bb");
});

async function size(jpeg) {
  const { width, height, format } = await sharp(jpeg).metadata();
  return { width, height, format };
}

test("a story card renders in both sizes", async (t) => {
  const body = story("The Death of the Interface", null, null, "x.com", { address });
  t.deepEqual(await size(await render(body)), { width: 1200, height: 630, format: "jpeg" });
  t.deepEqual(await size(await render(body, true)), { width: 1200, height: 800, format: "jpeg" });
});

test("a text post and a very long title render", async (t) => {
  const body = story("x".repeat(400), "", null, "", { address, isTextPost: true });
  t.deepEqual(await size(await render(body)), { width: 1200, height: 630, format: "jpeg" });
});

test("a comment card renders with and without the story's submitter", async (t) => {
  const data = { text: "gm. Finally someone said it.", name: "dana.eth", address, timestamp: 1792627200, reactions: [] };
  for (const storyData of [
    { title: "The Death of the Interface", domain: "x.com" },
    { title: "The Death of the Interface", domain: "x.com", name: "rvolz.eth", address },
  ]) {
    const body = comment(data, storyData);
    t.deepEqual(await size(await render(body)), { width: 1200, height: 630, format: "jpeg" });
    t.deepEqual(await size(await render(body, true)), { width: 1200, height: 800, format: "jpeg" });
  }
});
