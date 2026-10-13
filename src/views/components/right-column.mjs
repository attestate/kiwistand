//@format
import htm from "htm";
import vhtml from "vhtml";

import { NewsletterCardElement } from "./newsletter-card.mjs";
import { ms } from "./icons.mjs";

const html = htm.bind(vhtml);

export const sidebarHeadline = "The week's five, every Sunday.";
export const sidebarCopy =
  "The stories the Kiwi community liked most, in one short email.";

const TESTFLIGHT = "https://testflight.apple.com/join/6jyvYECH";

// The iPhone beta box of the NEU 2 right column.
export const AppBox = () => html`
  <div id="testflight-qr-container" class="kn-side-box kn-app-box">
    <div class="kn-qr-tile">
      <img
        src="/testflight-qr.png"
        alt="TestFlight QR code"
        width="84"
        height="84"
      />
    </div>
    <div class="kn-app-text">
      <span class="kn-eyebrow">iPhone beta</span>
      <span class="kn-app-title">Kiwi News for iPhone</span>
      <a
        class="kn-app-link"
        href="${TESTFLIGHT}"
        target="_blank"
        rel="noopener noreferrer"
        >Open TestFlight ${ms("north_east", 13)}</a
      >
    </div>
  </div>
`;

export const SideFooter = () => html`
  <div class="kn-side-footer">
    <div class="kn-side-links">
      <a href="https://kiwistand.github.io/kiwi-docs/" target="_blank">About</a>
      <a href="/guidelines">Guidelines</a>
      <a href="/privacy-policy">Privacy</a>
      <a href="https://attestate.com/kiwistand/main/" target="_blank">API</a>
    </div>
    <span class="kn-side-made">Made for the open web.</span>
  </div>
`;

// The desktop right column (1101px and up): the newsletter sign-up, the
// iPhone beta and the footer links. A page can opt out of the sign-up
// (`newsletter: false`) or put its own boxes in (`children`, e.g. the story
// page's "More from Hot"). The anon-rpc switch goes last.
export default function RightColumn({ newsletter = true, children = null } = {}) {
  return html`
    <aside class="right-column kn-right">
      ${newsletter
        ? NewsletterCardElement("sidebar", sidebarHeadline, sidebarCopy)
        : null}
      ${children}
      ${AppBox()}
      ${SideFooter()}
      <div id="private-rpc-card"></div>
    </aside>
  `;
}
