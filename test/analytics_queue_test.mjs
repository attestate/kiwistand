// @format
import test from "ava";

import { createAnalytics, feedName } from "../src/web/src/analytics.mjs";

function fakeClient() {
  const events = [];
  const options = [];
  return {
    __loaded: true,
    events,
    options,
    capture: (e, p, o) => {
      events.push([e, p]);
      options.push(o);
    },
  };
}

test("capture buffers until the client is loaded, then flushes in order", (t) => {
  let client = null;
  const a = createAnalytics(() => client);
  t.true(a.capture("story_impression", { position: 1 }));
  t.true(a.capture("feed_page_view", { feed: "hot" }));
  t.is(a.size(), 2);

  client = fakeClient();
  a.flush();
  t.is(a.size(), 0);
  t.deepEqual(client.events, [
    ["story_impression", { position: 1 }],
    ["feed_page_view", { feed: "hot" }],
  ]);

  t.true(client.options[0].timestamp instanceof Date);

  t.true(a.capture("outbound_click", { position: 2 }));
  t.is(client.events.length, 3);
});

test("capture keeps buffering while window.posthog exists but is not initialized", (t) => {
  const client = { __loaded: false, capture: () => t.fail() };
  const a = createAnalytics(() => client);
  t.true(a.capture("upvote", {}));
  t.is(a.size(), 1);
  a.flush();
  t.is(a.size(), 1);
});

test("the buffer is capped", (t) => {
  const a = createAnalytics(() => null, 3);
  t.true(a.capture("a"));
  t.true(a.capture("b"));
  t.true(a.capture("c"));
  t.false(a.capture("d"));
  t.is(a.size(), 3);
});

test("disable drops buffered events and stops queueing", (t) => {
  let client = null;
  const a = createAnalytics(() => client);
  a.capture("a");
  a.disable();
  t.is(a.size(), 0);
  t.false(a.capture("b"));
  client = fakeClient();
  a.flush();
  t.deepEqual(client.events, []);
});

test("feedName maps paths to feed names", (t) => {
  t.is(feedName("/"), "hot");
  t.is(feedName("/new"), "new");
  t.is(feedName("/best"), "best");
  t.is(feedName("/stories/some-slug"), "story");
  t.is(feedName("/upvotes"), "profile");
  t.is(feedName("/search"), "search");
  t.is(feedName("/curation"), "curation");
});
