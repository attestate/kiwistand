import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);

const defaultIconStyle = "color: black; width: 32px;";

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
    <path
      d="M88,176S32.85,144,40.78,56c0,0,39.66,40,87.22,48V88c0-22,18-40.27,40-40a40.74,40.74,0,0,1,36.67,24H240l-32,32c-4.26,66.84-60.08,120-128,120-32,0-40-12-40-12S72,200,88,176Z"
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
