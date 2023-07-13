//@format
import { env } from "process";
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);
const footer = (theme, path) => html`
  ${["/", "/new", "/community"].includes(path)
    ? html`
        <div style="position: fixed; bottom: 20px; right: 20px; z-index: 5;">
          <a
            href="/submit"
            style="display: flex; align-items: center; justify-content: center; height: 50px; width: 50px; background-color: ${theme.color}; border-radius: 2px; box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);"
          >
            <svg
              style="width: 24px; height: 24px;"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M19.186 2.09c.521.25 1.136.612 1.625 1.101.49.49.852 1.104 1.1 1.625.313.654.11 1.408-.401 1.92l-7.214 7.213c-.31.31-.688.541-1.105.675l-4.222 1.353a.75.75 0 0 1-.943-.944l1.353-4.221a2.75 2.75 0 0 1 .674-1.105l7.214-7.214c.512-.512 1.266-.714 1.92-.402zm.211 2.516a3.608 3.608 0 0 0-.828-.586l-6.994 6.994a1.002 1.002 0 0 0-.178.241L9.9 14.102l2.846-1.496c.09-.047.171-.107.242-.178l6.994-6.994a3.61 3.61 0 0 0-.586-.828zM4.999 5.5A.5.5 0 0 1 5.47 5l5.53.005a1 1 0 0 0 0-2L5.5 3A2.5 2.5 0 0 0 3 5.5v12.577c0 .76.082 1.185.319 1.627.224.419.558.754.977.978.442.236.866.318 1.627.318h12.154c.76 0 1.185-.082 1.627-.318.42-.224.754-.559.978-.978.236-.442.318-.866.318-1.627V13a1 1 0 1 0-2 0v5.077c0 .459-.021.571-.082.684a.364.364 0 0 1-.157.157c-.113.06-.225.082-.684.082H5.923c-.459 0-.57-.022-.684-.082a.363.363 0 0 1-.157-.157c-.06-.113-.082-.225-.082-.684V5.5z"
                fill="#000000"
              />
            </svg>
          </a>
        </div>
      `
    : null}

  <br />
  <a href="/welcome">Access NFT</a>
  <span> | </span>
  <a href="/subscribe">Newsletter</a>
  <span> | </span>
  <a href="/privacy-policy">Privacy Policy</a>
  <span> | </span>
  <a href="https://attestate.com/kiwistand/main/">API</a>
  <span> | </span>
  <a href="/about">About</a>
  <span> | </span>
  <a target="_blank" href="https://kiwinews.sleekplan.app/">Request Feature</a>
  <span> | </span>
  <a target="_blank" href="https://hackmd.io/a-r--DX2T5uEEKX0Z8PRlQ?view"
    >Guidelines</a
  >
  <span> | </span>
  <a href="/why">Why?</a>
  <script defer src="bundle.js"></script>
  <script
    async
    src="https://www.googletagmanager.com/gtag/js?id=G-21BKTD0NKN"
  ></script>
  <script async src="ga.js"></script>
  <div style="height: 100px"></div>
`;
export default footer;
