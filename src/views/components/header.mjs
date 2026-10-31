//@format
import htm from "htm";
import vhtml from "vhtml";

import { ms } from "./icons.mjs";
import { WORDMARK } from "../../web/src/wordmark.mjs";

const html = htm.bind(vhtml);

// The Kiwi News wordmark (src/web/src/wordmark.mjs): the letters in the
// text colour and the bar over the i's in the wordmark green
// (--kn-wordmark-green), so it follows light and dark mode with the page's
// CSS, without a flash. 105.15 x 18.55 in the nav.
// NOTE: Logo rules: the wordmark always stands alone (no mascot or symbol
// next to it) and never without its bar.
export const KiwiWordmark = (heightPx = 18.55) => html`
  <svg
    class="kiwi-wordmark"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="${WORDMARK.viewBox}"
    width="${Math.round(heightPx * WORDMARK.ratio * 100) / 100}"
    height="${heightPx}"
    aria-label="Kiwi News"
    role="img"
    stroke-linejoin="round"
  >
    <path
      class="kiwi-wordmark-text"
      stroke-width="${WORDMARK.kiwiStroke}"
      d="${WORDMARK.kiwi}"
    />
    <path
      class="kiwi-wordmark-text"
      stroke-width="${WORDMARK.newsStroke}"
      d="${WORDMARK.news}"
    />
    <path class="kiwi-wordmark-bar" d="${WORDMARK.bar}" />
  </svg>
`;

// NOTE: Shows the spinner on a plain left click, like every other in-app link.
const spinner =
  "if(!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button !== 1) {var el=document.getElementById('spinner-overlay'); if(el) el.style.display='block';}";

const discoverPaths = ["/", "/new", "/best", "/stories"];
const isCommunities = (path) => /^\/(communities(\/|$)|c\/)/.test(path || "");

export const Logo = (className = "") => html`
  <a
    class="kn-logo${className ? ` ${className}` : ""}"
    href="/"
    onclick="${spinner}"
    aria-label="Kiwi News"
  >
    ${KiwiWordmark()}
  </a>
`;

// The NEU 2 top bar. Phones: a menu (or back) button, the logo in the
// middle and search, like the iOS app. Desktop (641px and up): logo and
// nav links on the left; search, Submit, the account buttons (Bell.jsx
// mounts into #bell) and the menu on the right. On desktop the bar spans
// the window (see .kn-topbar in news.css).
//
// NOTE: There is no Leaderboard link (the site has no leaderboard page).
const header = (theme, path) => {
  const isStoryPage = path === "/stories";
  // NOTE: Phones show a back button and the page's title instead of the
  // menu and the logo on these pages (iOS "Saved stories" frame).
  const titled = { "/saved": "Saved stories" }[path];
  const hasBack = isStoryPage || Boolean(titled);
  const navLink = (href, label, active) => html`
    <a
      href="${href}"
      class="kn-navlink${active ? " kn-navlink-active" : ""}"
      aria-current="${active ? "page" : "false"}"
      onclick="${spinner}"
      >${label}</a
    >
  `;
  return html`<td class="kn-header-cell">
    <nav-delegation-modal />
    <header id="kn-topbar" class="kn-topbar">
      <div class="kn-topbar-left">
        ${hasBack
          ? html`<div class="story-back-button kn-only-mobile">
              <a class="kn-glass" href="/" aria-label="Back">
                ${ms("caret-left-bold", 20)}
              </a>
            </div>`
          : html`<button
              type="button"
              class="kn-glass sidebar-toggle kn-only-mobile"
              aria-label="Menu"
            >
              ${ms("list-bold", 20)}
            </button>`}
        ${Logo(titled ? "kn-only-desktop" : "")}
        ${titled
          ? html`<span class="kn-topbar-title kn-only-mobile">${titled}</span>`
          : null}
        <nav class="kn-navlinks kn-only-desktop" aria-label="Main">
          ${navLink("/", "Discover", discoverPaths.includes(path))}
          ${navLink("/communities", "Communities", isCommunities(path))}
          ${navLink("/saved", "Saved stories", path === "/saved")}
        </nav>
      </div>
      <div class="kn-topbar-right">
        <form
          id="static-desktop-search"
          class="kn-search kn-only-wide"
          action="/search"
          method="get"
          role="search"
        >
          ${ms("magnifying-glass", 16)}
          <input
            type="search"
            name="q"
            placeholder="Search stories"
            aria-label="Search stories"
            autocomplete="off"
          />
          <kbd>⌘S</kbd>
        </form>
        <a
          class="kn-btn kn-btn-accent kn-only-desktop"
          href="/submit"
          data-no-instant
          onclick="${spinner}"
        >
          ${ms("plus-bold", 16)}<span>Submit</span>
        </a>
        <div id="bell" class="kn-account kn-only-desktop">
          ${
            // NOTE: Stand-ins until Bell.jsx mounts, the same size as what
            // it renders, so nothing shifts: the bell and the avatar, or
            // "Log in" for browsers without a Kiwi key (theme-init.js sets
            // data-signed-out before the first paint; news.css picks one).
            ""
          }
          <span class="kn-account-ph kn-account-ph-in" aria-hidden="true">
            <span class="kn-iconbtn">${ms("bell-bold", 18)}</span>
            <span class="kn-account-avatar">${ms("user", 18)}</span>
          </span>
          <span class="kn-account-ph kn-account-ph-out" aria-hidden="true">
            <span class="kn-btn kn-btn-outline">Log in</span>
          </span>
        </div>
        <button
          type="button"
          class="kn-iconbtn sidebar-toggle kn-only-desktop"
          aria-label="Menu"
        >
          ${ms("list-bold", 18)}
        </button>
        <div id="search" class="kn-only-mobile${titled ? " kn-hidden" : ""}">
          <a class="kn-glass" href="/search" aria-label="Search">
            ${ms("magnifying-glass-bold", 20)}
          </a>
        </div>
      </div>
    </header>
  </td>`;
};
export default header;
