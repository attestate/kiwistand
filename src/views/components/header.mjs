//@format
import { env } from "process";
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);
const header = (theme) => html` <td bgcolor="${theme.color}">
  <table
    style="padding:10px 15px 10px 15px;"
    width="100%"
    cellspacing="0"
    cellpadding="0"
    border="0"
  >
    <tbody>
      <tr>
        <td style="line-height:12pt; height:10px;">
          <div
            style="display: flex; flex-wrap: nowrap; justify-content: space-between; align-items: center;"
          >
            <div
              class="sidebar-toggle"
              style="cursor: pointer; display: flex; align-items: center; justify-content: center;"
            >
              <svg
                style="padding-top: 2px;"
                viewBox="0 0 100 80"
                width="20"
                height="20"
              >
                <rect width="100" height="10"></rect>
                <rect y="30" width="100" height="10"></rect>
                <rect y="60" width="100" height="10"></rect>
              </svg>
              <span style="color: black; margin-left: 10px;">Menu</span>
            </div>

            <a
              href="/"
              style="width: 100%; display: flex; justify-content: center;"
            >
              <span style="padding: 0 20px 0 20px" ; class="pagetop">
                <b class="hnname">
                  <span>${theme.emoji}</span>
                </b>
              </span>
            </a>

            <div
              style="display: flex; justify-content: flex-end; width: 100px;"
            >
              <div id="connectButton"></div>
            </div>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</td>`;
export default header;
