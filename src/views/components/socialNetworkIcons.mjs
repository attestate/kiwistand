import htm from "htm";
import vhtml from "vhtml";
import DOMPurify from "isomorphic-dompurify";

const html = htm.bind(vhtml);

const defaultIconStyle = "width: 16px;";

export function SocialButton(url, icon, text, isImg) {
  url = DOMPurify.sanitize(url);
  return html`<a target="_blank" href="${url}">
    <button
      class="feed-button"
      style="display: flex; align-items: center; gap: 5px;  font-size: 0.9rem; border-radius: 2px; cursor: pointer; padding: 5px 10px; background-color: transparent; border: 1px solid #828282; color: #828282;"
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

export const orbSvg = (iconStyle = defaultIconStyle) => html`
  <svg
    style="${iconStyle}"
    viewBox="0 0 42 42"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="9.11102"
      cy="9.11102"
      r="9.11102"
      transform="matrix(0.707107 0.707106 -0.707107 0.707106 31.0586 -1.83203)"
      fill="currentColor"
    />
    <rect
      width="15.6231"
      height="15.6231"
      rx="4.04934"
      transform="matrix(0.707107 0.707106 -0.707107 0.707106 10.2031 20.4395)"
      fill="currentColor"
    />
    <path
      d="M10.0355 1.78422C10.1471 1.64314 10.3611 1.64314 10.4727 1.78422L12.1801 3.94354C12.2534 4.03626 12.3773 4.07263 12.4891 4.03426L15.0929 3.14084C15.263 3.08246 15.443 3.19817 15.4606 3.37717L15.7296 6.1168C15.7411 6.23445 15.8256 6.332 15.9405 6.36018L18.6139 7.0163C18.7886 7.05916 18.8775 7.25384 18.7955 7.41392L17.5406 9.86406C17.4867 9.96928 17.5051 10.097 17.5865 10.1828L19.4808 12.1802C19.6046 12.3107 19.5741 12.5225 19.4186 12.6128L17.0383 13.9956C16.936 14.055 16.8824 14.1724 16.9045 14.2885L17.4183 16.993C17.4518 17.1697 17.3117 17.3314 17.132 17.3233L14.382 17.1997C14.2639 17.1943 14.1553 17.2641 14.1111 17.3738L13.0811 19.9266C13.0138 20.0934 12.8085 20.1537 12.6617 20.0498L10.4151 18.459C10.3186 18.3907 10.1895 18.3907 10.0931 18.459L7.84645 20.0498C7.69966 20.1537 7.49432 20.0934 7.42703 19.9266L6.39711 17.3738C6.35289 17.2641 6.24429 17.1943 6.1262 17.1997L3.37617 17.3233C3.19649 17.3314 3.05634 17.1697 3.08991 16.993L3.60368 14.2885C3.62575 14.1724 3.57212 14.055 3.4699 13.9956L1.08957 12.6128C0.93405 12.5225 0.903593 12.3107 1.02736 12.1802L2.92171 10.1828C3.00306 10.097 3.02143 9.96928 2.96754 9.86406L1.71265 7.41392C1.63066 7.25384 1.71956 7.05916 1.89424 7.0163L4.56771 6.36018C4.68252 6.332 4.76706 6.23445 4.77861 6.1168L5.04757 3.37717C5.06514 3.19817 5.24518 3.08246 5.41531 3.14084L8.0191 4.03426C8.13092 4.07263 8.25477 4.03626 8.3281 3.94354L10.0355 1.78422Z"
      fill="currentColor"
    />
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M27.972 22.4182C27.6434 22.4182 27.3282 22.5487 27.0959 22.7811L22.3675 27.5095C22.1351 27.7418 22.0046 28.057 22.0046 28.3856V34.7628C22.0046 35.0914 22.1351 35.4066 22.3675 35.639L26.9206 40.1921C27.153 40.4245 27.4682 40.555 27.7968 40.555L34.174 40.555C34.5026 40.555 34.8178 40.4245 35.0502 40.1921L39.7785 35.4637C40.0109 35.2314 40.1414 34.9162 40.1414 34.5876V28.2104C40.1414 27.8818 40.0109 27.5666 39.7785 27.3342L35.2254 22.7811C34.993 22.5487 34.6778 22.4182 34.3492 22.4182L27.972 22.4182ZM30.5195 28.7231C30.1908 28.7231 29.8756 28.8536 29.6432 29.086L28.6939 30.0353C28.4615 30.2677 28.331 30.5829 28.331 30.9116L28.3311 32.1593C28.3312 32.4878 28.4617 32.803 28.6941 33.0353L29.59 33.9313C29.8224 34.1636 30.1375 34.2942 30.4661 34.2942L31.7138 34.2943C32.0424 34.2944 32.3577 34.1638 32.5901 33.9314L33.5393 32.9822C33.7717 32.7498 33.9023 32.4345 33.9022 32.1059L33.9021 30.8582C33.9021 30.5296 33.7715 30.2145 33.5392 29.9821L32.6432 29.0862C32.4109 28.8538 32.0958 28.7233 31.7672 28.7232L30.5195 28.7231Z"
      fill="currentColor"
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
