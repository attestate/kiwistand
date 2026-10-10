// Tiny analytics queue. posthog-js loads in an idle callback (see main.jsx),
// so events fired during page load (above-the-fold impressions,
// feed_page_view) used to be dropped. capture() buffers them until PostHog
// is initialized and flush() replays them right after posthog.init.

export const MAX_QUEUE = 200;

export function createAnalytics(getClient, max = MAX_QUEUE) {
  let queue = [];
  let disabled = false;

  const ready = () => {
    const client = getClient();
    return client && client.__loaded ? client : null;
  };

  // Returns true when the event was sent or buffered.
  function capture(event, props) {
    if (disabled) return false;
    const client = ready();
    if (client) {
      try {
        client.capture(event, props);
      } catch (_) {}
      return true;
    }
    if (queue.length >= max) return false;
    // Keep the time the event happened, not the time it was flushed.
    queue.push([event, props, { timestamp: new Date() }]);
    return true;
  }

  function flush() {
    const client = ready();
    if (disabled || !client) return;
    const pending = queue;
    queue = [];
    for (const [event, props, options] of pending) {
      try {
        client.capture(event, props, options);
      } catch (_) {}
    }
  }

  // PostHog will never load (anon mode, no consent, failed import): drop the
  // buffer and stop queueing.
  function disable() {
    disabled = true;
    queue = [];
  }

  return { capture, flush, disable, size: () => queue.length };
}

const analytics = createAnalytics(() =>
  typeof window !== "undefined" ? window.posthog : null,
);

export const capture = analytics.capture;
export const flushAnalytics = analytics.flush;
export const disableAnalytics = analytics.disable;

// Feed name for ranking analysis, derived from the page path.
export function feedName(pathname) {
  if (pathname === "/") return "hot";
  if (pathname === "/new") return "new";
  if (pathname === "/best") return "best";
  if (pathname.startsWith("/stories")) return "story";
  if (pathname.startsWith("/upvotes")) return "profile";
  if (pathname === "/search") return "search";
  return pathname.replace(/^\/+/, "").split("/")[0] || "other";
}

export function getVariant() {
  try {
    const el = document.querySelector('meta[name="kiwi-variant"]');
    return el?.content || "unknown";
  } catch (_) {
    return "unknown";
  }
}

// Ranking properties of the story row an element belongs to. Rows carry
// data-position (1-based rank on the page) and data-content-id
// ("kiwi:0x<index>").
export function storyProps(el) {
  const props = { feed: feedName(window.location.pathname) };
  const row = el?.closest?.("[data-content-id]");
  if (!row) return props;
  const position = parseInt(row.getAttribute("data-position"), 10);
  if (Number.isInteger(position)) props.position = position;
  const id = row.getAttribute("data-content-id") || "";
  if (/^kiwi:0x[0-9a-f]+$/i.test(id)) props.story_index = id.slice(5);
  return props;
}
