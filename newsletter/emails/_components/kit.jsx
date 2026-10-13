import React from "react";

// Building blocks of the newsletter's story layout (the "Newsletter #47"
// and "Newsletter · Story variants" frames in the Kiwi design file).
// Place 1 is a large hero, places 2–5 are compact rows. Every block is a
// table with inline styles so Outlook and Gmail lay it out the same; the
// classes (k-*) only carry the dark theme and the mobile sizes, see
// emailCSS below.
// NOTE: In _components so react-email doesn't export it as a template.

// Design tokens. Alpha colors from the design are flattened onto the card
// color, since not every mail client blends rgba.
export const light = {
  page: "#F8F9F4",
  card: "#FFFFFF",
  border: "#ECEEE7",
  hairline: "#E3E3E4",
  text: "#10131D",
  secondary: "#78818A",
  muted: "#858D94",
  tertiary: "#606971",
  strip: "#F4F5EF",
  welcome: "#F6FBD7",
  initial: "#EBEBEB",
  accent: "#D4EC37",
  accentText: "#000000",
};

export const dark = {
  page: "#191D17",
  card: "#252B22",
  border: "#3A4433",
  hairline: "#333732",
  text: "#F4F6EF",
  secondary: "#B3BCAE",
  muted: "#ABB5A5",
  tertiary: "#C1C9BA",
  strip: "#30372A",
  welcome: "#3F4825",
  initial: "#3F443C",
};

export const font =
  "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";

const ASSETS = "https://news.kiwistand.com";

// Clients that honor prefers-color-scheme (Apple Mail, iOS Mail, Outlook
// for Mac/iOS) get the design's dark theme; [data-ogsc]/[data-ogsb] are
// Outlook.com's dark-mode hooks. Clients that invert colors on their own
// (Gmail apps, Outlook Windows) ignore this; the layout uses live text and
// opaque images so inversion stays readable there too.
// Below 480px the email switches to the "Mobile" frames: no page margin,
// smaller type, 72px thumbnails and the iOS app box stacked.
// Inter for clients that load web fonts (Apple Mail, iOS Mail); the rest
// fall back to the system font. In its own <style> block: Gmail drops a
// whole block when it finds something it doesn't support.
export const fontCSS = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400%3B500%3B600%3B700%3B800&display=swap');`;

export const emailCSS = `
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; -webkit-text-size-adjust: 100%; }
  .k-dark-img { display: none; }
  @media (prefers-color-scheme: dark) {
    .k-body, body { background-color: ${dark.page} !important; color: ${dark.text} !important; }
    .k-page { background-color: ${dark.page} !important; }
    .k-card { background-color: ${dark.card} !important; border-color: ${dark.border} !important; }
    .k-embed { background-color: ${dark.card} !important; border-color: ${dark.border} !important; }
    .k-strip { background-color: ${dark.strip} !important; }
    .k-welcome { background-color: ${dark.welcome} !important; }
    .k-initial { background-color: ${dark.initial} !important; color: ${dark.secondary} !important; }
    .k-hr { background-color: ${dark.hairline} !important; border-color: ${dark.hairline} !important; }
    .k-text { color: ${dark.text} !important; }
    .k-link { color: ${dark.text} !important; }
    .k-muted { color: ${dark.secondary} !important; }
    .k-faint { color: ${dark.muted} !important; }
    .k-tertiary { color: ${dark.tertiary} !important; }
    .k-light-img { display: none !important; }
    .k-dark-img { display: inline-block !important; max-height: none !important; width: auto !important; overflow: visible !important; }
  }
  [data-ogsc] .k-light-img { display: none !important; }
  [data-ogsc] .k-dark-img { display: inline-block !important; max-height: none !important; width: auto !important; overflow: visible !important; }
  [data-ogsc] .k-text, [data-ogsc] .k-link { color: ${dark.text} !important; }
  [data-ogsc] .k-muted { color: ${dark.secondary} !important; }
  [data-ogsc] .k-faint { color: ${dark.muted} !important; }
  [data-ogsc] .k-tertiary { color: ${dark.tertiary} !important; }
  [data-ogsc] .k-initial { color: ${dark.secondary} !important; }
  [data-ogsb] .k-page { background-color: ${dark.page} !important; }
  [data-ogsb] .k-card, [data-ogsb] .k-embed { background-color: ${dark.card} !important; }
  [data-ogsb] .k-strip { background-color: ${dark.strip} !important; }
  [data-ogsb] .k-welcome { background-color: ${dark.welcome} !important; }
  [data-ogsb] .k-initial { background-color: ${dark.initial} !important; }
  [data-ogsb] .k-hr { background-color: ${dark.hairline} !important; }
  @media only screen and (max-width: 480px) {
    .k-page-pad { padding: 0 !important; }
    .k-card-pad { padding: 20px 20px 28px 20px !important; }
    .k-frame { border-radius: 0 !important; border-left: 0 !important; border-right: 0 !important; }
    .k-headline { font-size: 32px !important; line-height: 38px !important; letter-spacing: -1px !important; }
    .k-hero-title { font-size: 22px !important; line-height: 26px !important; }
    .k-row-title { font-size: 16px !important; line-height: 20px !important; }
    .k-thumb-cell { width: 72px !important; }
    .k-thumb { width: 72px !important; height: 72px !important; }
    .k-gap { width: 12px !important; }
    .k-stack { display: block !important; width: auto !important; }
    .k-stack-gap { display: none !important; }
    .k-app-text { padding: 20px 20px 0 20px !important; }
    .k-qr { padding: 20px !important; text-align: left !important; }
  }
`;

// Wrapped in two spans: Buttondown's template colors `a > *`, which would
// otherwise turn every link's text blue.
export function LinkText({ href, className = "k-link", style, children }) {
  return (
    <a href={href} className={className} style={{ textDecoration: "none", color: style?.color || light.text, ...style }}>
      <span>
        <span className={className} style={{ color: style?.color || light.text }}>
          {children}
        </span>
      </span>
    </a>
  );
}

// A table whose children sit on top of each other `gap` pixels apart.
export function Stack({ gap = 8, children, style }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border="0" style={{ borderCollapse: "collapse", ...style }}>
      <tbody>
        {items.map((child, i) => (
          <tr key={i}>
            <td style={{ padding: i === 0 ? 0 : `${gap}px 0 0 0` }}>{child}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Hairline() {
  return (
    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border="0" style={{ borderCollapse: "collapse" }}>
      <tbody>
        <tr>
          <td className="k-hr" height="1" bgcolor={light.hairline} style={{ height: "1px", lineHeight: "1px", fontSize: "1px", backgroundColor: light.hairline }}>
            &nbsp;
          </td>
        </tr>
      </tbody>
    </table>
  );
}

// An icon in the light theme's color, swapped for its dark twin by
// emailCSS. Outlook (mso-hide) and clients without <style> only ever show
// the light one.
export function ThemedIcon({ name, alt = "", size = 14, style }) {
  const base = { display: "inline-block", verticalAlign: "-2px", border: 0, ...style };
  return (
    <>
      <img className="k-light-img" src={`${ASSETS}/email-${name}-light.png`} alt={alt} width={size} height={size} style={base} />
      <span className="k-dark-img" style={{ display: "none", maxHeight: 0, width: 0, overflow: "hidden", msoHide: "all" }}>
        <img src={`${ASSETS}/email-${name}-dark.png`} alt={alt} width={size} height={size} style={base} />
      </span>
    </>
  );
}

// The lime rank chip and the story's source ("01  youtube.com").
export function SourceRow({ rank, source, hero, href }) {
  const chip = hero
    ? { fontSize: "14px", lineHeight: "17px", padding: "3px 8px" }
    : { fontSize: "12px", lineHeight: "15px", padding: "2px 6px" };
  return (
    <table role="presentation" cellPadding="0" cellSpacing="0" border="0" style={{ borderCollapse: "separate" }}>
      <tbody>
        <tr>
          <td bgcolor={light.accent} style={{ ...chip, backgroundColor: light.accent, color: light.accentText, borderRadius: "4px", fontFamily: font, fontWeight: 600, whiteSpace: "nowrap" }}>
            {String(rank).padStart(2, "0")}
          </td>
          {source ? (
            <td className="k-muted" style={{ padding: "0 0 0 8px", fontFamily: font, fontSize: hero ? "13px" : "12px", lineHeight: "16px", color: light.secondary }}>
              <LinkText href={href} className="k-muted" style={{ color: light.secondary }}>
                {source}
              </LinkText>
            </td>
          ) : null}
        </tr>
      </tbody>
    </table>
  );
}

// "by timdaub.eth · ♡ 3 ▢ 0"
export function Byline({ story }) {
  const profile =
    story.submitterLink || `https://news.kiwistand.com/upvotes?address=${story.identity}`;
  const number = { fontFamily: font, fontSize: "12px", color: light.text };
  return (
    <div className="k-muted" style={{ fontFamily: font, fontSize: "13px", lineHeight: "18px", color: light.secondary, margin: 0 }}>
      by{" "}
      <LinkText href={profile} style={{ fontSize: "12px", fontWeight: 500, color: light.text, paddingLeft: "2px" }}>
        {story.displayName}
      </LinkText>
      <span className="k-faint" style={{ color: light.muted, padding: "0 6px" }}>·</span>
      <ThemedIcon name="heart" alt="Upvotes" />
      <span className="k-text" style={{ ...number, padding: "0 6px 0 4px" }}>{story.upvotes || 0}</span>
      <ThemedIcon name="comment" alt="Comments" />
      <span className="k-text" style={{ ...number, padding: "0 0 0 4px" }}>{story.comments || 0}</span>
    </div>
  );
}

export function Title({ href, hero, children }) {
  const style = hero
    ? { fontSize: "26px", lineHeight: "31px", fontWeight: 700, letterSpacing: "-0.5px" }
    : { fontSize: "18px", lineHeight: "23px", fontWeight: 700 };
  return (
    <div className={hero ? "k-hero-title" : "k-row-title"} style={{ ...style, fontFamily: font, margin: 0 }}>
      <LinkText href={href} style={{ color: light.text }}>
        {children}
      </LinkText>
    </div>
  );
}

// A post (X, Farcaster, Bluesky) quoted in a bordered card: avatar or
// initial, handle, text, and in the hero its first image.
export function PostEmbed({ href, hero, avatar, handle, text, image, deleted }) {
  const size = hero ? 24 : 20;
  const initial = (handle || "").replace(/^@/, "").charAt(0).toUpperCase() || "?";
  return (
    <a href={href} className="k-link" style={{ display: "block", textDecoration: "none", color: light.text }}>
      <div>{/* keeps the card text out of reach of Buttondown's `a > *` link color rule */}
        <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border="0" style={{ borderCollapse: "separate" }}>
          <tbody>
            <tr>
              <td className="k-embed" bgcolor={light.card} style={{ backgroundColor: light.card, border: `1px solid ${light.border}`, borderRadius: "6px", padding: hero ? "16px" : "12px" }}>
                <table role="presentation" cellPadding="0" cellSpacing="0" border="0" style={{ borderCollapse: "collapse" }}>
                  <tbody>
                    <tr>
                      <td width={size} style={{ width: `${size}px`, verticalAlign: "middle" }}>
                        {avatar ? (
                          <img src={avatar} alt="" width={size} height={size} style={{ display: "block", width: `${size}px`, height: `${size}px`, borderRadius: "9999px", objectFit: "cover", border: 0 }} />
                        ) : (
                          <div className="k-initial" style={{ width: `${size}px`, height: `${size}px`, lineHeight: `${size}px`, borderRadius: "9999px", backgroundColor: light.initial, color: light.secondary, fontFamily: font, fontSize: hero ? "11px" : "10px", fontWeight: 600, textAlign: "center" }}>
                            {initial}
                          </div>
                        )}
                      </td>
                      <td className="k-text" style={{ padding: "0 0 0 8px", verticalAlign: "middle", fontFamily: font, fontSize: hero ? "15px" : "14px", lineHeight: "18px", fontWeight: 600, color: light.text }}>
                        {handle}
                      </td>
                    </tr>
                  </tbody>
                </table>
                {deleted ? (
                  <div className="k-faint" style={{ margin: "8px 0 0 0", fontFamily: font, fontSize: "14px", lineHeight: "20px", fontStyle: "italic", color: light.muted }}>
                    <ThemedIcon name="deleted" alt="" style={{ paddingRight: "6px" }} />
                    This post was deleted on X.
                  </div>
                ) : null}
                {text ? (
                  <div className="k-text" style={{ margin: "8px 0 0 0", fontFamily: font, fontSize: hero ? "16px" : "14px", lineHeight: hero ? "23px" : "20px", color: light.text, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                    {text}
                  </div>
                ) : null}
                {hero && image ? (
                  <div style={{ margin: "12px 0 0 0" }}>
                    <HeroImage src={image} radius="4px" />
                  </div>
                ) : null}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </a>
  );
}

// A hero picture keeps its own shape: the whole image, at most 400px high,
// centered on the comment-strip color when it is narrower than the email.
// Outlook for Windows ignores max-height and uses the width attribute.
export function HeroImage({ src, href, alt = "", radius = "6px" }) {
  const img = (
    <img
      src={src}
      alt={alt}
      width="100%"
      style={{ display: "block", margin: "0 auto", width: "auto", maxWidth: "100%", height: "auto", maxHeight: "400px", border: 0 }}
    />
  );
  return (
    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border="0" style={{ borderCollapse: "separate" }}>
      <tbody>
        <tr>
          <td className="k-strip" align="center" bgcolor={light.strip} style={{ backgroundColor: light.strip, borderRadius: radius, overflow: "hidden", textAlign: "center", lineHeight: 0, fontSize: 0 }}>
            {href ? <a href={href} style={{ display: "block" }}>{img}</a> : img}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function Thumbnail({ src, href }) {
  return (
    <a href={href} style={{ display: "block" }}>
      <img
        className="k-thumb"
        src={src}
        alt=""
        width="104"
        height="104"
        style={{ display: "block", width: "104px", height: "104px", objectFit: "cover", borderRadius: "4px", border: 0 }}
      />
    </a>
  );
}

// One story at its place: the hero (place 1) puts the image on top; rows
// (places 2–5) put a square thumbnail on the left, or use the full width
// without one. `body` is the title or the post card; `heroImage` and
// `thumbnail` are image URLs (or null).
export function StoryFrame({ story, rank, hero, source, body, heroImage, thumbnail, credit }) {
  const href = story.storyLink;
  const column = (
    <Stack gap={hero ? 12 : 8}>
      <SourceRow rank={rank} source={source} hero={hero} href={href} />
      {body}
      <Byline story={story} />
      {credit}
    </Stack>
  );

  if (hero) {
    return (
      <div className="k-story" style={{ padding: "4px 0 24px 0" }}>
        <Stack gap={12}>
          {heroImage ? <HeroImage src={heroImage} href={href} /> : null}
          {column}
        </Stack>
      </div>
    );
  }

  return (
    <div className="k-story" style={{ padding: "20px 0" }}>
      <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" border="0" style={{ borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            {thumbnail ? (
              <>
                <td className="k-thumb-cell" width="104" valign="top" style={{ width: "104px", verticalAlign: "top" }}>
                  <Thumbnail src={thumbnail} href={href} />
                </td>
                <td className="k-gap" width="16" style={{ width: "16px", fontSize: 0, lineHeight: 0 }}>&nbsp;</td>
              </>
            ) : null}
            <td valign="top" style={{ verticalAlign: "top" }}>{column}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// --- Text helpers ---

export function hostname(link) {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Shortens very long words (hashes, addresses). URLs stay whole: the text
// boxes wrap them (word-break), and a shortened URL turns into a broken link
// when mail apps auto-link it. Splitting on any whitespace keeps line breaks
// and the word after a URL.
const isUrl = (word) => /^(https?:\/\/|www\.|[\w-]+(\.[\w-]+)+\/)/i.test(word);

const truncateLongWords = (text, maxLength = 30) =>
  (text || "")
    .split(/(\s+)/)
    .map((part) =>
      /^\s/.test(part) || part.length <= maxLength || isUrl(part)
        ? part
        : `${part.substring(0, maxLength)}…`,
    )
    .join("");

// Long posts are cut at the end of a sentence where possible, otherwise at
// a word, and end in "…".
export function clip(text, max = 280) {
  const value = (text || "").replace(/<br\s*\/?>/gi, "\n").trim();
  if (value.length <= max) return truncateLongWords(value);
  const head = value.slice(0, max);
  const sentenceEnd = Math.max(
    head.lastIndexOf(". "),
    head.lastIndexOf("! "),
    head.lastIndexOf("? "),
    head.lastIndexOf(".\n"),
    head.lastIndexOf("\n\n"),
  );
  const lastSpace = head.search(/\s\S*$/);
  const cut = sentenceEnd > max * 0.4 ? sentenceEnd + 1 : lastSpace;
  const clipped = value.slice(0, cut > 0 ? cut : max).trim().replace(/[.,;:\s]+$/, "");
  const short = truncateLongWords(clipped);
  if (short.endsWith("…")) return short;
  // A space keeps the "…" out of a trailing URL when mail apps auto-link it.
  return isUrl(short.split(/\s+/).pop()) ? `${short} …` : `${short}…`;
}

// Uploaded pictures live on Cloudflare Images; email clients get a JPEG
// (some can't show AVIF/WebP, which "public" may serve) at 2x.
export function isUpload(href) {
  return typeof href === "string" && /^https:\/\/imagedelivery\.net\//.test(href);
}

export function uploadVariant(href, options) {
  return href.replace(/\/[^/]+$/, `/${options},f=jpeg`);
}
