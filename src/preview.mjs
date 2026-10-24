// NOTE: Link previews (og:image and the Farcaster frame image) for stories
// and comments, after the designer's templates (kiwinews-design,
// "kiwi-previews"): a story card and a comment card, each 1200×630 (X,
// LinkedIn, iMessage, WhatsApp …) and 1200×800 (Farcaster). Rendered with
// satori, so only flexbox layout; the templates' grid and pseudo-elements are
// rebuilt with nested boxes.
import { readFile, writeFile, access } from "fs/promises";
import { createHash } from "crypto";
import { resolve } from "path";

import satori from "satori";
import sharp from "sharp";
import htm from "htm";
import { format } from "date-fns";

const html = htm.bind(h);

// NOTE: satori counts a children array as several children, which only a
// flex box may have, so a lone child is passed on its own.
function h(type, props, ...children) {
  const kids =
    children.length === 0 ? undefined : children.length === 1 ? children[0] : children;
  return { type, props: { ...props, children: kids } };
}

// NOTE: Bump when the cards change, so new images get new URLs and X,
// Farcaster etc. don't keep showing their cached copy of the old one.
export const VERSION = "v2";

export function fileName(name, isFrame = false) {
  return `${name}-${VERSION}${isFrame ? "-frame" : ""}.jpg`;
}

const PAGE = "#F8F9F4";
const INK = "#10131D";
const KIWI = "#D4EC37";
const BODY = "#5F6770";
const LABEL = "#78818A";
const HAIR = "#E3E5DD";
const MONO = "JetBrains Mono";

export const SIZES = {
  og: { width: 1200, height: 630 },
  frame: { width: 1200, height: 800 },
};

// Title size and line limit by length, for 630 and 800 high cards.
export function titleStyle(title, isFrame) {
  const length = title.length;
  if (length <= 40) return isFrame ? [96, 4] : [84, 3];
  if (length <= 80) return isFrame ? [80, 4] : [68, 3];
  return isFrame ? [66, 5] : [56, 4];
}

export function commentStyle(text, isFrame) {
  const length = text.length;
  if (length <= 40) return isFrame ? [72, 3] : [60, 2];
  if (length <= 90) return isFrame ? [52, 4] : [44, 3];
  if (length <= 180) return isFrame ? [44, 6] : [38, 4];
  return isFrame ? [38, 7] : [34, 4];
}

const addressPattern = /^0x[0-9a-fA-F]{40}$/;

export function shortAddress(address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// The name shown for a person: their ENS/Farcaster/Lens name, else the
// shortened address. Long names end in "…".
export function displayName(name, address) {
  let value = (name || "").trim();
  if (!value || addressPattern.test(value) || /^0x[0-9a-fA-F]{4,}\.{3}/.test(value)) {
    value = address && addressPattern.test(address) ? shortAddress(address) : value;
  }
  if (value.length >= 24) value = value.slice(0, 22) + "…";
  return value;
}

export function cleanDomain(domain) {
  let value = (domain || "").toLowerCase().replace(/^www\./, "");
  if (value.length >= 28) value = value.slice(0, 26) + "…";
  return value;
}

// "Show Kiwi: https://github.com/attestate/x" -> "Show Kiwi: github.com/…"
export function cleanTitle(title) {
  return (title || "").replace(/https?:\/\/([^\s/]+)(\/\S*)?/gi, (_, host, path) => {
    const domain = host.toLowerCase().replace(/^www\./, "");
    return path && path !== "/" ? `${domain}/…` : domain;
  });
}

// One line of plain text: no line breaks, runs of spaces or Markdown.
export function cleanComment(text) {
  return (text || "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*>+\s?/gm, "")
    .replace(/^\s*#+\s+/gm, "")
    .replace(/(\*\*|__|`)/g, "")
    .replace(/(^|\s)[_*]([^_*\s][^_*]*?)[_*](?=\s|$|[.,!?;:])/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

// Top four reactions, most used first.
export function topReactions(reactions) {
  return (reactions || [])
    .filter((reaction) => reaction?.emoji && reaction.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
}

// Someone without an avatar gets a gradient from their address, so they
// always get the same colors.
export function gradient(address) {
  const hash = createHash("sha256")
    .update((address || "").toLowerCase())
    .digest("hex");
  const value = parseInt(hash.slice(0, 8), 16);
  const hue1 = value % 360;
  const hue2 = (hue1 + 40 + (value % 61)) % 360;
  return `linear-gradient(135deg, ${hsl(hue1, 70, 62)}, ${hsl(hue2, 65, 45)})`;
}

// satori can't parse hsl() inside a gradient, so it gets hex.
function hsl(hue, saturation, lightness) {
  const s = saturation / 100;
  const l = lightness / 100;
  const k = (n) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const channel = (n) => {
    const value = l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return Math.round(value * 255).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

// NOTE: The wordmark is an SVG, but the renderer drops SVG pictures inside
// satori's output, so it's turned into a PNG once (at twice the size).
let wordmark;
async function loadWordmark() {
  if (!wordmark) {
    const svg = await readFile(resolve("./fonts/preview/wordmark.svg"));
    const png = await sharp(svg, { density: 144 }).resize({ height: 80 }).png().toBuffer();
    wordmark = `data:image/png;base64,${png.toString("base64")}`;
  }
  return wordmark;
}

const fill = { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 };

function frame(label, isFrame, children) {
  const { width, height } = isFrame ? SIZES.frame : SIZES.og;
  return html`
    <div
      style=${{
        display: "flex",
        position: "relative",
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: PAGE,
        backgroundImage: `radial-gradient(circle, rgba(16,19,29,0.07) 1.2px, transparent 1.5px)`,
        backgroundSize: "24px 24px",
        color: INK,
        fontFamily: "Inter",
      }}
    >
      <div
        style=${{
          position: "absolute",
          left: "72px",
          right: "72px",
          top: "60px",
          height: "40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <img src=${wordmark} height="40" width="227" />
        <span
          style=${{
            fontFamily: MONO,
            fontSize: "19px",
            letterSpacing: "3px",
            textTransform: "uppercase",
            color: LABEL,
          }}
        >
          ${label}
        </span>
      </div>
      ${children}
    </div>
  `;
}

// An avatar with the templates' ring (page color, then ink).
function avatar(url, address, size) {
  const ring = size >= 64 ? [3, 2] : [2, 2];
  const outer = size + 2 * (ring[0] + ring[1]);
  const picture = url
    ? html`<img
        src=${url}
        width=${size}
        height=${size}
        style=${{ borderRadius: "50%", objectFit: "cover" }}
      />`
    : html`<div
        style=${{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: "50%",
          backgroundImage: gradient(address),
        }}
      />`;
  return html`
    <div
      style=${{
        display: "flex",
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        width: `${outer}px`,
        height: `${outer}px`,
        margin: `-${ring[0] + ring[1]}px`,
        borderRadius: "50%",
        backgroundColor: INK,
      }}
    >
      <div
        style=${{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: `${size + 2 * ring[0]}px`,
          height: `${size + 2 * ring[0]}px`,
          borderRadius: "50%",
          backgroundColor: PAGE,
        }}
      >
        ${picture}
      </div>
    </div>
  `;
}

function dot(style = {}) {
  return html`<div
    style=${{
      width: "18px",
      height: "18px",
      borderRadius: "50%",
      backgroundColor: INK,
      flexShrink: 0,
      ...style,
    }}
  />`;
}

// story(title, name, avatarUrl, domain, { address, isTextPost }) returns a
// function of isFrame, as the two sizes lay out the title differently.
export function story(title, name, avatarUrl, domain, options = {}) {
  const { address, isTextPost = false } = options;
  return (isFrame = false) => {
    const text = cleanTitle(title);
    const [size, lines] = titleStyle(text, isFrame);
    const chip = isTextPost
      ? { backgroundColor: "transparent", color: INK, border: `3px solid ${INK}`, padding: "9px 17px" }
      : { backgroundColor: INK, color: "#F4F6EF", padding: "12px 20px" };
    return frame(
      "news.kiwistand.com",
      isFrame,
      html`
        <div
          style=${{
            position: "absolute",
            left: "72px",
            right: "72px",
            top: "130px",
            bottom: "170px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style=${{
              display: "block",
              width: "100%",
              fontWeight: 700,
              fontSize: `${size}px`,
              letterSpacing: `${-0.035 * size}px`,
              lineHeight: 1.06,
              lineClamp: lines,
              wordBreak: "break-word",
              // Short titles break evenly, as in the templates; for long
              // ones satori's balancing leaves the lines too short.
              ...(text.length <= 40 ? { textWrap: "balance" } : {}),
            }}
          >
            ${text}
          </div>
        </div>
        <div
          style=${{
            position: "absolute",
            left: "72px",
            right: "72px",
            bottom: "60px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style=${{
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              maxWidth: "460px",
            }}
          >
            ${avatar(avatarUrl, address, 64)}
            <span
              style=${{
                marginLeft: "18px",
                fontWeight: 600,
                fontSize: "28px",
                letterSpacing: "-0.28px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              ${displayName(name, address)}
            </span>
          </div>
          <div
            style=${{
              display: "flex",
              flexGrow: 1,
              minWidth: "80px",
              height: "10px",
              margin: "0 22px",
              borderRadius: "4px",
              backgroundColor: KIWI,
              position: "relative",
            }}
          >
            ${dot({ position: "absolute", left: "-9px", top: "-4px" })}
            ${dot({ position: "absolute", right: "-9px", top: "-4px" })}
          </div>
          <div
            style=${{
              display: "block",
              flexShrink: 0,
              maxWidth: "440px",
              fontFamily: MONO,
              fontWeight: 500,
              fontSize: "26px",
              borderRadius: "14px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              ...chip,
            }}
          >
            ${isTextPost ? "Text post" : cleanDomain(domain)}
          </div>
        </div>
      `,
    );
  };
}

// comment({ text, name, avatar, address, timestamp, reactions },
//         { title, domain, name, avatar, address, isTextPost })
// returns a function of isFrame. Without the story's submitter the rail
// starts with a dot instead of their avatar.
export function comment(commentData, storyData) {
  return (isFrame = false) => {
    const text = cleanComment(commentData.text);
    const [size, lines] = commentStyle(text, isFrame);
    const storyName = storyData.address
      ? displayName(storyData.name, storyData.address)
      : null;
    const storyDomain = storyData.isTextPost
      ? "text post"
      : cleanDomain(storyData.domain);
    const date = commentData.timestamp
      ? format(new Date(commentData.timestamp * 1000), "MMM d, yyyy")
      : "";
    const reactions = topReactions(commentData.reactions);
    const indent = "88px";

    return frame(
      "Comment",
      isFrame,
      html`
        <div
          style=${{
            position: "absolute",
            left: "72px",
            right: "72px",
            top: "130px",
            bottom: "56px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style=${{ display: "flex" }}>
            <div
              style=${{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: "64px",
                flexShrink: 0,
              }}
            >
              ${storyName
                ? html`<div style=${{ display: "flex", marginTop: "2px" }}>
                    ${avatar(storyData.avatar, storyData.address, 40)}
                  </div>`
                : dot({ marginTop: "9px" })}
              <div
                style=${{
                  display: "flex",
                  flexGrow: 1,
                  width: "10px",
                  minHeight: "24px",
                  margin: "-4px 0",
                  borderRadius: "5px",
                  backgroundColor: KIWI,
                }}
              />
              ${avatar(commentData.avatar, commentData.address, 64)}
            </div>
            <div
              style=${{
                display: "flex",
                flexDirection: "column",
                width: "968px",
                marginLeft: "24px",
              }}
            >
              <div
                style=${{
                  display: "flex",
                  flexDirection: "column",
                  paddingBottom: "30px",
                }}
              >
                <div
                  style=${{
                    display: "flex",
                    fontFamily: MONO,
                    fontSize: "20px",
                    color: LABEL,
                    marginBottom: "6px",
                    whiteSpace: "nowrap",
                  }}
                >
                  ${storyName
                    ? html`<span style=${{ fontWeight: 500, color: INK }}
                          >${storyName}</span
                        ><span style=${{ marginLeft: "10px" }}>${`· ${storyDomain}`}</span>`
                    : html`<span>${storyDomain}</span>`}
                </div>
                <div
                  style=${{
                    display: "block",
                    fontWeight: 600,
                    fontSize: "27px",
                    lineHeight: 1.25,
                    letterSpacing: "-0.27px",
                    color: BODY,
                    lineClamp: isFrame ? 2 : 1,
                    wordBreak: "break-word",
                  }}
                >
                  ${cleanTitle(storyData.title)}
                </div>
              </div>
              <div
                style=${{
                  display: "flex",
                  alignItems: "center",
                  height: "64px",
                }}
              >
                <span
                  style=${{
                    fontWeight: 600,
                    fontSize: "28px",
                    letterSpacing: "-0.28px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  ${displayName(commentData.name, commentData.address)}
                </span>
                <span
                  style=${{
                    marginLeft: "16px",
                    fontFamily: MONO,
                    fontSize: "20px",
                    color: LABEL,
                    whiteSpace: "nowrap",
                  }}
                >
                  ${date}
                </span>
              </div>
            </div>
          </div>
          <div
            style=${{
              display: "block",
              marginLeft: indent,
              marginTop: "6px",
              fontWeight: 500,
              fontSize: `${size}px`,
              letterSpacing: `${-0.02 * size}px`,
              lineHeight: 1.22,
              lineClamp: lines,
              wordBreak: "break-word",
            }}
          >
            ${text}
          </div>
          ${reactions.length > 0
            ? html`<div
                style=${{ display: "flex", marginLeft: indent, marginTop: "26px" }}
              >
                ${reactions.map(
                  (reaction, i) => html`<div
                    style=${{
                      display: "flex",
                      alignItems: "center",
                      marginLeft: i === 0 ? 0 : "12px",
                      padding: "8px 16px",
                      borderRadius: "999px",
                      backgroundColor: "#FFFFFF",
                      border: `2px solid ${HAIR}`,
                      fontWeight: 600,
                      fontSize: "24px",
                    }}
                  >
                    <span style=${{ marginRight: "8px" }}>${reaction.emoji}</span>
                    <span>${String(reaction.count)}</span>
                  </div>`,
                )}
              </div>`
            : null}
        </div>
      `,
    );
  };
}

let fonts;
async function loadFonts() {
  if (fonts) return fonts;
  const file = (path) => readFile(resolve(path));
  const [regular, semibold, medium, mediumExt, bold, boldExt, mono, monoMedium] =
    await Promise.all([
      file("./Inter-Regular.ttf"),
      file("./Inter-SemiBold.ttf"),
      file("./fonts/preview/inter-latin-500-normal.woff"),
      file("./fonts/preview/inter-latin-ext-500-normal.woff"),
      file("./fonts/preview/inter-latin-700-normal.woff"),
      file("./fonts/preview/inter-latin-ext-700-normal.woff"),
      file("./fonts/preview/jetbrains-mono-latin-400-normal.woff"),
      file("./fonts/preview/jetbrains-mono-latin-500-normal.woff"),
    ]);
  fonts = [
    { name: "Inter", data: regular, weight: 400, style: "normal" },
    { name: "Inter", data: medium, weight: 500, style: "normal" },
    { name: "Inter", data: mediumExt, weight: 500, style: "normal" },
    { name: "Inter", data: semibold, weight: 600, style: "normal" },
    { name: "Inter", data: bold, weight: 700, style: "normal" },
    { name: "Inter", data: boldExt, weight: 700, style: "normal" },
    { name: MONO, data: mono, weight: 400, style: "normal" },
    { name: MONO, data: monoMedium, weight: 500, style: "normal" },
  ];
  return fonts;
}

// NOTE: satori draws emoji from pictures (Twemoji, fetched once each and
// kept in memory). Twemoji names its files by code
// point, without the FE0F variation selector unless the emoji has a ZWJ.
export function twemojiName(segment) {
  const points = [...segment].map((char) => char.codePointAt(0));
  const filtered = points.includes(0x200d)
    ? points
    : points.filter((point) => point !== 0xfe0f);
  return filtered.map((point) => point.toString(16)).join("-");
}

const emojiCache = new Map();
async function loadEmoji(segment) {
  const name = twemojiName(segment);
  if (emojiCache.has(name)) return emojiCache.get(name);
  const url = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${name}.svg`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`status ${response.status}`);
    // As PNG: like the wordmark, an SVG picture wouldn't show.
    const svg = Buffer.from(await response.arrayBuffer());
    const png = await sharp(svg, { density: 288 }).resize(96, 96).png().toBuffer();
    const src = `data:image/png;base64,${png.toString("base64")}`;
    if (emojiCache.size > 500) emojiCache.clear();
    emojiCache.set(name, src);
    return src;
  } catch (err) {
    return undefined;
  }
}

export async function render(body, isFrame = false) {
  await loadWordmark();
  const element = typeof body === "function" ? body(isFrame) : body;
  const svg = await satori(element, {
    ...(isFrame ? SIZES.frame : SIZES.og),
    fonts: await loadFonts(),
    loadAdditionalAsset: async (code, segment) =>
      code === "emoji" ? loadEmoji(segment) : undefined,
  });
  return sharp(Buffer.from(svg))
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

export async function generate(name, body, isFrame = false) {
  const filePath = resolve(`./src/public/previews/${fileName(name, isFrame)}`);

  try {
    await access(filePath);
    return; // File exists, so we just return
  } catch (err) {
    // File doesn't exist, we continue with the generation
  }

  await writeFile(filePath, await render(body, isFrame));
}
