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
        <td style="line-height:12pt; height:10px;">
          <span class="pagetop"
            ><b class="hnname">
              <span>${theme.emoji} </span>
              <a href="/">${theme.name} News</a>
            </b>
          </span>
          <a style="color: black;" href="/">Top</a>
          <span> | </span>
          <a style="color: black;" href="/new">New</a>
          <span> | </span>
          <a style="color: black;" href="/community">Community</a>
        </td>
        <td style="text-align:right;padding-right:4px;">
          <span id="navigation"></span>
        </td>
      </tr>
    </table>
  </td>
`;
export default header;
