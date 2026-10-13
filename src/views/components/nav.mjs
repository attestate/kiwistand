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
const tab = (href, icon, label, active, dataIcon) => html`
  <a
    data-no-instant
    data-icon="${dataIcon}"
    href="${href}"
    class="kn-tab${active ? " kn-tab-active" : ""}"
    aria-current="${active ? "page" : "false"}"
    onclick="${spinner}"
  >
    ${ms(icon, 22)}
    <span>${label}</span>
  </a>
`;

const nav = (path) => html`
  <nav class="bottom-nav" aria-label="Tabs">
    ${tab("/", "home", "Home", path === "/" || path === "/best", "home")}
    ${tab("/new?cached=true", "sensors", "New", path === "/new", "newest")}
    ${tab("/submit", "edit_square", "Submit", path === "/submit", "submit")}
    <div class="mobile-bell-container kn-tab">
      <span class="kn-tab-ph kn-tab-ph-in"
        >${ms("notifications", 22)}<span>Notifications</span></span
      >
      <span class="kn-tab-ph kn-tab-ph-out"
        >${ms("person", 22)}<span>Log in</span></span
      >
    </div>
  </nav>
`;

export default nav;
