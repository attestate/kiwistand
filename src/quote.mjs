const statusLink =
  /\n?https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/\S+\/status\/\d+\S*\s*$/i;

// fxtwitter writes a quote tweet as "text\n\n<quoted tweet URL>\n\n
// Quoting Name (@handle) \n\nquoted text". Returns the tweet's own text
// without the bare URL, plus the quoted tweet.
export function splitQuote(description) {
  const marker = "\n\nQuoting ";
  const at = description.indexOf(marker);
  if (at === -1) return { text: description.trim(), quote: null };
  const text = description.slice(0, at).replace(statusLink, "").trim();
  const rest = description.slice(at + marker.length);
  const split = rest.indexOf("\n\n");
  if (split === -1) return { text, quote: null };
  const author = rest.slice(0, split).trim();
  let quoted = rest.slice(split + 2).replace(statusLink, "").trim();
  if (quoted.length > 280) quoted = quoted.slice(0, 280) + "…";
  if (!author || !quoted) return { text, quote: null };
  return { text, quote: { author, text: quoted } };
}

// fxtwitter answers a deleted (or no longer visible) post with this text,
// which we cached as the tweet's description.
export function isDeletedTweet(metadata) {
  const description = metadata?.ogDescription || "";
  return /^Sorry, that post (doesn't|does not) exist/i.test(description.trim());
}

// "@DeanEigenmann: Justin Drake calls…" -> "@DeanEigenmann"
export function tweetHandle(title) {
  const match = /^@([A-Za-z0-9_]{1,15}):/.exec(title || "");
  return match ? `@${match[1]}` : null;
}
