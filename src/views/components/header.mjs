//@format
import { env } from "process";

import htm from "htm";
import vhtml from "vhtml";
import { utils } from "ethers";

import * as ens from "../../ens.mjs";
import * as karma from "../../karma.mjs";

const html = htm.bind(vhtml);

const header = (theme, path) => {
  const isStoryPage = path === "/stories";
  return html` <td style="height: 70px;">
    <nav-nft-modal />
    <nav-delegation-modal />
    <table
      style="padding:5px 7px 5px 7px;"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      border="0"
    >
      <tbody>
        <tr>
          <td style="line-height:12pt; height:62px;">
            <div
              style="display: flex; flex-wrap: nowrap; justify-content: space-between; align-items: center;"
            >
              <div class="kn-banner-desk">
                <a
                  style="display: flex; align-items: center; gap: 0.5rem; color: black;"
                  href="/"
                  onclick="if(!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button !== 1) document.getElementById('spinner-overlay').style.display='block'"
                >
                  <img
                    style="filter: saturate(90%); width: 35px; height: 35px;"
                    src="kiwi-icon.webp"
                  />
                  Kiwi News</a
                >
              </div>
              <nav-header-avatar
                class="${isStoryPage ? "story-back-button" : "sidebar-toggle"}"
                style="width: 33%;"
              >
                ${isStoryPage
                  ? // Static Back button for story pages (server-side)
                    html`
                      <div
                        style="display: flex; align-items: center; padding: 0 7px; height: 100%; width: 100%;"
                      >
                        <a
                          href="/"
                          style="color: black; text-decoration: none; font-size: 11pt; display: inline-flex; align-items: center; min-height: 44px; min-width: 44px; padding: 0 5px;"
                        >
                          <svg
                            height="21px"
                            viewBox="0 0 13 21"
                            style="margin-right: 6px;"
                            stroke="currentColor"
                            stroke-width="2.5"
                            fill="none"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <polyline points="11.5 1.5 1.5 10.5 11.5 19.5" />
                          </svg>
                          <span style="margin-top: 1px;">Back</span>
                        </a>
                      </div>
                    `
                  : // Default Menu button for non-story pages (React will replace if logged in)
                    html`
                      <div
                        style="padding: 0 13px 0 7px; background: rgba(0, 0, 0, 0.05); border-radius: 2px; display: ${path ===
                        "/kiwipass-mint"
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
                          <span style="color: black; margin-left: 10px;"
                            >Menu</span
                          >
                        </div>
                      </div>
                    `}
              </nav-header-avatar>

              <a
                class="mobile-center"
                href="/"
                style="user-select: none; width: 33%; display: flex; justify-content: center;"
              >
                <span style="padding: 0 20px 0 20px" ; class="pagetop">
                  <b class="hnname">
                    <span>
                      <img
                        style="filter: saturate(90%); width: 40px;"
                        src="kiwi-icon.webp"
                      />
                    </span>
                  </b>
                </span>
              </a>
              <div class="desktop-nav">
                <a
                  class="meta-link"
                  href="/"
                  data-no-instant
                  onclick="if(!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button !== 1) document.getElementById('spinner-overlay').style.display='block'"
                  >Feed</a
                >
                <a
                  class="meta-link primary-action"
                  href="/submit"
                  data-no-instant
                  onclick="if(!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button !== 1) document.getElementById('spinner-overlay').style.display='block'"
                  >Submit</a
                >
                <a
                  class="meta-link"
                  href="/community"
                  data-no-instant
                  onclick="if(!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button !== 1) document.getElementById('spinner-overlay').style.display='block'"
                  >Users</a
                >
                <span class="header-disconnect">Disconnect</span>
              </div>
              <div
                class="header-bell"
                style="width: 33%; padding: 7px 7px 7px 0; display: flex; justify-content: flex-end;"
              >
                <div id="bell"></div>
                <div id="search"></div>
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </td>`;
};
export default header;
