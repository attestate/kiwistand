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

// Helper to determine image loading strategy
// Only eagerly load if: above fold AND from a controlled domain
export function getImageLoading(isAboveFold, src) {
  if (!isAboveFold) return "lazy";
  return isControlledImage(src) ? "eager" : "lazy";
}
