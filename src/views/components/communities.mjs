//@format
// What the server renders of a community: its icon, tiles and the tag on
// story rows, in its colour (light and dark, see `.cm-c` in news.css).
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

import htm from "htm";
import vhtml from "vhtml";

import { colorStyle } from "../../web/src/communities.mjs";
import { paths as ui } from "../../web/src/cm-icons.mjs";

const html = htm.bind(vhtml);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(__dirname, "../../web/src/phosphor.json");

// NOTE: Every Phosphor icon's path (the regular weight), read on first use:
// a community may use any of the 1,512. The buttons' bold icons are in
// cm-icons.mjs.
let paths;
export function iconPath(name) {
  if (ui[name]) return ui[name];
  if (!paths) {
    const { icons } = JSON.parse(readFileSync(DATA, "utf8"));
    paths = new Map(icons.map(([icon, d]) => [icon, d]));
  }
  return paths.get(name) || paths.get("circle-dashed");
}

export function Icon(name, size = 16) {
  return html`<svg
    class="cm-icon"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
    width="${size}"
    height="${size}"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="${iconPath(name)}" />
  </svg>`;
}

export function communityPath(id) {
  return `/c/${id}`;
}

// The community's icon on a tile: "soft" (its soft colour with an outline,
// in lists) or "plain" (the surface colour, on its tinted cards).
export function Tile(community, size, iconSize, variant = "soft") {
  return html`<span
    class="cm-c cm-tile cm-tile-${variant}"
    style="${colorStyle(community.color)};width:${size}px;height:${size}px"
    aria-hidden="true"
    >${Icon(community.icon, iconSize)}</span
  >`;
}

// The tag before a story's domain.
export function Tag(community) {
  return html`<a
    class="cm-c cm-tag"
    href="${communityPath(community.id)}"
    style="${colorStyle(community.color)}"
    >${Icon(community.icon, 14)}<span>${community.name}</span></a
  >`;
}
