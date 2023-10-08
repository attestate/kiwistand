//@format
import { env } from "process";

import htm from "htm";
import vhtml from "vhtml";
import { utils } from "ethers";

import * as ens from "../../ens.mjs";
import * as karma from "../../karma.mjs";

const html = htm.bind(vhtml);

const menu = html`
  <div
    class="sidebar-toggle"
    style="width: 33%; cursor: pointer; align-items: center; justify-content: left; padding: 7px 0 7px 7px;"
  >
    <svg style="padding-top: 2px;" viewBox="0 0 100 80" width="20" height="20">
      <rect width="100" height="10"></rect>
      <rect y="30" width="100" height="10"></rect>
      <rect y="60" width="100" height="10"></rect>
    </svg>
    <span style="color: black; margin-left: 10px;">Menu</span>
  </div>
`;

const pfp = (avatar, points) =>
  html` <div
    class="sidebar-toggle"
    style="width: 33%; cursor: pointer; align-items: center; justify-content: left; padding: 12px 0 7px 7px;"
  >
    <div style="display: flex; flex-direction: column; align-items: center;">
      <img
        src="${avatar}"
        style="border-radius: 100%; height: 18px; width: 18px; border: 1px solid black;"
      />
      <span
        style="font-weight: bold; font-size: 8px; margin-top: -2px; color: black;"
        >${points.toString()}</span
      >
    </div>
  </div>`;

const header = async (theme, identity) => {
  let activeMenu;
  let address;
  try {
    address = utils.getAddress(identity);
  } catch (err) {
    activeMenu = menu;
  }
  if (!activeMenu) {
    const profile = await ens.resolve(address);
    const points = karma.resolve(address);
    if (profile.safeAvatar) {
      activeMenu = pfp(profile.safeAvatar, points);
    } else {
      activeMenu = menu;
    }
  }
  return html` <td style="height: 62px;">
    <nav-onboarding-modal />
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
              <div class="kn-banner-desk">Kiwi News</div>
              ${activeMenu}

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
                <div id="connectButton"></div>
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </td>`;
};
export default header;
