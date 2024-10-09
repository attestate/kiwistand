import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);

import farcastericon from "./farcastericon.mjs";
import theme from "../../theme.mjs";

function row() {
  return html`
    <tr>
      <td>
        <div
          style="padding: 0.5rem 1rem 0.5rem 1rem; display: flex; flex-direction: column; align-items: start;"
        >
          <div style="margin-bottom: 0.5rem;">
            <span style="color: black; font-weight: bold; font-size: 14pt;"
              >Donate to Kiwi News
            </span>
            <p>
              Kiwi News is currently underfunded. Please consider subscribing,
              it's <b>25 USDC/month for 3 months.</b>
            </p>
          </div>
          <div class="donation-button">
            <button style="width: auto; height: 40px;" id="button-onboarding">
              Support
            </button>
          </div>
        </div>
      </td>
    </tr>
  `;
}

export default row;
