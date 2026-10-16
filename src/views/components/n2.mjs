//@format
// NOTE: Shared bits of the redesigned secondary pages (submit, notifications,
// settings, profile, search, guidelines, privacy, newsletter). Their styles
// are in public/pages.css, which only these pages load.
import htm from "htm";
import vhtml from "vhtml";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import Icon from "./n2-icons.mjs";
import Header from "./header.mjs";
import Footer from "./footer.mjs";
import Sidebar from "./sidebar.mjs";

const html = htm.bind(vhtml);

const __dirname = dirname(fileURLToPath(import.meta.url));
let cssHash = "";
try {
  const css = readFileSync(join(__dirname, "../../public/pages.css"), "utf8");
  cssHash = createHash("md5").update(css).digest("hex").substring(0, 8);
} catch (err) {
  cssHash = Date.now().toString();
}

export function PagesCSS() {
  return html`<link rel="stylesheet" href="/pages.css?v=${cssHash}" />`;
}

// NOTE: The page frame of the redesigned secondary pages: the site header
// (hidden on mobile when the page has the apps' back bar, see BackBar), the
// page body and the footer with the mobile tab bar.
// - head: the <head> contents, usually custom(...) from head.mjs
// - backbar: a BackBar(...) for pages you go back from, or null
// - wide: true for pages laid out on the whole desktop width (submit)
export function Page({ theme, path, head, backbar = null, wide = false, bodyClass = "", body }) {
  const classes = ["n2", backbar ? "n2-backbar-page" : "", bodyClass]
    .filter(Boolean)
    .join(" ");
  return (
    "<!DOCTYPE html>" +
    html`<html lang="en" op="news">
      <head>
        ${head} ${PagesCSS()}
      </head>
      <body
        class="${classes}"
        data-instant-allow-query-string
        data-instant-allow-external-links
        ontouchstart=""
      >
        <div class="container">
          ${Sidebar(path)}
          <div id="hnmain" class="scaled-hnmain">
            <table border="0" cellpadding="0" cellspacing="0" class="n2-table">
              <tr class="n2-global-header">
                ${Header(theme, path)}
              </tr>
              <tr>
                <td>
                  <main class="n2-main${wide ? "" : " n2-narrow"}">
                    ${backbar}
                    ${wide ? body : html`<div class="n2-col">${body}</div>`}
                  </main>
                </td>
              </tr>
            </table>
            ${Footer(theme, path)}
          </div>
        </div>
      </body>
    </html>`
  );
}

// NOTE: Empty and logged-out states: an icon or picture, a line of text and
// an optional action, centered like the apps.
export function EmptyState({
  icon = null,
  image = null,
  text,
  action = null,
  cls = "",
}) {
  return html`<div class="n2-empty ${cls}">
    ${icon ? html`<span class="n2-empty-icon">${Icon(icon)}</span>` : null}
    ${image
      ? html`<img class="n2-empty-image" src="${image}" alt="" />`
      : null}
    <p>${text}</p>
    ${action}
  </div>`;
}

// NOTE: A settings-style section: a mono label with a rule, then its rows.
export function Section(label, rows, hint = null) {
  return html`<section class="n2-set-section">
    <div class="n2-set-label"><span>${label}</span></div>
    <div class="n2-set-group">${rows}</div>
    ${hint ? html`<p class="n2-set-hint">${hint}</p>` : null}
  </section>`;
}

// NOTE: "12m ago", like the apps.
export function timeAgo(timestamp, now = Math.floor(Date.now() / 1000)) {
  const s = Math.max(0, now - timestamp);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return `${Math.floor(s / (86400 * 7))}w ago`;
}

// NOTE: The apps' navigation bar on pages you go back from (settings,
// profile, guidelines, privacy). Mobile only: on desktop the site header is
// the navigation. main.jsx makes the button go back in history when you came
// from this site, otherwise it's a link to `href`.
export function BackBar(title = "", href = "/", right = null) {
  return html`<nav class="n2-backbar" aria-label="Back">
    <a class="n2-glass n2-back" href="${href}" aria-label="Back"
      >${Icon("back")}</a
    >
    <span class="n2-backbar-title">${title}</span>
    ${right || html`<span class="n2-backbar-spacer"></span>`}
  </nav>`;
}

export { Icon };
