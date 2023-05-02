//@format
import { env } from "process";
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);
const welcome = html` <a href="/welcome">Access NFT</a> `;
const footer = html`
  <br />
  <a href="/privacy-policy">Privacy Policy</a>
  <span> | </span>
  <span> | </span>
  <a href="/subscribe">Newsletter</a>
  <script src="bundle.js"></script>
`;
export default footer;
