// @format
import DOMPurify from "isomorphic-dompurify";

// Link previews (parser.mjs metadata) store their texts as plain text: what
// the reader should see, without tags and without HTML entities. Every sink
// escapes them once: vhtml and React for text and attributes, escapeXml for
// RSS, and the apps show them as they are.
//
// NOTE: plainText()'s result is text, not HTML. "&lt;script&gt;" becomes
// "<script>", so never put it into raw HTML (innerHTML,
// dangerouslySetInnerHTML, string templates) without escaping it.

const NAMED = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
};
const ENTITY =
  /&(?:(amp|lt|gt|quot|apos|nbsp)|#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6}));/g;

// Decodes the basic named entities and numeric ones, in a single pass:
// "&amp;gt;" becomes "&gt;", not ">".
export function decodeEntities(text) {
  return text.replace(ENTITY, (match, name, dec, hex) => {
    if (name) return NAMED[name];
    const code = dec ? parseInt(dec, 10) : parseInt(hex, 16);
    if (code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
      return match;
    }
    return String.fromCodePoint(code);
  });
}

// Turns a text that may contain markup (fxtwitter writes <br> into its
// og:description) or entities into plain text: <br> becomes a line break,
// other tags are stripped by DOMPurify (scripts and styles with their
// content), and entities are decoded one level. Plain text without "<" or
// "&" comes back unchanged.
export function plainText(value) {
  if (typeof value !== "string" || !/[<&]/.test(value)) return value;
  let text = value.replace(/<br\s*\/?>/gi, "\n");
  // NOTE: DOMPurify only parses a string that contains "<"; the serialized
  // text then has &, <, > and U+00A0 as &amp; &lt; &gt; &nbsp;.
  if (text.includes("<")) {
    text = DOMPurify.sanitize(text, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    });
  }
  return decodeEntities(text);
}
