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
  <script src="bundle.js"></script>
`;
export default footer;
