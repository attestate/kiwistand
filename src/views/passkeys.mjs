//@format
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";

const html = htm.bind(vhtml);

const path = "/passkeys";

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
                    style="height: 100vh; flex-direction: column; display: flex; justify-content: center; align-items: center;"
                  >
                    <div
                      style="display: flex; justify-content: center; flex-direction: column; max-width: 20rem;"
                    >
                      <nav-passkeys-backup> ...loading </nav-passkeys-backup>
                    </div>
                    <br />
                    <br />
                    <br />
                    <br />
                    <a href="/invite">skip</a>
                  </div>
                </td>
              </tr>
            </table>
            <div style="display: none;">${Footer(theme, "/passkeys")}</div>
          </div>
        </div>
      </body>
    </html>
  `;
}
