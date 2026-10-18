//@format

// Helpers for the /api/v1/favicon proxy endpoint.
//
// This endpoint fetches a remote favicon on the caller's behalf, so it is a
// classic server-side request forgery (SSRF) surface and, if it reflected the
// upstream response, a same-origin content-injection surface. The functions
// here keep both in check:
//
//   - buildSafeFaviconUrl validates the attacker-supplied `domain` query param
//     and constructs the target URL itself, so path/query/fragment injection,
//     credentials, explicit ports and raw IP literals can never slip through.
//     (The socket-level guard against private/loopback/link-local/metadata
//     targets is request-filtering-agent's `useAgent`, applied at fetch time.)
//
//   - sniffFaviconContentType derives the served Content-Type from the actual
//     response bytes instead of trusting the upstream header, so the endpoint
//     can only ever return a recognized raster image, never attacker HTML/JS.

import net from "net";

// Allowed favicon image types, keyed by a magic-byte sniff of the response
// body. SVG is intentionally excluded: it is an active document format and
// serving attacker-controlled SVG same-origin would reintroduce XSS.
export function sniffFaviconContentType(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 4) return null;
  const startsWith = (sig, offset = 0) =>
    sig.every((b, i) => bytes[offset + i] === b);

  // ICO / CUR: 00 00 01 00  (or 00 00 02 00 for cursors)
  if (startsWith([0x00, 0x00, 0x01, 0x00])) return "image/x-icon";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "image/png";
  // GIF: "GIF8"
  if (startsWith([0x47, 0x49, 0x46, 0x38])) return "image/gif";
  // JPEG: FF D8 FF
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  // BMP: "BM"
  if (startsWith([0x42, 0x4d])) return "image/bmp";
  // WebP: "RIFF" .... "WEBP"
  if (
    bytes.length >= 12 &&
    startsWith([0x52, 0x49, 0x46, 0x46]) &&
    startsWith([0x57, 0x45, 0x42, 0x50], 8)
  )
    return "image/webp";
  return null;
}

// Validate an attacker-supplied `domain` and turn it into a safe https favicon
// URL, or return null if it is not acceptable.
export function buildSafeFaviconUrl(domain) {
  if (typeof domain !== "string" || domain.length === 0 || domain.length > 255)
    return null;
  // No whitespace, no scheme, no path separators, no explicit port, and no
  // other injection characters. (IP literals are rejected below, so a colon
  // here can only be a port.)
  if (/[\s/\\?#@:]/.test(domain)) return null;

  let url;
  try {
    url = new URL(`https://${domain}/favicon.ico`);
  } catch (err) {
    return null;
  }

  if (url.protocol !== "https:") return null;
  if (url.username !== "" || url.password !== "") return null;
  if (url.search !== "" || url.hash !== "") return null;
  if (url.pathname !== "/favicon.ico") return null;
  // Only the default https port.
  if (url.port !== "") return null;
  // Reject raw IP literals; this endpoint is for website domains, and IP
  // targets widen the SSRF surface unnecessarily.
  const host =
    url.hostname.startsWith("[") && url.hostname.endsWith("]")
      ? url.hostname.slice(1, -1)
      : url.hostname;
  if (net.isIP(host) !== 0) return null;
  // Require a well-formed dotted DNS name: 1-63 char labels that do not start
  // or end with a hyphen, no empty labels (rejects "a..com", ".evil.com"), and
  // a plausible alphabetic TLD. (Total length is already bounded above.)
  const HOSTNAME_RE =
    /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
  if (!HOSTNAME_RE.test(url.hostname)) return null;

  return url.toString();
}
