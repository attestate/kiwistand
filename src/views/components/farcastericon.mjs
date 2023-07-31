import htm from "htm";
import vhtml from "vhtml";
const html = htm.bind(vhtml);
const fcicon = (style) => html` <svg
  style=${style}
  viewBox="0 0 24 24"
  fill="none"
>
  <path
    d="M23.2 21.4286C23.642 21.4286 24 21.7802 24 22.2143V23H16V22.2143C16 21.7802 16.358 21.4286 16.8 21.4286H23.2Z"
    fill="currentColor"
  ></path>
  <path
    d="M23.2 21.4286V20.6429C23.2 20.2087 22.842 19.8571 22.4 19.8571H17.6C17.158 19.8571 16.8 20.2087 16.8 20.6429V21.4286H23.2Z"
    fill="currentColor"
  ></path>
  <path d="M20 1H4V4.14286H20V1Z" fill="currentColor"></path>
  <path
    d="M23.2 7.28571H0.8L0 4.14286H24L23.2 7.28571Z"
    fill="currentColor"
  ></path>
  <path
    d="M22.4 7.28571H17.6L17.6 19.8571H22.4V7.28571Z"
    fill="currentColor"
  ></path>
  <path
    d="M7.2 21.4286C7.642 21.4286 8 21.7802 8 22.2143V23H0V22.2143C0 21.7802 0.358 21.4286 0.8 21.4286H7.2Z"
    fill="currentColor"
  ></path>
  <path
    d="M7.2 21.4286V20.6429C7.2 20.2087 6.842 19.8571 6.4 19.8571H1.6C1.158 19.8571 0.800001 20.2087 0.800001 20.6429L0.8 21.4286H7.2Z"
    fill="currentColor"
  ></path>
  <path
    d="M6.4 7.28571H1.6L1.6 19.8571H6.4L6.4 7.28571Z"
    fill="currentColor"
  ></path>
  <path
    d="M6.4 13.5086C6.4 10.471 8.9072 8.00857 12 8.00857C15.0928 8.00857 17.6 10.471 17.6 13.5086L17.6 7.28571H6.4L6.4 13.5086Z"
    fill="currentColor"
  ></path>
</svg>`;
export default fcicon;
