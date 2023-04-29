//@format
import { env } from "process";
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);
const header = (theme) => html`
  <td bgcolor="${theme.color}">
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
              <span>${theme.emoji} </span>
              <a href="/">${theme.name} News</a>
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
