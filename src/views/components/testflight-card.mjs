//@format
import htm from "htm";
import vhtml from "vhtml";

import { ms } from "./icons.mjs";

const html = htm.bind(vhtml);

const TESTFLIGHT = "https://testflight.apple.com/join/6jyvYECH";

// NOTE: "Kiwi News for iPhone" card at the top of the feeds, linking to the
// TestFlight beta. Shown only to iPhone Safari visitors: theme-init.js sets
// <html data-tf-card> before first paint and news.css shows the row on
// phones, never inside the iOS app. main.jsx remembers taps and dismissals.
// There is no mobile frame: it is the desktop right column's "iOS app box"
// (kiwi-news.pen, "Web 2 · Desktop · Home · Hot") without the QR code, which
// is no use on the phone itself.
export default function TestFlightCard() {
  return html`
    <tr class="tf-card-row">
      <td>
        <div class="kn-tf-card" role="region" aria-label="Kiwi News for iPhone">
          <div class="kn-tf-text">
            <span class="kn-eyebrow">iPhone beta</span>
            <span class="kn-app-title">Kiwi News for iPhone</span>
            <a
              class="kn-app-link kn-tf-get"
              data-no-instant
              href="${TESTFLIGHT}"
              target="_blank"
              rel="noopener"
              >Open TestFlight ${ms("arrow-up-right", 13)}</a
            >
          </div>
          <button class="kn-tf-close" type="button" aria-label="Dismiss">
            ${ms("x", 18)}
          </button>
        </div>
      </td>
    </tr>
  `;
}
