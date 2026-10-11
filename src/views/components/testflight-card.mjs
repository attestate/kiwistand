//@format
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);

// NOTE: "Kiwi News for iPhone" card at the top of the feeds, linking to the
// TestFlight beta. Shown only to iPhone Safari visitors: theme-init.js sets
// <html data-tf-card> before first paint and news.css shows the row on
// phones, never inside the iOS app. main.jsx remembers taps and dismissals.
export default function TestFlightCard() {
  return html`
    <tr class="tf-card-row">
      <td>
        <div class="tf-card" role="region" aria-label="Kiwi News for iPhone">
          <img
            class="tf-card-icon"
            src="/kiwi-icon-email-transparent.png"
            alt=""
            width="44"
            height="44"
          />
          <div class="tf-card-body">
            <div class="tf-card-title">Kiwi News for iPhone</div>
            <div class="tf-card-copy">
              The native app: faster feed, notifications, share from any app.
              Free beta.
            </div>
            <a
              class="tf-card-get"
              data-no-instant
              href="https://testflight.apple.com/join/6jyvYECH"
              target="_blank"
              rel="noopener"
              >Get the beta</a
            >
          </div>
          <button class="tf-card-close" type="button" aria-label="Dismiss">
            ×
          </button>
        </div>
      </td>
    </tr>
  `;
}
