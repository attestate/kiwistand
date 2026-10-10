//@format
import htm from "htm";
import vhtml from "vhtml";

import { NewsletterCardElement } from "./newsletter-card.mjs";

const html = htm.bind(vhtml);

// The newsletter sign-up sits below the QR code on every page with a right
// column (desktop only), except where a page opts out.
export default function RightColumn({ newsletter = true } = {}) {
  return html`
    <div class="right-column" style="width:280px;flex-shrink:0;">
      <div id="testflight-qr-container">
        <div
          style="background-color:var(--bg-white);border-radius:2px;border:var(--border);padding:16px;"
        >
          <div
            style="display:flex;flex-direction:column;align-items:center;gap:12px;"
          >
            <span
              style="font-size:14px;font-weight:500;color:var(--text-primary);"
              >New: native iOS app</span>
            <img
              src="/testflight-qr.png"
              alt="TestFlight QR Code"
              width="150"
              height="150"
              style="border-radius:4px;"
            />
            <p
              style="font-size:12px;color:var(--text-tertiary);text-align:center;margin:0;line-height:1.4;"
            >
              Rebuilt from scratch. Scan with<br />your iPhone to try it on TestFlight
            </p>
          </div>
        </div>
      </div>
      ${newsletter ? NewsletterCardElement("sidebar") : null}
    </div>
  `;
}
