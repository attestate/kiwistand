//@format
import htm from "htm";
import vhtml from "vhtml";

import { ms } from "./icons.mjs";

const html = htm.bind(vhtml);

// NOTE: "Kiwi" in the brown, "news" in the green of the NEU 2 wordmark; the
// viewBox is cropped to the letters so 112 x 16 is the design's size.
export const KiwiWordmark = (heightPx = 16.33) => html`
  <svg
    class="kiwi-wordmark"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="9 15 192 28"
    width="${Math.round((heightPx * 192) / 28)}"
    height="${heightPx}"
    aria-label="Kiwi News"
    role="img"
  >
    <path class="kiwi-wordmark-kiwi" d="M16.9,40.56c0,.86-.45,1.32-1.32,1.32h-4.89c-.86,0-1.32-.45-1.32-1.32v-23.68c0-.86.45-1.32,1.32-1.32h4.89c.86,0,1.32.45,1.32,1.32v8.04c0,.38.07.41.3.11l5.64-8.38c.49-.71,1.2-1.09,2.07-1.09h6.09c.49,0,.86.64.56,1.09l-7.37,10.98c-.49.71-.49,1.47,0,2.18l7.37,10.98c.3.45-.08,1.09-.56,1.09h-6.09c-.86,0-1.58-.38-2.07-1.09l-5.64-8.38c-.23-.3-.3-.26-.3.11v8.04Z" />
    <path class="kiwi-wordmark-kiwi" d="M36.56,15.69c2.26,0,3.76,1.5,3.76,3.76s-1.5,3.76-3.76,3.76-3.76-1.5-3.76-3.76,1.5-3.76,3.76-3.76ZM32.8,26.78c0-.86.45-1.32,1.32-1.32h4.89c.86,0,1.32.45,1.32,1.32v13.72c0,.86-.45,1.32-1.32,1.32h-4.89c-.86,0-1.32-.45-1.32-1.32v-13.72Z" />
    <path class="kiwi-wordmark-kiwi" d="M55.5,20.93c.26-.83.83-1.28,1.69-1.28h4.89c.86,0,1.43.45,1.69,1.28l3.08,10.3c.11.38.19.38.3,0l3.08-10.3c.26-.83.83-1.28,1.69-1.28h4.89c.86,0,1.17.41.9,1.24l-6.54,19.74c-.26.83-.86,1.24-1.73,1.24h-4.89c-.86,0-1.47-.41-1.73-1.24l-3.01-9.1c-.11-.34-.26-.34-.38,0l-3.01,9.1c-.26.83-.86,1.24-1.73,1.24h-4.89c-.86,0-1.47-.41-1.73-1.24l-6.54-19.74c-.26-.83.04-1.24.9-1.24h4.89c.86,0,1.43.45,1.69,1.28l3.08,10.3c.11.38.19.38.3,0l3.08-10.3Z" />
    <path class="kiwi-wordmark-kiwi" d="M82.72,15.73c2.26,0,3.76,1.5,3.76,3.76s-1.5,3.76-3.76,3.76-3.76-1.5-3.76-3.76,1.5-3.76,3.76-3.76ZM78.96,26.72c0-.86.45-1.32,1.32-1.32h4.89c.86,0,1.32.45,1.32,1.32v13.77c0,.86-.45,1.32-1.32,1.32h-4.89c-.86,0-1.32-.45-1.32-1.32v-13.77Z" />
    <path class="kiwi-wordmark-news" d="M111.7,19.02c5.07,0,8.68,3.05,8.68,9.96v11.58c0,.86-.45,1.32-1.32,1.32h-4.89c-.86,0-1.32-.45-1.32-1.32v-9.7c0-3.46-1.62-4.62-3.23-4.62s-3.23,1.54-3.23,4.62v9.7c0,.86-.45,1.32-1.32,1.32h-4.89c-.86,0-1.32-.45-1.32-1.32v-19.59c0-.86.45-1.32,1.32-1.32h4.89c.86,0,1.32.45,1.32,1.32v.38c0,.38.07.41.3.11,1.24-1.65,2.93-2.44,5-2.44Z" />
    <path class="kiwi-wordmark-news" d="M129.78,32.44c-.38,0-.53.19-.38.53.64,1.58,1.95,2.52,3.31,2.52,1.01,0,1.95-.49,2.67-1.28.64-.71,1.17-.79,1.84-.38l4.32,2.67c.79.49.94,1.13.45,1.84-1.99,2.86-5.19,4.29-9.25,4.29-6.73,0-11.24-4.51-11.24-11.8s4.51-11.8,11.31-11.8,11.31,4.51,11.31,11.8v.3c0,.86-.45,1.32-1.32,1.32h-13.04ZM135.9,29.28c.38,0,.53-.19.38-.53-.64-1.62-2.03-2.59-3.46-2.59s-2.82.98-3.46,2.59c-.15.34,0,.53.38.53h6.16Z" />
    <path class="kiwi-wordmark-news" d="M157.82,20.93c.26-.83.83-1.28,1.69-1.28h4.89c.86,0,1.43.45,1.69,1.28l3.08,10.3c.11.38.19.38.3,0l3.08-10.3c.26-.83.83-1.28,1.69-1.28h4.89c.86,0,1.17.41.9,1.24l-6.54,19.74c-.26.83-.86,1.24-1.73,1.24h-4.89c-.86,0-1.47-.41-1.73-1.24l-3.01-9.1c-.11-.34-.26-.34-.38,0l-3.01,9.1c-.26.83-.86,1.24-1.73,1.24h-4.89c-.86,0-1.47-.41-1.73-1.24l-6.54-19.74c-.26-.83.04-1.24.9-1.24h4.89c.86,0,1.43.45,1.69,1.28l3.08,10.3c.11.38.19.38.3,0l3.08-10.3Z" />
    <path class="kiwi-wordmark-news" d="M194.95,28.34c-1.5,0-1.16-2.14-4.28-2.14-2.26,0-2.67.71-2.67,1.5,0,2.29,13.19-.94,13.19,8.53,0,3.16-3.2,6.39-10.9,6.39-8.23,0-10.19-3.98-10.49-7.97-.07-.86.38-1.32,1.28-1.32h5.11c1.28,0,.34,2.14,4.1,2.14,2.26,0,3.2-.71,3.2-1.5,0-1.92-13.19.56-13.19-8.53,0-2.78,1.92-6.43,10.37-6.43,6.73,0,9.44,3.08,9.81,8.01.08.86-.38,1.32-1.28,1.32h-4.25Z" />
  </svg>
`;

// NOTE: Shows the spinner on a plain left click, like every other in-app link.
const spinner =
  "if(!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button !== 1) {var el=document.getElementById('spinner-overlay'); if(el) el.style.display='block';}";

const discoverPaths = ["/", "/new", "/best", "/stories"];

export const Logo = (className = "") => html`
  <a
    class="kn-logo${className ? ` ${className}` : ""}"
    href="/"
    onclick="${spinner}"
    aria-label="Kiwi News"
  >
    <span class="kiwi-logo-img kn-logo-icon"></span>
    ${KiwiWordmark()}
    <span class="anon-mode-label">anon-mode</span>
  </a>
`;

// The NEU 2 top bar. Phones: a menu (or back) button, the logo in the
// middle and search, like the iOS app. Desktop (641px and up): logo and
// nav links on the left; search, Submit, the account buttons (Bell.jsx
// mounts into #bell) and the menu on the right. On desktop the bar spans
// the window (see .kn-topbar in news.css).
//
// NOTE: There is no Communities link (they come later) and no Leaderboard
// link (the site has no leaderboard page).
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
    <header class="kn-topbar">
      <div class="kn-topbar-left">
        ${hasBack
          ? html`<div class="story-back-button kn-only-mobile">
              <a class="kn-glass" href="/" aria-label="Back">
                ${ms("chevron_left", 20)}
              </a>
            </div>`
          : html`<button
              type="button"
              class="kn-glass sidebar-toggle kn-only-mobile"
              aria-label="Menu"
            >
              ${ms("menu", 20)}
            </button>`}
        ${Logo(titled ? "kn-only-desktop" : "")}
        ${titled
          ? html`<span class="kn-topbar-title kn-only-mobile">${titled}</span>`
          : null}
        <nav class="kn-navlinks kn-only-desktop" aria-label="Main">
          ${navLink("/", "Discover", discoverPaths.includes(path))}
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
          ${ms("search", 16)}
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
          ${ms("add", 16)}<span>Submit</span>
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
            <span class="kn-iconbtn">${ms("notifications", 18)}</span>
            <span class="kn-account-avatar">${ms("person", 18)}</span>
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
          ${ms("menu", 18)}
        </button>
        <div id="search" class="kn-only-mobile${titled ? " kn-hidden" : ""}">
          <a class="kn-glass" href="/search" aria-label="Search">
            ${ms("search", 20)}
          </a>
        </div>
      </div>
    </header>
  </td>`;
};
export default header;
