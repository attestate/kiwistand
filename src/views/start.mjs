//@format
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import { custom } from "./components/head.mjs";
import * as ens from "../ens.mjs";

const html = htm.bind(vhtml);
export default async function index(theme) {
  const ogImage = "https://news.kiwistand.com/start_preview.jpeg";
  return html`
    <html lang="en" op="news">
      <head>
        ${custom(ogImage)}
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
                ${await Header(theme)}
              </tr>
              <tr style="display: flex; justify-content: center;">
                <td style="padding: 40px; height: 90vh;">
                  <div
                    class="delegate-button"
                    style="margin-top: 20px; text-align: center;"
                  >
                    loading...
                  </div>
                  <nav-simple-disconnect-button
                    style="cursor: pointer; margin-top: 1rem; text-align: center; min-height: 16.5px; display: block;"
                  />
                </td>
              </tr>
            </table>
            <div style="display: none;">${Footer(theme, "/start")}</div>
          </div>
        </div>
      </body>
    </html>
  `;
}
