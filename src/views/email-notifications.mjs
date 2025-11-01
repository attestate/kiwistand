import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";

const html = htm.bind(vhtml);

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
            margin-top: 0;
            margin-bottom: 0;
            border: none;
          }
          .desktop-nav {
            display: none;
          }
        </style>
      </head>
      <body ontouchstart="">
        <div class="container">
          ${Sidebar()}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="var(--background-color0)">
              <tr>
                ${await Header(theme, "/email-notifications")}
              </tr>
              <tr>
                <td>
                  <div style="height: 100vh; flex-direction: column; display: flex; justify-content: center; align-items: center;">
                    <div style="display: flex; justify-content: center; flex-direction: column; max-width: 20rem;">
                      <h1>Email Notifications Subscription</h1>
                      <email-subscription-form></email-subscription-form>
                      <div style="text-align: center; margin-top: 16px;">
                        <a href="/demonstration" class="button-secondary" style="width: auto; text-decoration: underline; background: none; border: none;">Skip</a>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </table>
            <div style="display: none;">${Footer(theme, "/email-notifications")}</div>
          </div>
        </div>
      </body>
    </html>
  `;
}
