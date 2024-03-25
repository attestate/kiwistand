//@format
import { env } from "process";

import htm from "htm";
import vhtml from "vhtml";
import { utils } from "ethers";

import * as ens from "../../ens.mjs";
import * as karma from "../../karma.mjs";

const html = htm.bind(vhtml);

const header = async (theme, path) => {
  return html` <td style="height: 62px;">
    <nav-nft-modal />
    <table
      style="padding:5px 7px 5px 7px;"
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
              <div class="kn-banner-desk">Why did he leave?</div>
              <nav-header-avatar class="sidebar-toggle" style="width: 33%;">
                <div
                  style="display: ${path === "/kiwipass-mint"
                    ? "none"
                    : "flex"}; align-items: center;"
                >
                  <div
                    style="display: flex; cursor: pointer; align-items: center; justify-content: left; padding: 7px 0 7px 7px;"
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
                </div>
              </nav-header-avatar>

              <a
                href="/"
                style="width: 33%; display: flex; justify-content: center;"
              >
                <span style="padding: 0 20px 0 20px" ; class="pagetop">
                  <b class="hnname">
                    <span>${theme.emoji}</span>
                  </b>
                </span>
              </a>

              <div
                style="width: 33%; padding: 7px 7px 7px 0; display: flex; justify-content: flex-end;"
              >
                <div id="bell"></div>
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </td>`;
};
export default header;
