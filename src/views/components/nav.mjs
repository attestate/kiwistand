import htm from "htm";
import vhtml from "vhtml";

import { home, homefull } from "./sidebar.mjs";
import { broadcastSVG as newest } from "./secondheader.mjs";
import { ChatsSVG as comments } from "./row.mjs";

const html = htm.bind(vhtml);

const newestfull = html`<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 256 256"
>
  <rect width="256" height="256" fill="none" />
  <path
    d="M168,128a40,40,0,1,1-40-40A40,40,0,0,1,168,128Zm40,0a79.74,79.74,0,0,0-20.37-53.33,8,8,0,1,0-11.92,10.67,64,64,0,0,1,0,85.33,8,8,0,0,0,11.92,10.67A79.79,79.79,0,0,0,208,128ZM80.29,85.34A8,8,0,1,0,68.37,74.67a79.94,79.94,0,0,0,0,106.67,8,8,0,0,0,11.92-10.67,63.95,63.95,0,0,1,0-85.33Zm158.28-4A119.48,119.48,0,0,0,213.71,44a8,8,0,1,0-11.42,11.2,103.9,103.9,0,0,1,0,145.56A8,8,0,1,0,213.71,212,120.12,120.12,0,0,0,238.57,81.29ZM32.17,168.48A103.9,103.9,0,0,1,53.71,55.22,8,8,0,1,0,42.29,44a119.87,119.87,0,0,0,0,168,8,8,0,1,0,11.42-11.2A103.61,103.61,0,0,1,32.17,168.48Z"
  />
</svg>`;

const commentsfull = html`<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 256 256"
>
  <rect width="256" height="256" fill="none" />
  <path
    d="M232,96a16,16,0,0,0-16-16H184V48a16,16,0,0,0-16-16H40A16,16,0,0,0,24,48V176a8,8,0,0,0,13,6.22L72,154V184a16,16,0,0,0,16,16h93.59L219,230.22a8,8,0,0,0,5,1.78,8,8,0,0,0,8-8Zm-42.55,89.78a8,8,0,0,0-5-1.78H88V152h80a16,16,0,0,0,16-16V96h32V207.25Z"
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
      data-icon="comments"
      href="/comments"
      style="flex-direction: column; display: flex; justify-content: center; align-items: center; padding: 10px 0; flex-grow: 1;
 text-decoration: none; color: black; height: 30px;"
    >
      ${path === "/comments" ? commentsfull : comments("")}
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
