export const ChatsSVG = ({
  style = { color: "rgba(0,0,0,0.65)", width: "25px" },
}) => (
  <svg style={style} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="none" />
    <path
      d="M71.58,144,32,176V48a8,8,0,0,1,8-8H168a8,8,0,0,1,8,8v88a8,8,0,0,1-8,8Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
    <path
      d="M80,144v40a8,8,0,0,0,8,8h96.42L224,224V96a8,8,0,0,0-8-8H176"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
  </svg>
);

export const EthereumSVG = (props) => (
  <svg
    style={props.style}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <line
      x1="128"
      y1="16"
      x2="128"
      y2="240"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
    <polyline
      points="216 128 128 168 40 128"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
    <polygon
      points="128 16 216 128 128 240 40 128 128 16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
  </svg>
);
export const CheckmarkSVG = (props) => (
  <svg
    style={props.style}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <polyline
      points="88 136 112 160 168 104"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <rect
      x="40"
      y="40"
      width="176"
      height="176"
      rx="8"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
  </svg>
);

export const PasskeysSVG = (props) => (
  <svg
    style={props.style}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M7 3H5C3.89543 3 3 3.89543 3 5V7"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M17 3H19C20.1046 3 21 3.89543 21 5V7"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16 8L16 10"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 8L8 10"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 16C9 16 10 17 12 17C14 17 15 16 15 16"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 8L12 13L11 13"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7 21H5C3.89543 21 3 20.1046 3 19V17"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M17 21H19C20.1046 21 21 20.1046 21 19V17"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
