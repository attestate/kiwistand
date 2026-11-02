// @format
import DOMPurify from "isomorphic-dompurify";

// Link preview texts are stored as plain text, and the views escape them
// once. DOMPurify alone returns HTML, so "> quote" would be stored as
// "&gt; quote" and shown that way. plainText() strips tags (fxtwitter puts
// <br> into its og:description) and decodes what DOMPurify encodes.
// NOTE: The result is text, not HTML: never put it into raw HTML unescaped.
export function plainText(value) {
  if (typeof value !== "string" || !value.includes("<")) return value;
  return DOMPurify.sanitize(value.replace(/<br\s*\/?>/gi, "\n"), {
    ALLOWED_TAGS: [],
    KEEP_CONTENT: true,
  })
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
