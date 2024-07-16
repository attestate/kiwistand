//@format
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";

const html = htm.bind(vhtml);

const path = "/notifications";

export default async function (theme) {
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
        <style>
          @media screen and (min-width: 769px) {
            .sidebar {
              display: none;
            }
          }
          .sidebar-toggle {
            visibility: hidden;
          }
          #hnmain {
            width: 100%;
            border-bottom: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          ${Sidebar()}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme, path)}
              </tr>
              <tr>
                <td>
                  <div
                    style="min-height: 100vh; flex-direction: column; display: flex; justify-content: center; align-items: center;"
                  >
                    <div
                      style="color: black; display: flex; justify-content: center; flex-direction: column; max-width: 20rem;"
                    >
                      <h2>Add to home screen to continue</h2>
                      <br />
                      <div>
                        1. Open the Kebap menu
                        <br />
                        <br />
                        2. Choose
                        <b> "Install App" </b>
                        <br />
                        <br />
                        3. Open the "Kiwi News" app on your home screen
                        <br />
                        <br />
                      </div>
                      <div
                        style="flex-direction: column; display: flex; align-items: center;"
                      >
                        <img
                          style="margin-top: 1rem; width: 70%"
                          src="/add-to-homescreen-android.gif"
                        />
                        <br />
                        <a
                          style="text-decoration: underline; margin-bottom: 3rem;"
                          href="/kiwipass-mint"
                          >skip</a
                        >
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </table>
            <div style="display: none;">${Footer(theme, "/invite")}</div>
          </div>
        </div>
      </body>
    </html>
  `;
}
