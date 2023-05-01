//@format
import { env } from "process";
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);
const footer = html`
  <br />
  <a href="/privacy-policy">Privacy Policy</a>
  <script src="bundle.js"></script>
`;
export default footer;
