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

const BRAND_ASSETS =
  "https://drive.google.com/drive/folders/1vH5vEcXCsbbrYfCpTIvimLSzDMgq1eIa?usp=sharing";

const TELEGRAM = "https://t.me/+QGAviVT67m00Njc8";

// NOTE: The design's "Side footer" (About · Guidelines · Privacy · API, "Made
// for the open web.") carries the links of the old site footer too, which
// the desktop pages with this column no longer show (news.css hides it from
// 1101px). With that many links they're grouped under small headings in the
// boxes' eyebrow style ("KIWI WEEKLY", "IPHONE BETA"); the grouping is ours,
// the .pen only shows four links. "Docs" was the same page as "About".
const FooterGroup = (title, links) => html`
  <nav class="kn-side-group" aria-label="${title}">
    <span class="kn-eyebrow kn-side-eyebrow">${title}</span>
    <div class="kn-side-links">${links}</div>
  </nav>
`;

export const SideFooter = () => html`
  <div class="kn-side-footer">
    ${FooterGroup(
      "Kiwi News",
      html`<a href="https://kiwistand.github.io/kiwi-docs/" target="_blank"
          >About</a
        >
        <a href="/guidelines">Guidelines</a>
        <a href="/privacy-policy">Privacy</a>
        <a href="/newsletter">Newsletter</a>
        <a href="/weekly">Weekly archive</a>
        <a href="${TELEGRAM}" target="_blank" rel="noopener noreferrer"
          >Telegram</a
        >
        <a href="${BRAND_ASSETS}" target="_blank">Brand assets</a>`,
    )}
    ${FooterGroup(
      "Developers",
      html`<a href="https://attestate.com/kiwistand/main/" target="_blank"
          >API</a
        >
        <a href="/llms.txt">LLMs</a>
        <a href="https://github.com/attestate/kiwistand" target="_blank"
          >Source code</a
        >
        <a
          href="https://github.com/attestate/kiwistand/tree/main/kiwimcp-client"
          target="_blank"
          >MCP client</a
        >
        <a href="/feed.xml">RSS Hot</a>
        <a href="/new.xml">RSS New</a>`,
    )}
    <div class="kn-side-colophon">
      <span class="kn-side-made"
        >Hosted by${" "}<a href="https://attestate.com" target="_blank"
          >attestate.com</a
        >${" "}(Kontakt).</span
      >
      <span class="kn-side-made">Made for the open web.</span>
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
        ? NewsletterCardElement("sidebar", sidebarHeadline, sidebarCopy)
        : null}
      ${children}
      ${AppBox()}
      ${SideFooter()}
    </aside>
  `;
}
