// Checks whether a story's link still works before we email it out.
// Only definite "gone" answers count as dead: sites that block bots or
// time out are treated as alive so we don't drop good stories.

const twitterHosts = new Set([
  "x.com",
  "www.x.com",
  "twitter.com",
  "www.twitter.com",
  "mobile.twitter.com",
  "mobile.x.com",
  "fxtwitter.com",
  "vxtwitter.com",
  "fixupx.com",
]);

const timeout = 10000;

export async function isLinkAlive(href, fetchImpl = fetch) {
  let url;
  try {
    url = new URL(href);
  } catch (err) {
    return true;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return true;

  const headers = {
    "User-Agent":
      process.env.USER_AGENT || "KiwiNewsBot/1.0 (https://news.kiwistand.com)",
  };

  try {
    if (twitterHosts.has(url.hostname.toLowerCase())) {
      const match = url.pathname.match(/\/status(?:es)?\/(\d+)/);
      if (!match) return true;
      // x.com answers 200 for deleted posts, so ask fxtwitter's API instead.
      // 404: deleted, 401: account went private.
      const response = await fetchImpl(
        `https://api.fxtwitter.com/status/${match[1]}`,
        { headers, signal: AbortSignal.timeout(timeout) },
      );
      await response.body?.cancel?.();
      return response.status !== 404 && response.status !== 401;
    }

    const response = await fetchImpl(url.toString(), {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(timeout),
    });
    await response.body?.cancel?.();
    return response.status !== 404 && response.status !== 410;
  } catch (err) {
    // The domain no longer exists.
    if (err?.cause?.code === "ENOTFOUND") return false;
    return true;
  }
}
