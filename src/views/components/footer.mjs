//@format
import { env } from "process";
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);
const footer = (theme) => html`
  <div style="display: none; background-color: ${theme.color}" id="footer">
    <div class="footer-item">
      <a href="/"
        ><i class="icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M11.3103 1.77586C11.6966 1.40805 12.3034 1.40805 12.6897 1.77586L20.6897 9.39491L23.1897 11.7759C23.5896 12.1567 23.605 12.7897 23.2241 13.1897C22.8433 13.5896 22.2103 13.605 21.8103 13.2241L21 12.4524V20C21 21.1046 20.1046 22 19 22H14H10H5C3.89543 22 3 21.1046 3 20V12.4524L2.18966 13.2241C1.78972 13.605 1.15675 13.5896 0.775862 13.1897C0.394976 12.7897 0.410414 12.1567 0.810345 11.7759L3.31034 9.39491L11.3103 1.77586ZM5 10.5476V20H9V15C9 13.3431 10.3431 12 12 12C13.6569 12 15 13.3431 15 15V20H19V10.5476L12 3.88095L5 10.5476ZM13 20V15C13 14.4477 12.5523 14 12 14C11.4477 14 11 14.4477 11 15V20H13Z"
              fill="#000000"
            />
          </svg> </i
      ></a>
    </div>
    <div class="footer-item activity-link">
      <a href="/activity"
        ><i class="icon">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M18.9,11.2s0-8.7-6.9-8.7-6.9,8.7-6.9,8.7v3.9L2.5,17.5h19l-2.6-2.4Z"
              fill="none"
              stroke="#000000"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />

            <path
              d="M14.5,20.5s-.5,1-2.5,1-2.5-1-2.5-1"
              fill="none"
              stroke="#000000"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg> </i
      ></a>
    </div>
    <div class="footer-item">
      <a href="/submit"
        ><i class="icon"
          ><svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M19.186 2.09c.521.25 1.136.612 1.625 1.101.49.49.852 1.104 1.1 1.625.313.654.11 1.408-.401 1.92l-7.214 7.213c-.31.31-.688.541-1.105.675l-4.222 1.353a.75.75 0 0 1-.943-.944l1.353-4.221a2.75 2.75 0 0 1 .674-1.105l7.214-7.214c.512-.512 1.266-.714 1.92-.402zm.211 2.516a3.608 3.608 0 0 0-.828-.586l-6.994 6.994a1.002 1.002 0 0 0-.178.241L9.9 14.102l2.846-1.496c.09-.047.171-.107.242-.178l6.994-6.994a3.61 3.61 0 0 0-.586-.828zM4.999 5.5A.5.5 0 0 1 5.47 5l5.53.005a1 1 0 0 0 0-2L5.5 3A2.5 2.5 0 0 0 3 5.5v12.577c0 .76.082 1.185.319 1.627.224.419.558.754.977.978.442.236.866.318 1.627.318h12.154c.76 0 1.185-.082 1.627-.318.42-.224.754-.559.978-.978.236-.442.318-.866.318-1.627V13a1 1 0 1 0-2 0v5.077c0 .459-.021.571-.082.684a.364.364 0 0 1-.157.157c-.113.06-.225.082-.684.082H5.923c-.459 0-.57-.022-.684-.082a.363.363 0 0 1-.157-.157c-.06-.113-.082-.225-.082-.684V5.5z"
              fill="#000000"
            /></svg></i
      ></a>
    </div>
  </div>
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
  <script defer src="bundle.js"></script>
  <script
    async
    src="https://www.googletagmanager.com/gtag/js?id=G-21BKTD0NKN"
  ></script>
  <script async src="ga.js"></script>
  <div style="height: 100px"></div>
`;
export default footer;
