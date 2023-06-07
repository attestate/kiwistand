//@format
import { env } from "process";
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);
const footer = html`
  <br />
  <a href="/welcome">Access NFT</a>
  <span> | </span>
  <a href="/subscribe">Newsletter</a>
  <span> | </span>
  <a href="/activity">Activity</a>
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
`;
export default footer;
