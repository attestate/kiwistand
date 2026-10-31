// @format
// Communities (protocol 13.0.0, see "Communities" in
// docs/src/pages/protocol.mdx): the texts and limits of the Community message,
// the designer's colour palette and the icon suggestions. Ported from the
// iOS app (KiwiNative/Core/Communities.swift and Phosphor.swift).
//
// NOTE: The server's views import this file too (src/views/components/
// communities.mjs), so it must stay free of imports and browser APIs.

export const NAME_LIMIT = 24;
export const ABOUT_LIMIT = 100;
export const RULE_LIMIT = 140;
export const RULES_LIMIT = 5;
export const NAME_PATTERN = /^[A-Za-z0-9]+([ -][A-Za-z0-9]+)*$/;
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

// "Agent Builders" -> "agent-builders"
export function nameKey(name) {
  return name.toLowerCase().replace(/ /g, "-");
}

// "<owner address lowercase>/<name key>", as posts name a community.
export function communityId(owner, name) {
  return `${owner.toLowerCase()}/${nameKey(name)}`;
}

// ---------------------------------------------------------------- texts

// Characters a node takes but nobody can see: controls (line breaks
// included), line and paragraph separators, zero-width characters and the
// bidi embeddings, overrides and isolates.
export function isInvisible(codePoint) {
  return (
    codePoint <= 0x1f ||
    (codePoint >= 0x7f && codePoint <= 0x9f) ||
    codePoint === 0x2028 ||
    codePoint === 0x2029 ||
    (codePoint >= 0x200b && codePoint <= 0x200f) ||
    (codePoint >= 0x202a && codePoint <= 0x202e) ||
    (codePoint >= 0x2066 && codePoint <= 0x2069)
  );
}

// A name, about or rule as it's signed: invisible characters dropped,
// spaces trimmed.
export function clean(text) {
  return [...String(text)]
    .filter((char) => !isInvisible(char.codePointAt(0)))
    .join("")
    .trim();
}

// Lengths as the node counts them: code points.
export function length(text) {
  return [...String(text)].length;
}

// Cuts a text to `limit` code points (typing past a limit).
export function clip(text, limit) {
  const chars = [...String(text)];
  return chars.length > limit ? chars.slice(0, limit).join("") : text;
}

export function isValidName(name) {
  const cleaned = clean(name);
  return length(cleaned) <= NAME_LIMIT && NAME_PATTERN.test(cleaned);
}

// Has something other than spaces.
function visible(text) {
  return /\S/u.test(text);
}

// The rules as they're signed: cleaned, empty ones left out.
export function cleanRules(rules) {
  return rules.map(clean).filter((rule) => rule.length > 0);
}

// The fields of a Community message as they're signed, or `{ error }`.
export function prepare({ name, about, rules, icon, color }) {
  const fields = {
    name: clean(name),
    about: clean(about),
    rules: cleanRules(rules),
    icon,
    color,
  };
  if (!fields.name) return { error: "Give your community a name." };
  if (!isValidName(fields.name)) {
    return {
      error: "Use letters and digits, with one space or hyphen between words.",
    };
  }
  if (length(fields.about) > ABOUT_LIMIT || (fields.about && !visible(fields.about))) {
    return { error: `Keep the description to ${ABOUT_LIMIT} characters.` };
  }
  if (fields.rules.length > RULES_LIMIT) {
    return { error: `Add at most ${RULES_LIMIT} rules.` };
  }
  if (fields.rules.some((rule) => length(rule) > RULE_LIMIT || !visible(rule))) {
    return { error: `Keep each rule to ${RULE_LIMIT} characters.` };
  }
  if (!icon) return { error: "Pick an icon." };
  if (!PALETTE.some(({ hex }) => hex === color)) {
    return { error: "Pick a colour." };
  }
  return { fields };
}

// ---------------------------------------------------------------- membership

// Whether `identity` (an address, any case) runs the community.
export function isOwner(community, identity) {
  return (
    typeof identity === "string" &&
    typeof community?.owner === "string" &&
    community.owner.toLowerCase() === identity.toLowerCase()
  );
}

// Your communities: the ones you joined (newest first), then the ones your
// account runs that aren't among them. A community you run always counts as
// joined, on every device, even if this browser never joined it.
export function yourCommunities(joined, owned) {
  const ids = new Set(joined.map(({ id }) => id));
  return [...joined, ...owned.filter(({ id }) => !ids.has(id))];
}

export function isMember(id, joined, owned) {
  return yourCommunities(joined, owned).some((c) => c.id === id);
}

// Nobody leaves the community they run.
export function canLeave(community, identity) {
  return !isOwner(community, identity);
}

// Names in buttons are cut after 16 characters, like the iOS app's.
export function shortName(name) {
  const chars = [...String(name)];
  return chars.length > 16 ? `${chars.slice(0, 15).join("")}…` : name;
}

// ---------------------------------------------------------------- people

// "0x6E56…FfEe", like the rows show addresses.
export function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Who created a community: "you", the owner's name or the short address.
export function creator(community, identity) {
  if (identity && community.owner.toLowerCase() === identity.toLowerCase()) {
    return "you";
  }
  return community.ownerName || shortAddress(community.owner);
}

export function isAddress(value) {
  return typeof value === "string" && ADDRESS.test(value);
}

// The invite link: the community's public page, with who shared it.
export function inviteURL(id, inviter) {
  const url = `https://news.kiwistand.com/c/${id}`;
  return isAddress(inviter) ? `${url}?via=${inviter}` : url;
}

// A post's timestamp: now, but at least a second after the community was
// created, since nodes only take posts to an older community.
export function postTimestamp(created, now = Math.floor(Date.now() / 1000)) {
  return Math.max(now, (created || 0) + 1);
}

// ---------------------------------------------------------------- colours

// The designer's community palette (color.c-* in the design file): the
// light value is what's signed; dark, tint and text are how it's drawn.
// Violet, teal, coral, blue, amber, rose, slate, brown.
export const PALETTE = [
  { key: "violet", hex: "#6E56CF", dark: "#A594F9", tint: "#E4DEF2", tintDark: "#2F2B3C", text: "#5B45B8", textDark: "#C2B6FF" },
  { key: "teal", hex: "#1F8A7A", dark: "#4CC3AE", tint: "#D3E9DD", tintDark: "#1F362D" },
  { key: "coral", hex: "#C8553D", dark: "#F08A72", tint: "#F5DCCC", tintDark: "#3D2A22" },
  { key: "blue", hex: "#4A72B8", dark: "#8FAEE0", tint: "#DAE3F2", tintDark: "#232D3B" },
  { key: "amber", hex: "#A86B12", dark: "#E2A94A", tint: "#F1E4BC", tintDark: "#3A321D" },
  { key: "rose", hex: "#B83E72", dark: "#EE84B0", tint: "#F2DAE2", tintDark: "#3A2530" },
  { key: "slate", hex: "#56616D", dark: "#A9B4BF", tint: "#E0E4E1", tintDark: "#2A302C" },
  { key: "brown", hex: "#7A5230", dark: "#D9965A", tint: "#EADCCB", tintDark: "#362B21" },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

// `amount` of `hex` over `background`, as "#RRGGBB".
function mix(hex, background, amount) {
  const channel = (value, shift) => (parseInt(value.slice(1), 16) >> shift) & 0xff;
  const out = [16, 8, 0].map((shift) => {
    const top = channel(hex, shift);
    const bottom = channel(background, shift);
    return Math.round(bottom + (top - bottom) * amount)
      .toString(16)
      .padStart(2, "0");
  });
  return `#${out.join("")}`.toUpperCase();
}

// How a community's colour is drawn, light and dark: `base` for icons and
// outlines, `soft` behind tags and small tiles, `tint` behind cards, `text`
// for names on `soft`. A palette colour maps to the palette's values; any
// other hex (another client may sign one) is drawn as is, with soft and tint
// mixed from it.
export function colors(hex) {
  const value = HEX.test(hex) ? hex.toUpperCase() : PALETTE[6].hex;
  const known = PALETTE.find((entry) => entry.hex === value);
  if (known) {
    return {
      base: known.hex,
      baseDark: known.dark,
      soft: `${known.hex}1A`,
      softDark: `${known.dark}29`,
      tint: known.tint,
      tintDark: known.tintDark,
      text: known.text || known.hex,
      textDark: known.textDark || known.dark,
    };
  }
  return {
    base: value,
    baseDark: value,
    soft: `${value}1A`,
    softDark: `${value}29`,
    tint: mix(value, "#FFFFFF", 0.18),
    tintDark: mix(value, "#191D17", 0.2),
    text: value,
    textDark: value,
  };
}

// The colours as CSS custom properties. The stylesheets pick the light or
// dark ones (`.cm-c` in news.css).
export function colorVars(hex) {
  const c = colors(hex);
  return {
    "--c": c.base,
    "--c-d": c.baseDark,
    "--c-soft": c.soft,
    "--c-soft-d": c.softDark,
    "--c-tint": c.tint,
    "--c-tint-d": c.tintDark,
    "--c-text": c.text,
    "--c-text-d": c.textDark,
  };
}

// colorVars for a `style` attribute.
export function colorStyle(hex) {
  return Object.entries(colorVars(hex))
    .map(([name, value]) => `${name}:${value}`)
    .join(";");
}

// ---------------------------------------------------------------- icons

// Shown while a name has no matches yet, and to fill up the suggestions.
export const FALLBACK_ICONS = [
  "users-three",
  "chat-circle-dots",
  "lightbulb",
  "star",
  "globe",
  "book-open",
  "rocket-launch",
  "heart",
];

// Lowercase words of letters and digits.
export function words(text) {
  return String(text)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

// The word and simple stems of it ("books" -> "book", "coding" -> "cod",
// "code", "builders" -> "build").
function variants(word) {
  const result = [word];
  if (word.length > 3 && word.endsWith("s")) result.push(word.slice(0, -1));
  if (word.length > 5 && word.endsWith("ing")) {
    const stem = word.slice(0, -3);
    result.push(stem, `${stem}e`);
  }
  if (word.length > 4 && word.endsWith("ers")) {
    result.push(word.slice(0, -3));
  } else if (word.length > 4 && word.endsWith("er")) {
    result.push(word.slice(0, -2));
  }
  return result;
}

// The catalog (src/web/src/phosphor.json) prepared for matching.
export function catalog(data) {
  const icons = data.icons.map(([name, path, tags, kinds], order) => {
    const list = tags ? tags.split(",") : [];
    return {
      name,
      path,
      order,
      kinds,
      tags: list,
      parts: name.split("-"),
      tagWords: new Set(list.flatMap(words)),
      categoryWords: new Set(
        kinds.flatMap((kind) => words(data.categories[kind]?.name || "")),
      ),
    };
  });
  return {
    icons,
    categories: data.categories,
    byName: new Map(icons.map((icon) => [icon.name, icon])),
  };
}

// How well one word names an icon: its name first, then a whole tag, a word
// in a tag, the start of a name part or tag word, a category.
function score(icon, word) {
  if (icon.name === word) return 100;
  if (icon.parts[0] === word) return 40;
  if (icon.parts.includes(word)) return 30;
  if (icon.tags.includes(word)) return 25;
  if (icon.tagWords.has(word)) return 15;
  if (word.length >= 3) {
    if (icon.parts.some((part) => part.startsWith(word))) return 12;
    for (const tag of icon.tagWords) if (tag.startsWith(word)) return 8;
  }
  if (icon.categoryWords.has(word)) return 4;
  return 0;
}

// Icon names matching a text, best first; simpler names (fewer parts) win
// a tie, then Phosphor's order. `skip` leaves icons out.
export function matchIcons(text, icons, limit = Infinity, skip = () => false) {
  const query = words(text);
  if (!query.length) return [];
  const scored = [];
  for (const icon of icons.icons) {
    if (skip(icon)) continue;
    let total = 0;
    for (const word of query) {
      total += Math.max(...variants(word).map((v) => score(icon, v)));
    }
    if (total > 0) scored.push({ total, icon });
  }
  scored.sort(
    (a, b) =>
      b.total - a.total ||
      a.icon.parts.length - b.icon.parts.length ||
      a.icon.order - b.icon.order,
  );
  return scored.slice(0, limit).map(({ icon }) => icon.name);
}

// Icons for a community's name: its matches, filled up with FALLBACK_ICONS.
// NOTE: Not other companies' logos ("AI" would suggest OpenAI's first):
// the picker's search still finds them.
export function suggestIcons(name, icons, count = 8) {
  const brands = icons.categories.findIndex(({ name }) => name === "brands");
  const isBrand = (icon) => icon.kinds.includes(brands);
  const result = matchIcons(name, icons, count, isBrand);
  for (const extra of FALLBACK_ICONS) {
    if (result.length >= count) break;
    if (!result.includes(extra)) result.push(extra);
  }
  return result;
}
