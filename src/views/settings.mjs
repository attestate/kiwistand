//@format
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";
import * as ens from "../ens.mjs";

const html = htm.bind(vhtml);
export default async function index(theme, identity) {
  let profile;
  if (identity) {
    profile = await ens.resolve(identity);
  }
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
      </head>
      <body>
        <div class="container">
          ${Sidebar()}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme, identity)}
              </tr>
              <tr style="display: flex; justify-content: center;">
                <td style="padding: 40px;">
                  <div
                    style="background-color: white; max-width: 315px; display: inline-block; padding: 30px; backgroun
 white; border-radius: 12px; box-shadow: 0 6px 20px rgba(0,0,0,0.1);"
                  >
                    <div style="margin-bottom: 20px; text-align: center;">
                      <span role="img" aria-label="Kiwi">🥝</span> Kiwi News
                    </div>
                    <h3 style="color: black; margin-bottom: 20px;">
                      <span>Connect with </span>
                      <a
                        style="color: #0000EE;"
                        href="https://news.kiwistand.com"
                        >news.kiwistand.com</a
                      >:
                    </h3>
                    ${profile
                      ? html`<div
                          style="margin-bottom: 30px; display: flex; align-items: center; gap:
 10px; justify-content: center; color: black;"
                        >
                          <img
                            src="${profile.safeAvatar}"
                            style="border-radius: 50%; height: 36px; width: 36px; border: 2px
 solid #ddd;"
                          />
                          <span style="font-size: 1.1em;"
                            >${profile.displayName}</span
                          >
                        </div>`
                      : ""}
                    <p
                      style="font-weight: bold; color: black; margin-bottom: 20px;"
                    >
                      Enable Kiwi News to seamlessly interact on your behalf on
                      the Optimism network:
                    </p>
                    <ul
                      style="list-style: none; padding-left: 0; color: black; margin-bottom:
 30px;"
                    >
                      <li>
                        <span style="color: limegreen;">•</span> Automatically
                        upvote and submit stories.
                      </li>
                      <li style="margin-top: 5px;">
                        <span style="color: limegreen;">•</span> Sign messages
                        without additional prompts.
                      </li>
                    </ul>
                    <p
                      style="color: black; font-style: italic; margin-bottom: 10px;"
                    >
                      Cost:
                      <span style="font-weight: bold;"> $0.4</span> (Optimism
                      gas fees)
                    </p>
                    <div
                      class="delegate-button"
                      style="margin-top: 20px; text-align: center;"
                    >
                      <button
                        style="width: auto;"
                        class="buy-button"
                        id="button-onboarding"
                        disabled
                      >
                        Loading...
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            </table>
          </div>
        </div>
        ${Footer(theme)}
      </body>
    </html>
  `;
}
