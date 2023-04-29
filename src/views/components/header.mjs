//@format
import { env } from "process";
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);
const header = html`
  <td bgcolor="${env.THEME_COLOR}">
    <table
      border="0"
      cellpadding="0"
      cellspacing="0"
      width="100%"
      style="padding:10px"
    >
      <tr>
        <td style="width:18px;padding-right:4px"></td>
        <td style="line-height:12pt; height:10px;">
          <span class="pagetop"
            ><b class="hnname">
              <span>${env.THEME_EMOJI} </span>
              <a href="/">${env.THEME_NAME}</a>
            </b>
          </span>
          <a style="color: black;" href="/">Editor Picks</a>
          <span> | </span>
          <a style="color: black;" href="/feed">Feed</a>
        </td>
        <td style="text-align:right;padding-right:4px;">
          <span id="navigation"></span>
        </td>
      </tr>
    </table>
  </td>
`;
export default header;
