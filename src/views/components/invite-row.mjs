import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);

const copySVG = html`<svg
  style="height: 1rem;"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 256 256"
>
  <rect width="256" height="256" fill="none" />
  <polyline
    points="168 168 216 168 216 40 88 40 88 88"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="16"
  />
  <rect
    x="40"
    y="88"
    width="128"
    height="128"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="16"
  />
</svg>`;

const questionMarkSVG = html`<svg
  style="height: 1rem;"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 256 256"
>
  <rect width="256" height="256" fill="none" />
  <circle cx="128" cy="180" r="12" />
  <path
    d="M128,144v-8c17.67,0,32-12.54,32-28s-14.33-28-32-28S96,92.54,96,108v4"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="16"
  />
  <circle
    cx="128"
    cy="128"
    r="96"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="16"
  />
</svg>`;

function row(reward) {
  return html`
    <tr>
      <td>
        <div
          style="padding: 1rem; display: flex; flex-direction: column; align-items: start
 border-bottom: 1px solid rgba(0,0,0,0.1);"
        >
          <div style="margin-bottom: 0.5rem;">
            <span style="color: black; font-weight: bold; font-size: 14pt;"
              >Invite a friend, earn ${reward} ETH </span
            ><a
              href="/referral"
              class="meta-link"
              style="display: inline-flex; gap: 5px;"
              >Learn more ${questionMarkSVG}</a
            >
          </div>
          <div
            id="invitelink-container"
            style="display: flex; align-items: center; width: 100%;"
          >
            <input
              id="invitelink"
              type="text"
              value="https://news.kiwistand.com/?referral=0xloading..."
              readonly
              style="height: 40px; width: 80%; padding: 10px 15px; border: 1px solid #ccc; border-radius:
 2px; margin-right: 10px;"
            />
            <button style="width: 20%; height: 40px;" id="button-onboarding">
              ${copySVG}
            </button>
          </div>
        </div>
      </td>
    </tr>
  `;
}

export default row;
