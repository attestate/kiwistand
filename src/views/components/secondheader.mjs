import { env } from "process";
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);

const style = "width: 1rem; position: relative; top: 0.15rem;";

export const broadcastSVG = html`
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

const secondheader = (theme, site, period) => html`
  <td>
    <div
      style="background-color: #e6e6df; min-height: 40px; display: flex; justify-content: space-between; align-items: center; padding: 10px 15px 10px 15px; color: white;"
    >
      <div>
        ${site === "top" || site === "new" || site === "best"
          ? html` <a href="/">
              <button
                onclick="${animation}"
                class="feed-button"
                style=${`font-size: 1.01rem; border-radius: 2px; cursor: pointer; padding: 5px 15px; background-color: transparent; border: 1px solid ${
                  site === "top" ? "black" : "#828282"
                }; color: ${site === "top" ? "black" : "#828282"};`}
              >
                <span>${fireSVG} Hot</span>
              </button>
            </a>`
          : ""}
        ${site === "top" || site === "new" || site === "best" || site === "nfts"
          ? html` <a
              href="${site === "new" || site === "top" || site === "best"
                ? "/new"
                : "/nfts"}"
            >
              <button
                onclick="${animation}"
                class="feed-button"
                style=${`position: relative; font-size: 1.01rem; margin-left: 10px; cursor: pointer; border-radius: 2px; padding: 5px 15px; background-color: transparent; border: 1px solid ${
                  site === "new" || site === "nfts" ? "black" : "#828282"
                }; color: ${
                  site === "new" || site === "nfts" ? "black" : "#828282"
                };`}
              >
                <span
                  id="new-dot"
                  style="display: none; position: absolute; top: -5px; right: -5px; width: 8px; height: 8px; border-radius: 2px; background-color: #228B22;"
                ></span>
                <span> ${broadcastSVG} New</span>
              </button>
            </a>`
          : ""}
        ${site === "top" || site === "new" || site === "best"
          ? html` <a href="/best">
              <button
                onclick="${animation}"
                class="feed-button"
                style=${`font-size: 1.01rem; margin-left: 10px; cursor: pointer; border-radius: 2px; padding: 5px 15px; background-color: transparent; border: 1px solid ${
                  site === "best" ? "black" : "#828282"
                }; color: ${site === "best" ? "black" : "#828282"};`}
              >
                <span> ${trophySVG} Top</span>
              </button>
            </a>`
          : ""}
        <a class="nav-refresh-button"></a>
      </div>
      <nav-learn-more />
    </div>

    ${site === "best"
      ? html` <div
          style="background-color: #e6e6df; min-height: 40px; display: flex; justify-content: space-between; align-items: center; padding: 0 15px 10px 15px; color: white;"
        >
          <div>
            <a href="/best?period=all">
              <button style="${periodIconStyle(theme, period, "all")}">
                <span>All</span>
              </button>
            </a>
            <a href="/best?period=month">
              <button style="${periodIconStyle(theme, period, "month")}">
                <span>Month</span>
              </button>
            </a>
            <a href="/best?period=week">
              <button style="${periodIconStyle(theme, period, "week")}">
                <span>Week</span>
              </button>
            </a>
            <a href="/best?period=day">
              <button style="${periodIconStyle(theme, period, "day")}">
                <span>Day</span>
              </button>
            </a>
          </div>
        </div>`
      : null}
  </td>
`;

export default secondheader;
