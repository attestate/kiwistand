import htm from "htm";
import vhtml from "vhtml";
import DOMPurify from "isomorphic-dompurify";

const html = htm.bind(vhtml);

const defaultIconStyle = "width: 16px;";

export function SocialButton(url, icon, text, isImg) {
  url = DOMPurify.sanitize(url);
  return html`<a 
    target="_blank" 
    href="javascript:void(0);"
    onclick="if (window.ReactNativeWebView || window !== window.parent) { window.sdk.actions.openUrl('${url}'); } else { window.open('${url}', '_blank'); }"
  >
    <button
      class="feed-button"
      style="display: flex; align-items: center; gap: 5px;  font-size: 0.9rem; border-radius: 2px; cursor: pointer; padding: 5px 10px; background-color: transparent; border: 1px solid rgba(130, 130, 130, 0.3); color: inherit;"
    >
      ${isImg
        ? html`<img
            src="${icon}"
            style="display: inline; ${defaultIconStyle}"
          />`
        : icon}
      ${text}
    </button></a
  >`;
}

export const heySvg = (iconStyle = defaultIconStyle) => html`
  <svg
    style="${iconStyle}"
    viewBox="0 0 70 44"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M47.124 12.1204C49.87 9.83968 52.9341 8.97192 55.8724 9.19128C59.007 9.42529 61.9076 10.8878 64.0738 13.0121C66.2401 15.1366 67.7283 17.9781 67.9665 21.0448C68.2069 24.1395 67.166 27.3807 64.4216 30.2254C64.1706 30.4872 63.914 30.7458 63.6521 31.0012C51.2045 43.2069 34.6693 43.239 34.5001 43.2391H34.4993C34.4148 43.2391 17.8273 43.2385 5.34725 30.9994L5.34452 30.9968C5.0869 30.7426 4.83315 30.4867 4.58327 30.2293L4.58124 30.2272C1.83554 27.385 0.793639 24.1445 1.03327 21.0499C1.2707 17.9838 2.75792 15.1419 4.92356 13.0166C7.08906 10.8916 9.98939 9.42791 13.1244 9.1929C16.0626 8.97265 19.1272 9.83935 21.8749 12.119C22.1703 8.60293 23.7096 5.86639 25.944 3.98506C28.3272 1.97853 31.4327 1 34.4994 1C37.5661 1 40.6716 1.97853 43.0547 3.98506C45.2895 5.86664 46.8289 8.60366 47.124 12.1204ZM35.0692 42.0016L35.0686 41.986L35.0697 41.986L35.0692 42.0016ZM33.9296 42.0016L33.9291 41.986L33.9302 41.986L33.9296 42.0016ZM43.8512 25.0529C43.5106 25.0529 43.3928 25.5353 43.61 25.7907C43.9946 26.2433 44.226 26.8255 44.226 27.4607C44.226 28.9021 43.0346 30.0705 41.5648 30.0705C40.0951 30.0705 38.9037 28.9021 38.9037 27.4607C38.9037 27.3836 38.8011 27.3453 38.7547 27.4078C38.3349 27.9731 38.0516 28.6077 37.9352 29.2741C37.8696 29.6495 37.5586 29.9602 37.1678 29.9602H36.9519C36.4419 29.9602 36.0211 29.5547 36.0964 29.0633C36.6124 25.6961 39.9966 23.2538 43.8512 23.2538C47.7057 23.2538 51.0899 25.6961 51.6059 29.0633C51.6812 29.5547 51.2604 29.9602 50.7504 29.9602C50.2403 29.9602 49.8364 29.5527 49.7255 29.0677C49.2209 26.8605 46.8821 25.0529 43.8512 25.0529ZM20.2197 27.4607C20.2197 27.359 20.0852 27.3044 20.022 27.3854C19.5733 27.9595 19.2676 28.6097 19.1382 29.295C19.0618 29.6999 18.726 30.0362 18.3035 30.0362H18.1451C17.635 30.0362 17.2142 29.6307 17.2894 29.1393C17.8052 25.7702 21.1897 23.3298 25.0443 23.3298C28.8988 23.3298 32.2833 25.7702 32.7991 29.1393C32.8743 29.6307 32.4535 30.0362 31.9435 30.0362C31.4334 30.0362 31.0295 29.6287 30.9188 29.1437C30.4145 26.9352 28.0757 25.1289 25.0443 25.1289C24.7687 25.1289 24.6679 25.5083 24.8523 25.7077C25.2809 26.1709 25.5421 26.7859 25.5421 27.4607C25.5421 28.9021 24.3506 30.0705 22.8809 30.0705C21.4111 30.0705 20.2197 28.9021 20.2197 27.4607ZM37.4598 33.7544C37.8203 33.4029 38.3774 33.2321 38.8251 33.4702C39.2727 33.7084 39.4425 34.2615 39.1199 34.6463C38.0693 35.8997 36.3683 36.6939 34.4922 36.6939C32.6172 36.6939 30.9125 35.908 29.8604 34.6453C29.539 34.2595 29.7109 33.7069 30.1594 33.4702C30.6079 33.2336 31.1642 33.4066 31.5242 33.7586C32.2176 34.4365 33.2699 34.8948 34.4922 34.8948C35.7114 34.8948 36.7649 34.4319 37.4598 33.7544Z"
      fill="currentColor"
      style="fill:currentColor;fill-opacity:1;"
    />
  </svg>
`;

export const githubSvg = (iconStyle = defaultIconStyle) => html`
  <svg
    style="${iconStyle}"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <path
      d="M119.83,56A52,52,0,0,0,76,32a51.92,51.92,0,0,0-3.49,44.7A49.28,49.28,0,0,0,64,104v8a48,48,0,0,0,48,48h48a48,48,0,0,0,48-48v-8a49.28,49.28,0,0,0-8.51-27.3A51.92,51.92,0,0,0,196,32a52,52,0,0,0-43.83,24Z"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M104,232V192a32,32,0,0,1,32-32h0a32,32,0,0,1,32,32v40"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M104,208H72a32,32,0,0,1-32-32A32,32,0,0,0,8,144"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;

export const telegramSvg = (iconStyle = defaultIconStyle) => html`
  <svg
    style="${iconStyle}"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
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

export const discordSvg = (iconStyle = defaultIconStyle) => html`
  <svg
    style="${iconStyle}"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <circle cx="92" cy="140" r="12" />
    <circle cx="164" cy="140" r="12" />
    <path
      d="M153.44,73.69l5-19.63a8.1,8.1,0,0,1,9.21-6L203.69,54A8.08,8.08,0,0,1,210.23,60l29.53,116.37a8,8,0,0,1-4.55,9.24l-67,29.7a8.15,8.15,0,0,1-11-4.56L147,183.06"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M102.56,73.69l-5-19.63a8.1,8.1,0,0,0-9.21-6L52.31,54A8.08,8.08,0,0,0,45.77,60L16.24,176.35a8,8,0,0,0,4.55,9.24l67,29.7a8.15,8.15,0,0,0,11-4.56L109,183.06"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M80,78.31A178.94,178.94,0,0,1,128,72a178.94,178.94,0,0,1,48,6.31"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M176,177.69A178.94,178.94,0,0,1,128,184a178.94,178.94,0,0,1-48-6.31"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;

export const warpcastSvg = (iconStyle = defaultIconStyle) => html`
  <svg
    style=${iconStyle}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M23.2 21.4286C23.642 21.4286 24 21.7802 24 22.2143V23H16V22.2143C16 21.7802 16.358 21.4286 16.8 21.4286H23.2Z"
      stroke="currentColor"
      fill="none"
    ></path>
    <path
      d="M23.2 21.4286V20.6429C23.2 20.2087 22.842 19.8571 22.4 19.8571H17.6C17.158 19.8571 16.8 20.2087 16.8 20.6429V21.4286H23.2Z"
      stroke="currentColor"
      fill="none"
    ></path>
    <path d="M20 1H4V4.14286H20V1Z" stroke="currentColor" fill="none"></path>
    <path
      d="M23.2 7.28571H0.8L0 4.14286H24L23.2 7.28571Z"
      stroke="currentColor"
      fill="none"
    ></path>
    <path
      d="M22.4 7.28571H17.6L17.6 19.8571H22.4V7.28571Z"
      stroke="currentColor"
      fill="none"
    ></path>
    <path
      d="M7.2 21.4286C7.642 21.4286 8 21.7802 8 22.2143V23H0V22.2143C0 21.7802 0.358 21.4286 0.8 21.4286H7.2Z"
      stroke="currentColor"
      fill="none"
    ></path>
    <path
      d="M7.2 21.4286V20.6429C7.2 20.2087 6.842 19.8571 6.4 19.8571H1.6C1.158 19.8571 0.800001 20.2087 0.800001 20.6429L0.8 21.4286H7.2Z"
      stroke="currentColor"
      fill="none"
    ></path>
    <path
      d="M6.4 7.28571H1.6L1.6 19.8571H6.4L6.4 7.28571Z"
      stroke="currentColor"
      fill="none"
    ></path>
    <path
      d="M6.4 13.5086C6.4 10.471 8.9072 8.00857 12 8.00857C15.0928 8.00857 17.6 10.471 17.6 13.5086L17.6 7.28571H6.4L6.4 13.5086Z"
      stroke="currentColor"
      fill="none"
    ></path>
  </svg>
`;

export const twitterSvg = (iconStyle = defaultIconStyle) => html`
  <svg
    style="${iconStyle}"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <polygon
      points="48 40 96 40 208 216 160 216 48 40"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <line
      x1="113.88"
      y1="143.53"
      x2="48"
      y2="216"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <line
      x1="208"
      y1="40"
      x2="142.12"
      y2="112.47"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;

export const websiteSvg = (iconStyle = defaultIconStyle) => html`
  <svg
    style="${iconStyle}"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
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
      d="M88,128c0,37.46,13.33,70.92,34.28,93.49a7.77,7.77,0,0,0,11.44,0C154.67,198.92,168,165.46,168,128s-13.33-70.92-34.28-93.49a7.77,7.77,0,0,0-11.44,0C101.33,57.08,88,90.54,88,128Z"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <line
      x1="37.46"
      y1="96"
      x2="218.54"
      y2="96"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <line
      x1="37.46"
      y1="160"
      x2="218.54"
      y2="160"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;
