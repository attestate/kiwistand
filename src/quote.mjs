const statusLink =
  /\n?https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/\S+\/status\/\d+\S*\s*$/i;

const handle = "@[A-Za-z0-9_]{1,15}";
const replyHeader = new RegExp(
  `^\\s*\u21A9\uFE0E?[ \\t]*((?:${handle}[ \\t]*)+)\\n`,
);
const leadingMentions = new RegExp(`^(?:${handle}(?:\\s+|$))+`);

// fxtwitter starts a reply with "↩ @handle" on its own line, and the text
// itself starts with the mentions X hides. Returns who it replies to and the
// text without both, so clients can show "Replying to @handle" like X does.
export function splitReply(description) {
  const match = replyHeader.exec(description);
  if (!match) return { replyTo: null, text: description };
  const replyTo = match[1].trim().split(/\s+/);
  const text = description.slice(match[0].length).replace(leadingMentions, "");
  return { replyTo, text };
}

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
