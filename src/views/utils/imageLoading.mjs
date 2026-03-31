// Only eagerly load images from domains we control
// Third-party images should always lazy load to not block our render
const CONTROLLED_DOMAINS = [
  "imagedelivery.net",
  "news.kiwistand.com",
  "localhost",
];

export function isControlledImage(src) {
  if (!src) return false;
  try {
    // Handle relative URLs (they're from our own domain)
    if (src.startsWith("/")) return true;
    const url = new URL(src);
    return CONTROLLED_DOMAINS.some(
      (domain) =>
        url.hostname === domain || url.hostname.endsWith("." + domain),
    );
  } catch {
    return false;
  }
}

// Transform Twitter/X image URLs to use a reasonable size instead of the
// original upload. pbs.twimg.com URLs often include ?name=orig which serves
// the full-resolution original (can be 4000px+, several MB). We downgrade to
// ?name=large (max 2048px) which is still more than enough for feed thumbnails
// displayed at ~600px CSS width, and saves 60-90% on image transfer size.
export function transformImageUrl(src) {
  if (!src) return src;
  try {
    const url = new URL(src);
    if (url.hostname === "pbs.twimg.com") {
      const name = url.searchParams.get("name");
      if (name === "orig") {
        url.searchParams.set("name", "large");
        return url.toString();
      }
    }
  } catch {
    // Ignore invalid URLs
  }
  return src;
}

// Helper to determine image loading strategy.
// We only eagerly load images from domains we fully control (our own CDN).
// Third-party images (pbs.twimg.com, api.ensdata.net, etc.) are ALWAYS lazy,
// even above the fold. This is intentional: a slow external host would
// otherwise block our entire page render, which is worse than a slightly
// delayed LCP. Do not change this without considering that trade-off.
export function getImageLoading(isAboveFold, src) {
  if (!isAboveFold) return "lazy";
  return isControlledImage(src) ? "eager" : "lazy";
}
