import { env } from "process";
import htm from "htm";
import vhtml from "vhtml";
import DOMPurify from "isomorphic-dompurify";

const html = htm.bind(vhtml);

const style = "width: 1rem; position: relative; top: 0.15rem;";

export const broadcastFullSVG = html`<svg
  style="${style}"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 256 256"
>
  <rect width="256" height="256" fill="none" />
  <path
    d="M168,128a40,40,0,1,1-40-40A40,40,0,0,1,168,128Zm40,0a79.74,79.74,0,0,0-20.37-53.33,8,8,0,1,0-11.92,10.67,64,64,0,0,1,0,85.33,8,8,0,0,0,11.92,10.67A79.79,79.79,0,0,0,208,128ZM80.29,85.34A8,8,0,1,0,68.37,74.67a79.94,79.94,0,0,0,0,106.67,8,8,0,0,0,11.92-10.67,63.95,63.95,0,0,1,0-85.33Zm158.28-4A119.48,119.48,0,0,0,213.71,44a8,8,0,1,0-11.42,11.2,103.9,103.9,0,0,1,0,145.56A8,8,0,1,0,213.71,212,120.12,120.12,0,0,0,238.57,81.29ZM32.17,168.48A103.9,103.9,0,0,1,53.71,55.22,8,8,0,1,0,42.29,44a119.87,119.87,0,0,0,0,168,8,8,0,1,0,11.42-11.2A103.61,103.61,0,0,1,32.17,168.48Z"
  />
</svg>`;

export const broadcastSVG = (style) => html`
  <svg
    style="${style}"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <circle
      cx="128"
      cy="128"
      r="32"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M181.67,80a71.94,71.94,0,0,1,0,96"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M74.33,176a71.94,71.94,0,0,1,0-96"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M208,49.62a111.88,111.88,0,0,1,0,156.76"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M48,206.38A111.88,111.88,0,0,1,48,49.62"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;

export const trophyFullSVG = html`<svg
  style="${style}"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 256 256"
>
  <rect width="256" height="256" fill="none" />
  <path
    d="M232,64H208V48a8,8,0,0,0-8-8H56a8,8,0,0,0-8,8V64H24A16,16,0,0,0,8,80V96a40,40,0,0,0,40,40h3.65A80.13,80.13,0,0,0,120,191.61V216H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16H136V191.58c31.94-3.23,58.44-25.64,68.08-55.58H208a40,40,0,0,0,40-40V80A16,16,0,0,0,232,64ZM48,120A24,24,0,0,1,24,96V80H48v32q0,4,.39,8ZM232,96a24,24,0,0,1-24,24h-.5a81.81,81.81,0,0,0,.5-8.9V80h24Z"
  />
</svg>`;

export const trophySVG = html`
  <svg
    style="${style}"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <line
      x1="96"
      y1="224"
      x2="160"
      y2="224"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <line
      x1="128"
      y1="184"
      x2="128"
      y2="224"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M58,128H48A32,32,0,0,1,16,96V80a8,8,0,0,1,8-8H56"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M198,128h10a32,32,0,0,0,32-32V80a8,8,0,0,0-8-8H200"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M64,48H192a8,8,0,0,1,8,8v55.1c0,39.7-31.75,72.6-71.45,72.9A72,72,0,0,1,56,112V56A8,8,0,0,1,64,48Z"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;

export const fireFullSVG = html`<svg
  style="${style}"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 256 256"
>
  <rect width="256" height="256" fill="none" />
  <path
    d="M143.38,17.85a8,8,0,0,0-12.63,3.41l-22,60.41L84.59,58.26a8,8,0,0,0-11.93.89C51,87.53,40,116.08,40,144a88,88,0,0,0,176,0C216,84.55,165.21,36,143.38,17.85Zm40.51,135.49a57.6,57.6,0,0,1-46.56,46.55A7.65,7.65,0,0,1,136,200a8,8,0,0,1-1.32-15.89c16.57-2.79,30.63-16.85,33.44-33.45a8,8,0,0,1,15.78,2.68Z"
  />
</svg>`;

export const fireSVG = html`
  <svg
    style="${style}"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <path
      d="M136,192c20-3.37,36.61-20,40-40"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M112,96l26.27-72C159.86,41.92,208,88.15,208,144a80,80,0,0,1-160,0c0-30.57,14.42-58.26,31-80Z"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;

const periodIconStyle = (theme, period, category) =>
  `${period === category ? "black" : "#828282"}; color: ${
    period === category ? "black" : "#828282"
  }; font-weight: bold; border: none; text-decoration: underline; font-size: 1.01rem; border-radius: 2px; cursor: pointer; padding: 5px 15px; background-color: transparent;;`;

const animation = `
  var initialWidth = this.offsetWidth;
  this.style.width = initialWidth + 'px';
  var dots = ['\u25CF', '\u25CB'];
  var i = 0;
  var animate = function() { dots.unshift(dots.pop()); this.textContent = dots.join(' '); i++
  if (i > 5) clearInterval(intervalId); }.bind(this);
  animate();
  var intervalId = setInterval(animate, 500);
 `;

const secondheader = (theme, site, period, domain) => {
  period = DOMPurify.sanitize(period);
  domain = DOMPurify.sanitize(domain);
  return html`
    <td>
      <div
        class="second-header"
        style="background-color: var(--table-bg); min-height: 40px; display: flex; justify-content: space-between; align-items: center; padding: 10px 15px 10px 15px; color: white;"
      >
        <div style="display: flex;">
          ${site === "top" || site === "new" || site === "best"
            ? html` <a class="feed-button-link" href="/">
                <button
                  onclick="${animation}"
                  class="feed-button"
                  style=${`font-variant: small-caps; font-size: 1.01rem; border: none; outline: none; border-radius: 2px; cursor: pointer; padding: 6px 15px; background-color: rgba(0,0,0,${
                    site === "top" ? "0.2" : "0.1"
                  }); color: black;`}
                >
                  <span
                    style="font-weight: ${site === "top" ? "bold" : "normal"};"
                  >
                    ${site === "top" ? fireFullSVG : fireSVG} Hot</span
                  >
                </button>
              </a>`
            : ""}
          ${site === "top" || site === "new" || site === "best"
            ? html` <a class="feed-button-link" href="/new?cached=true">
                <button
                  onclick="${animation}"
                  class="feed-button"
                  style=${`font-variant: small-caps; margin-left: 10px; font-size: 1.01rem; border: none; outline: none; border-radius: 2px; cursor: pointer; padding: 6px 15px; background-color: rgba(0,0,0,${
                    site === "new" ? "0.2" : "0.1"
                  }); color: black; position:relative;`}
                >
                  <span
                    id="new-dot"
                    style="display: none; position: absolute; top: -5px; right: -5px; width: 8px; height: 8px; border-radius: 2px; background-color: #228B22;"
                  ></span>
                  <span
                    style="font-weight: ${site === "new" ? "bold" : "normal"};"
                  >
                    ${site === "new" ? broadcastFullSVG : broadcastSVG(style)}
                    <span> New </span>
                  </span>
                </button>
              </a>`
            : ""}
          ${site === "top" || site === "new" || site === "best"
            ? html` <a class="feed-button-link" href="/best">
                <button
                  onclick="${animation}"
                  class="feed-button"
                  style=${`font-variant: small-caps; margin-left: 10px; font-size: 1.01rem; border: none; outline: none; border-radius: 2px; cursor: pointer; padding: 6px 15px; background-color: rgba(0,0,0,${
                    site === "best" ? "0.2" : "0.1"
                  }); color: black;`}
                >
                  <span
                    style="font-weight: ${site === "best" ? "bold" : "normal"};"
                  >
                    ${site === "best" ? trophyFullSVG : trophySVG} Top</span
                  >
                </button>
              </a>`
            : ""}
        </div>
      </div>

      ${site === "best"
        ? html` <div
            class="second-header"
            style="background-color: #e6e6df; min-height: 40px; display: flex; justify-content: space-between; align-items: center; padding: 0 15px 10px 15px; color: white;"
          >
            <div>
              <a href="/best?period=all${domain ? `&domain=${domain}` : ""}">
                <button style="${periodIconStyle(theme, period, "all")}">
                  <span>All</span>
                </button>
              </a>
              <a href="/best?period=year${domain ? `&domain=${domain}` : ""}">
                <button style="${periodIconStyle(theme, period, "year")}">
                  <span>Year</span>
                </button>
              </a>
              <a href="/best?period=month${domain ? `&domain=${domain}` : ""}">
                <button style="${periodIconStyle(theme, period, "month")}">
                  <span>Month</span>
                </button>
              </a>
              <a href="/best?period=week${domain ? `&domain=${domain}` : ""}">
                <button style="${periodIconStyle(theme, period, "week")}">
                  <span>Week</span>
                </button>
              </a>
              <a href="/best?period=day${domain ? `&domain=${domain}` : ""}">
                <button style="${periodIconStyle(theme, period, "day")}">
                  <span>Day</span>
                </button>
              </a>
            </div>
            ${domain
              ? html`<a
                  style="text-decoration:underline;"
                  href="/best?period=${period}"
                  >Clear filter</a
                >`
              : null}
          </div>`
        : null}
    </td>
  `;
};

export default secondheader;
