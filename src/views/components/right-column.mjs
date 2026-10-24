//@format
import htm from "htm";
import vhtml from "vhtml";

import { NewsletterCardElement } from "./newsletter-card.mjs";
import { ms } from "./icons.mjs";

const html = htm.bind(vhtml);

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
        >Open TestFlight ${ms("arrow-up-right", 13)}</a
      >
    </div>
  </div>
`;

const BRAND_ASSETS =
  "https://drive.google.com/drive/folders/1vH5vEcXCsbbrYfCpTIvimLSzDMgq1eIa?usp=sharing";

const TELEGRAM = "https://t.me/+QGAviVT67m00Njc8";

// NOTE: The design's "Side footer" ("Web 2 · Desktop · Home · Hot" →
// Sidebar → Side footer): rows of plain links, then "Made for the open
// web." and "Hosted by attestate.com (Kontakt).". Telegram (Tim's ask)
// follows Newsletter. The links are grouped so the rows set ragged right:
// at 280px they run 217, 244, 188, 211px, so the right edge flutters
// gently instead of bulging or leaving a hole after a short row. "Docs"
// was the same page as "About".
export const SideFooter = () => html`
  <div class="kn-side-footer">
    <nav class="kn-side-links" aria-label="Footer">
      <div class="kn-side-row">
        <a href="https://kiwistand.github.io/kiwi-docs/" target="_blank"
          >About</a
        >
        <a href="/guidelines">Guidelines</a>
        <a href="/privacy-policy">Privacy</a>
        <a href="https://attestate.com/kiwistand/main/" target="_blank">API</a>
      </div>
      <div class="kn-side-row">
        <a href="/newsletter">Newsletter</a>
        <a href="${TELEGRAM}" target="_blank" rel="noopener noreferrer"
          >Telegram</a
        >
        <span class="kn-side-pair"
          ><a href="/feed.xml">RSS Hot</a
          ><span aria-hidden="true">${" "}·${" "}</span
          ><a href="/new.xml" aria-label="RSS New">New</a></span
        >
      </div>
      <div class="kn-side-row">
        <a href="/weekly">Weekly archive</a>
        <a href="https://github.com/attestate/kiwistand" target="_blank"
          >Source code</a
        >
      </div>
      <div class="kn-side-row">
        <a href="/llms.txt">LLMs</a>
        <a
          href="https://github.com/attestate/kiwistand/tree/main/kiwimcp-client"
          target="_blank"
          >MCP client</a
        >
        <a href="${BRAND_ASSETS}" target="_blank">Brand assets</a>
      </div>
    </nav>
    <div class="kn-side-colophon">
      <span class="kn-side-made">Made for the open web.</span>
      <span class="kn-side-made"
        >Hosted by${" "}<a href="https://attestate.com" target="_blank"
          >attestate.com</a
        >${" "}(Kontakt).</span
      >
    </div>
  </div>
`;

// The desktop right column (1101px and up): the newsletter sign-up, the
// iPhone beta and the footer links. A page can opt out of the sign-up
// (`newsletter: false`) or put its own boxes in (`children`, e.g. the story
// page's "More from Hot"). anon-rpc lives only on /settings.
export default function RightColumn({ newsletter = true, children = null } = {}) {
  return html`
    <aside class="right-column kn-right">
      ${newsletter
        ? NewsletterCardElement("sidebar", sidebarCopy)
        : null}
      ${children}
      ${AppBox()}
      ${SideFooter()}
    </aside>
  `;
}
