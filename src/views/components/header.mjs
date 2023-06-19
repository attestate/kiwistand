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
                <span>${theme.emoji}</span><a href="/"> ${theme.name} News</a>
              </b>
            </span>
            <div
              style="display: flex; flex-wrap: wrap; justify-content: flex-start; align-items: center;"
            >
              <div
                style="flex: 0 0 auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-left: 10px;"
              >
                <a style="color: black;" href="/">Top</a>
              </div>
              <div
                style="flex: 0 0 auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-left: 10px;"
              >
                <a style="color: black;" href="/new">New</a>
              </div>
              <div
                style="flex: 0 0 auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-left: 10px;"
              >
                <a style="color: black;" href="/community">Community</a>
              </div>
              <div
                style="flex: 0 0 auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-left: 10px;"
                class="hide-on-mobile"
              >
                <a style="color: black; cursor: pointer;" href="/submit"
                  >Submit</a
                >
              </div>

              <div
                style="flex: 0 0 auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-left: 10px;"
                id="profile-container"
                class="hide-on-mobile"
              >
                <nav-profile />
              </div>

              <div
                style="flex: 0 0 auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-left: 10px;"
                id="activity-container"
                class="hide-on-mobile"
              >
                <nav-activity />
              </div>

              <div
                style="flex: 0 0 auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-left: 10px;"
              >
                <nav-connect />
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </td>
`;
export default header;
