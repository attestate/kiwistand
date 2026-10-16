import htm from "htm";
import vhtml from "vhtml";

import { ms } from "./icons.mjs";

const html = htm.bind(vhtml);

const spinner =
  "if(!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button !== 1) {var el=document.getElementById('spinner-overlay'); if(el) el.style.display='block';}";

// The phone tab bar of the NEU 2 design (same as the iOS app): a floating
// glass bar with Home, New, Submit and Notifications. Bell.jsx mounts the
// Notifications (or Log in) tab into .mobile-bell-container; until then the
// matching stand-in shows (html[data-signed-out], news.css), like iOS's
// Notifications / Log In tab.
// NOTE: Phosphor, 24px: regular, or bold inside the green circle on the
// active tab (Tim, 16 Oct: a floating pill like the app's tab bar).
const tab = (href, icon, label, active, dataIcon) => html`
  <a
    data-no-instant
    data-icon="${dataIcon}"
    href="${href}"
    class="kn-tab${active ? " kn-tab-active" : ""}"
    aria-current="${active ? "page" : "false"}"
    onclick="${spinner}"
  >
    <span class="kn-tab-icon">${ms(active ? `${icon}-bold` : icon, 24)}</span>
    <span>${label}</span>
  </a>
`;

const nav = (path) => html`
  <nav class="bottom-nav" aria-label="Tabs">
    ${tab("/", "house", "Home", path === "/" || path === "/best", "home")}
    ${tab("/new?cached=true", "clock", "New", path === "/new", "newest")}
    ${tab("/submit", "plus-circle", "Submit", path === "/submit", "submit")}
    <div class="mobile-bell-container kn-tab">
      <span class="kn-tab-ph kn-tab-ph-in"
        ><span class="kn-tab-icon">${ms("bell", 24)}</span
        ><span>Notifications</span></span
      >
      <span class="kn-tab-ph kn-tab-ph-out"
        ><span class="kn-tab-icon">${ms("user", 24)}</span
        ><span>Log in</span></span
      >
    </div>
  </nav>
`;

export default nav;
