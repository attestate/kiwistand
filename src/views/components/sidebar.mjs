//@format
import { env } from "process";
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);
const community = html`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="none" />
    <path
      d="M192,120a59.91,59.91,0,0,1,48,24"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M16,144a59.91,59.91,0,0,1,48-24"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <circle
      cx="128"
      cy="144"
      r="40"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M72,216a65,65,0,0,1,112,0"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M161,80a32,32,0,1,1,31,40"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M64,120A32,32,0,1,1,95,80"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;
const about = html`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="none" />
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
    <path
      d="M120,120a8,8,0,0,1,8,8v40a8,8,0,0,0,8,8"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <circle cx="124" cy="84" r="12" />
  </svg>
`;

const newsletter = html`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="none" />
    <path
      d="M32,56H224a0,0,0,0,1,0,0V192a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V56A0,0,0,0,1,32,56Z"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <polyline
      points="224 56 128 144 32 56"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;

const productUpdates = html`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="none" />
    <path
      d="M88,134.87,178.26,214a8,8,0,0,0,13.09-4.21L232,33.22a1,1,0,0,0-1.34-1.15L28,111.38A6.23,6.23,0,0,0,29,123.3Z"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <line
      x1="88"
      y1="134.87"
      x2="231.41"
      y2="32.09"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M132.37,173.78l-30.61,31.76A8,8,0,0,1,88,200V134.87"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;

const home = html`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="none" />
    <path
      d="M152,208V160a8,8,0,0,0-8-8H112a8,8,0,0,0-8,8v48a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V115.54a8,8,0,0,1,2.62-5.92l80-75.54a8,8,0,0,1,10.77,0l80,75.54a8,8,0,0,1,2.62,5.92V208a8,8,0,0,1-8,8H160A8,8,0,0,1,152,208Z"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;
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
const sidebar = html`
  <div class="sidebar" id="mySidebar" style="color: black;">
    <a class="kiwi-logo" href="/">🥝</a>
    <a href="/" style="color: black; text-decoration: none; display: block;">
      <div style="display: flex; align-items: center;">
        <div class="svg-container">${home}</div>
        <span>Home</span>
      </div>
    </a>
    <a href="/submit" style="color: black; text-decoration: none;">
      <div style="display: flex; align-items: center;">
        <div class="svg-container">${submit}</div>
      </div>
    </a>
    <a
      href="/community"
      style="color: black; text-decoration: none; display: block;"
    >
      <div style="display: flex; align-items: center;">
        <div class="svg-container">${community}</div>
        <span>Community</span>
      </div>
    </a>
    <div id="nav-profile"><a></a></div>
    <div id="nav-settings"><a></a></div>
    <div id="nav-disconnect"><a></a></div>
  </div>
  <div id="overlay"></div>
`;
export default sidebar;
