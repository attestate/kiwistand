//@format
import { env } from "process";
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);
const header = (theme) => html`
  <td bgcolor="${theme.color}">
    <table
      style="padding:10px"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
    >
      <tbody>
        <tr>
          <td style="line-height:12pt; height:10px;">
            <span class="pagetop">
              <b class="hnname">
                <span>🥦</span><a href="/"> Broccoli News</a>
              </b>
            </span>
            <div id="menu">
              <a style="color: black;" href="/">Top</a><span> | </span>
              <a style="color: black;" href="/new">New</a><span> | </span>
              <a style="color: black;" href="/community">Community</a>
              <span> | </span>
              <span id="navigation"></span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </td>
`;
export default header;
