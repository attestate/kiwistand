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
                  style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-primary);"
                  href="/"
                  onclick="if(!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button !== 1) {var el=document.getElementById('spinner-overlay'); if(el) el.style.display='block';}"
                >
                  <div
                    class="kiwi-logo-img"
                    style="width: 35px; height: 35px;"
                  ></div>
                  <div style="display: flex; flex-direction: column; gap: 0;">
                    <svg class="kiwi-wordmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 212.56 53.42" style="height: 28px; width: auto;" aria-label="Kiwi News">
                      <path style="fill: #a6b052;" d="M16.9,40.56c0,.86-.45,1.32-1.32,1.32h-4.89c-.86,0-1.32-.45-1.32-1.32v-23.68c0-.86.45-1.32,1.32-1.32h4.89c.86,0,1.32.45,1.32,1.32v8.04c0,.38.07.41.3.11l5.64-8.38c.49-.71,1.2-1.09,2.07-1.09h6.09c.49,0,.86.64.56,1.09l-7.37,10.98c-.49.71-.49,1.47,0,2.18l7.37,10.98c.3.45-.08,1.09-.56,1.09h-6.09c-.86,0-1.58-.38-2.07-1.09l-5.64-8.38c-.23-.3-.3-.26-.3.11v8.04Z"/>
                      <path style="fill: #a6b052;" d="M36.56,15.69c2.26,0,3.76,1.5,3.76,3.76s-1.5,3.76-3.76,3.76-3.76-1.5-3.76-3.76,1.5-3.76,3.76-3.76ZM32.8,26.78c0-.86.45-1.32,1.32-1.32h4.89c.86,0,1.32.45,1.32,1.32v13.72c0,.86-.45,1.32-1.32,1.32h-4.89c-.86,0-1.32-.45-1.32-1.32v-13.72Z"/>
                      <path style="fill: #a6b052;" d="M55.5,20.93c.26-.83.83-1.28,1.69-1.28h4.89c.86,0,1.43.45,1.69,1.28l3.08,10.3c.11.38.19.38.3,0l3.08-10.3c.26-.83.83-1.28,1.69-1.28h4.89c.86,0,1.17.41.9,1.24l-6.54,19.74c-.26.83-.86,1.24-1.73,1.24h-4.89c-.86,0-1.47-.41-1.73-1.24l-3.01-9.1c-.11-.34-.26-.34-.38,0l-3.01,9.1c-.26.83-.86,1.24-1.73,1.24h-4.89c-.86,0-1.47-.41-1.73-1.24l-6.54-19.74c-.26-.83.04-1.24.9-1.24h4.89c.86,0,1.43.45,1.69,1.28l3.08,10.3c.11.38.19.38.3,0l3.08-10.3Z"/>
                      <path style="fill: #a6b052;" d="M82.72,15.73c2.26,0,3.76,1.5,3.76,3.76s-1.5,3.76-3.76,3.76-3.76-1.5-3.76-3.76,1.5-3.76,3.76-3.76ZM78.96,26.72c0-.86.45-1.32,1.32-1.32h4.89c.86,0,1.32.45,1.32,1.32v13.77c0,.86-.45,1.32-1.32,1.32h-4.89c-.86,0-1.32-.45-1.32-1.32v-13.77Z"/>
                      <path fill="currentColor" d="M111.7,19.02c5.07,0,8.68,3.05,8.68,9.96v11.58c0,.86-.45,1.32-1.32,1.32h-4.89c-.86,0-1.32-.45-1.32-1.32v-9.7c0-3.46-1.62-4.62-3.23-4.62s-3.23,1.54-3.23,4.62v9.7c0,.86-.45,1.32-1.32,1.32h-4.89c-.86,0-1.32-.45-1.32-1.32v-19.59c0-.86.45-1.32,1.32-1.32h4.89c.86,0,1.32.45,1.32,1.32v.38c0,.38.07.41.3.11,1.24-1.65,2.93-2.44,5-2.44Z"/>
                      <path fill="currentColor" d="M129.78,32.44c-.38,0-.53.19-.38.53.64,1.58,1.95,2.52,3.31,2.52,1.01,0,1.95-.49,2.67-1.28.64-.71,1.17-.79,1.84-.38l4.32,2.67c.79.49.94,1.13.45,1.84-1.99,2.86-5.19,4.29-9.25,4.29-6.73,0-11.24-4.51-11.24-11.8s4.51-11.8,11.31-11.8,11.31,4.51,11.31,11.8v.3c0,.86-.45,1.32-1.32,1.32h-13.04ZM135.9,29.28c.38,0,.53-.19.38-.53-.64-1.62-2.03-2.59-3.46-2.59s-2.82.98-3.46,2.59c-.15.34,0,.53.38.53h6.16Z"/>
                      <path fill="currentColor" d="M157.82,20.93c.26-.83.83-1.28,1.69-1.28h4.89c.86,0,1.43.45,1.69,1.28l3.08,10.3c.11.38.19.38.3,0l3.08-10.3c.26-.83.83-1.28,1.69-1.28h4.89c.86,0,1.17.41.9,1.24l-6.54,19.74c-.26.83-.86,1.24-1.73,1.24h-4.89c-.86,0-1.47-.41-1.73-1.24l-3.01-9.1c-.11-.34-.26-.34-.38,0l-3.01,9.1c-.26.83-.86,1.24-1.73,1.24h-4.89c-.86,0-1.47-.41-1.73-1.24l-6.54-19.74c-.26-.83.04-1.24.9-1.24h4.89c.86,0,1.43.45,1.69,1.28l3.08,10.3c.11.38.19.38.3,0l3.08-10.3Z"/>
                      <path fill="currentColor" d="M194.95,28.34c-1.5,0-1.16-2.14-4.28-2.14-2.26,0-2.67.71-2.67,1.5,0,2.29,13.19-.94,13.19,8.53,0,3.16-3.2,6.39-10.9,6.39-8.23,0-10.19-3.98-10.49-7.97-.07-.86.38-1.32,1.28-1.32h5.11c1.28,0,.34,2.14,4.1,2.14,2.26,0,3.2-.71,3.2-1.5,0-1.92-13.19.56-13.19-8.53,0-2.78,1.92-6.43,10.37-6.43,6.73,0,9.44,3.08,9.81,8.01.08.86-.38,1.32-1.28,1.32h-4.25Z"/>
                    </svg>
                    <span class="anon-mode-label">anon-mode</span>
                  </div></a
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
                          style="color: var(--text-primary); text-decoration: none; font-size: 11pt; display: inline-flex; align-items: center; min-height: 44px; min-width: 44px; padding: 0 5px;"
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
                        style="padding: 0 13px 0 7px; background: var(--button-bg); border-radius: 2px; display: flex; align-items: center;"
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
                          <span style="color: var(--text-primary); margin-left: 10px;"
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
                      <div
                        class="kiwi-logo-img"
                        style="width: 40px; height: 40px;"
                      ></div>
                    </span>
                  </b>
                </span>
              </a>
              <div class="desktop-nav">
                <a
                  class="meta-link primary-action"
                  href="/submit"
                  data-no-instant
                  onclick="if(!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button !== 1) {var el=document.getElementById('spinner-overlay'); if(el) el.style.display='block';}"
                  >Submit</a
                >
                <span class="header-disconnect">Disconnect</span>
              </div>
              <div
                class="header-bell"
                style="width: 33%; padding: 7px 4px 7px 0; display: flex; justify-content: flex-end; align-items: center;"
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
