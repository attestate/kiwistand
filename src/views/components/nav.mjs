import htm from "htm";
import vhtml from "vhtml";

import { home, homefull } from "./sidebar.mjs";
import { broadcastSVG as newest } from "./secondheader.mjs";

const html = htm.bind(vhtml);

const submitfull = html`<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 256 256"
>
  <rect width="256" height="256" fill="none" />
  <path
    d="M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM51.31,160l90.35-90.35,16.68,16.69L68,176.68ZM48,179.31,76.69,208H48Zm48,25.38L79.31,188l90.35-90.35h0l16.68,16.69Z"
  />
</svg>`;

const submit = html`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="none" />
    <path
      d="M92.69,216H48a8,8,0,0,1-8-8V163.31a8,8,0,0,1,2.34-5.65L165.66,34.34a8,8,0,0,1,11.31,0L221.66,79a8,8,0,0,1,0,11.31L98.34,213.66A8,8,0,0,1,92.69,216Z"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <line
      x1="136"
      y1="64"
      x2="192"
      y2="120"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <line
      x1="164"
      y1="92"
      x2="68"
      y2="188"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <line
      x1="95.49"
      y1="215.49"
      x2="40.51"
      y2="160.51"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;

const newestfull = html`<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 256 256"
>
  <rect width="256" height="256" fill="none" />
  <path
    d="M168,128a40,40,0,1,1-40-40A40,40,0,0,1,168,128Zm40,0a79.74,79.74,0,0,0-20.37-53.33,8,8,0,1,0-11.92,10.67,64,64,0,0,1,0,85.33,8,8,0,0,0,11.92,10.67A79.79,79.79,0,0,0,208,128ZM80.29,85.34A8,8,0,1,0,68.37,74.67a79.94,79.94,0,0,0,0,106.67,8,8,0,0,0,11.92-10.67,63.95,63.95,0,0,1,0-85.33Zm158.28-4A119.48,119.48,0,0,0,213.71,44a8,8,0,1,0-11.42,11.2,103.9,103.9,0,0,1,0,145.56A8,8,0,1,0,213.71,212,120.12,120.12,0,0,0,238.57,81.29ZM32.17,168.48A103.9,103.9,0,0,1,53.71,55.22,8,8,0,1,0,42.29,44a119.87,119.87,0,0,0,0,168,8,8,0,1,0,11.42-11.2A103.61,103.61,0,0,1,32.17,168.48Z"
  />
</svg>`;

const notifications = html`<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 256 256"
>
  <rect width="256" height="256" fill="none" />
  <path
    d="M96,192a32,32,0,0,0,64,0"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="16"
  />
  <path
    d="M56,104a72,72,0,0,1,144,0c0,35.82,8.3,64.6,14.9,76A8,8,0,0,1,208,192H48a8,8,0,0,1-6.88-12C47.71,168.6,56,139.81,56,104Z"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="16"
  />
</svg>`;

const notificationsfull = html`<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 256 256"
>
  <rect width="256" height="256" fill="none" />
  <path
    d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216Z"
  />
</svg>`;

const nav = (path) => html`
  <div
    class="bottom-nav"
    style="border-top: 1px solid rgba(0,0,0,0.1); display: flex; justify-content: space-around; position: fixed; bottom
 0; bottom: 0px; width: 100%; background-color: #e6e6df; box-shadow: 0 -2px 5px rgba(0,0,0,0.1);"
  >
    <a
      data-icon="home"
      href="/"
      style="flex-direction: column; display: flex; justify-content: center; align-items: center; padding: 10px 0; flex-grow: 1;
 text-decoration: none; color: black; height: 30px;"
    >
      ${path === "/" ? homefull : home}
    </a>
    <a
      data-icon="newest"
      href="/new"
      style="flex-direction: column; display: flex; justify-content: center; align-items: center; padding: 10px 0; flex-grow: 1;
 text-decoration: none; color: black; height: 30px;"
    >
      ${path === "/new" ? newestfull : newest()}
    </a>
    <a
      data-icon="submit"
      href="/submit"
      style="flex-direction: column; display: flex; justify-content: center; align-items: center; padding: 10px 0; flex-grow: 1;
 text-decoration: none; color: black; height: 30px;"
    >
      ${path === "/submit" ? submitfull : submit}
    </a>
    <div
      class="mobile-bell-container"
      style="flex-direction: column; display: flex; justify-content: center; align-items: center; flex-grow: 1;
 text-decoration: none; color: black;"
    >
      <a class="mobile-bell" href="">
        ${path === "/activity" ? notificationsfull : notifications}
      </a>
    </div>
  </div>
`;

export default nav;
