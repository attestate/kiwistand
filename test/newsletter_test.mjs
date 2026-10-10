// @format
import test from "ava";

import { sourceTag, parseButtondownError } from "../src/newsletter.mjs";
import {
  NewsletterCardElement,
  StoryNewsletterCard,
  storyHeadline,
} from "../src/views/components/newsletter-card.mjs";

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
  t.true(card.includes("Get the best of Kiwi News weekly"));
});

test("StoryNewsletterCard renders a story-sourced card row", (t) => {
  const row = StoryNewsletterCard();
  t.true(row.startsWith('<tr class="newsletter-story-row">'));
  t.true(row.includes('data-source="story"'));
  t.true(row.includes('name="source" value="story"'));
  t.true(row.includes("data-headline="));
  t.true(row.includes("Liked this?"));
  t.true(storyHeadline.includes("every Sunday"));
});
