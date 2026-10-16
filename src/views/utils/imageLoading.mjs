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

// Cloudflare Images (imagedelivery.net) URLs end in a named variant, e.g.
// /<account>/<id>/public or Farcaster's /<account>/<id>/original. Those serve
// the stored file at full size: on the front page a 20px avatar was 1.16 MB
// and a 240px top story card 147 KB. Both accounts (ours and Farcaster's)
// accept flexible variants, so ask for the width the page shows instead:
// e.g. /public 147 KB -> /w=480,fit=scale-down,f=auto 9 KB (AVIF/WebP by
// Accept). Other URLs go through transformImageUrl unchanged.
const NAMED_VARIANTS = new Set(["public", "original"]);
export function sizedImageUrl(src, width) {
  if (!src) return src;
  try {
    const url = new URL(src);
    if (url.hostname === "imagedelivery.net") {
      const parts = url.pathname.split("/");
      // ["", account, id, variant]
      if (parts.length === 4 && NAMED_VARIANTS.has(parts[3])) {
        parts[3] = `w=${width},fit=scale-down,f=auto`;
        url.pathname = parts.join("/");
        return url.toString();
      }
      return src;
    }
  } catch {
    return src;
  }
  return transformImageUrl(src);
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
