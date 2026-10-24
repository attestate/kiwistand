// @format
import test from "ava";

import { sourceTag, parseButtondownError } from "../src/newsletter.mjs";
import {
  NewsletterCardElement,
  StoryNewsletterCard,
  headline,
  sampleCopy,
} from "../src/views/components/newsletter-card.mjs";
import { pitchStories, previousWeek } from "../src/weekly.mjs";

// vhtml escapes apostrophes in text and attributes.
const esc = (text) => text.replace(/'/g, "&apos;");

test("sourceTag only forwards known sources", (t) => {
  for (const source of [
    "modal",
    "feed",
    "sidebar",
    "story",
    "landing",
    "bell",
    "upvote",
  ]) {
    t.is(sourceTag(source), source);
  }
  t.is(sourceTag(" Story "), "story");
  t.is(sourceTag("feed_card"), "feed");
  t.is(sourceTag("scroll_modal"), "modal");
  t.is(sourceTag("story_sidebar"), "story");
  t.is(sourceTag("vip"), null);
  t.is(sourceTag(""), null);
  t.is(sourceTag(undefined), null);
  t.is(sourceTag(["story"]), null);
});

test("parseButtondownError recognizes an already-subscribed email", (t) => {
  const current = parseButtondownError(
    400,
    JSON.stringify({
      code: "email_already_exists",
      detail: "A subscriber with that email already exists.",
    }),
  );
  t.true(current.alreadySubscribed);
  t.is(current.code, "email_already_exists");

  const legacy = parseButtondownError(
    400,
    JSON.stringify(["you@example.com is already subscribed."]),
  );
  t.true(legacy.alreadySubscribed);

  t.true(parseButtondownError(409, "").alreadySubscribed);
});

test("parseButtondownError treats other 4xx as real failures", (t) => {
  const invalid = parseButtondownError(
    400,
    JSON.stringify({
      code: "email_invalid",
      detail: "That email address is not valid.",
    }),
  );
  t.false(invalid.alreadySubscribed);
  t.is(invalid.code, "email_invalid");
  t.is(invalid.detail, "That email address is not valid.");

  const fields = parseButtondownError(
    400,
    JSON.stringify({ email_address: ["Enter a valid email address."] }),
  );
  t.false(fields.alreadySubscribed);
  t.is(fields.detail, "Enter a valid email address.");

  t.false(parseButtondownError(400, "Bad Request").alreadySubscribed);
  t.false(parseButtondownError(403, "").alreadySubscribed);
});

test("NewsletterCardElement posts its source and keeps default copy", (t) => {
  const card = NewsletterCardElement("sidebar");
  t.true(card.includes('<newsletter-card data-source="sidebar">'));
  t.true(card.includes('name="source" value="sidebar"'));
  t.true(card.includes(esc(headline)));
  t.false(card.includes("newsletter-card-sample"));
});

test("StoryNewsletterCard falls back to the generic copy without a sample", (t) => {
  for (const sample of [undefined, null, []]) {
    const row = StoryNewsletterCard(sample);
    t.true(row.startsWith('<tr class="newsletter-story-row">'));
    t.true(row.includes('data-source="story"'));
    t.true(row.includes('name="source" value="story"'));
    t.true(row.includes(esc(headline)));
    t.true(row.includes(esc("What's in it?")));
    t.false(row.includes("data-sample="));
    t.false(row.includes("newsletter-card-sample"));
  }
});

const STORIES = [
  { index: "aa", title: "First <story> & more" },
  { index: "bb", title: "Second story" },
  { index: "cc", title: "Third story" },
  { index: "dd", title: "Fourth story" },
];

test("pitchStories links the top 3 stories and needs all 3", (t) => {
  const pitch = pitchStories(STORIES);
  t.is(pitch.length, 3);
  t.deepEqual(pitch[1], {
    title: "Second story",
    href: "/stories/Second-story?index=0xbb",
  });
  t.is(pitchStories(STORIES.slice(0, 2)), null);
  t.is(pitchStories(null), null);
});

test("previousWeek is the ISO week before now", (t) => {
  // Sunday 25 October 2026 is in 2026-W43; Monday 26 October in W44.
  t.deepEqual(previousWeek(Date.UTC(2026, 9, 25, 12)), {
    year: 2026,
    week: 42,
  });
  t.deepEqual(previousWeek(Date.UTC(2026, 9, 26, 0, 1)), {
    year: 2026,
    week: 43,
  });
  // Across the year boundary (2026 has 53 weeks).
  t.deepEqual(previousWeek(Date.UTC(2027, 0, 5)), { year: 2026, week: 53 });
});

test("StoryNewsletterCard shows last week's top stories, escaped", (t) => {
  const sample = pitchStories(STORIES);
  const row = StoryNewsletterCard(sample);
  // Same headline and source tag as without a sample.
  t.true(row.includes(esc(headline)));
  t.true(row.includes('name="source" value="story"'));
  t.true(row.includes(esc(sampleCopy)));
  t.true(row.includes('<ol class="newsletter-card-sample">'));
  t.is(row.match(/<li>/g).length, 3);
  t.true(row.includes('href="/stories/Second-story?index=0xbb"'));
  t.true(row.includes("First &lt;story&gt; &amp; more"));
  t.false(row.includes("<story>"));
  t.false(row.includes("Fourth story"));
  // The client card gets the same list through data-sample.
  const attr = row.match(/data-sample="([^"]*)"/)[1];
  const decoded = attr
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
  t.deepEqual(JSON.parse(decoded), sample);
});
