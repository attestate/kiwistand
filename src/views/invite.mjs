//@format
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";

const html = htm.bind(vhtml);

const path = "/indexing";

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
            border: none;
            margin-top: 0;
            margin-bottom: 0;
          }
          .desktop-nav {
            display: none;
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
                    style="height: 60vh; flex-direction: column; display: flex; justify-content: center; align-items: center;"
                  >
                    <img
                      style="border: 1px solid #828282; border-radius: 2px; max-width: 65vw; overflow: auto; margin-top: 4rem;"
                      src="Telegram.png"
                    />
                    <div
                      style="display: flex; justify-content: center; flex-direction: column; max-width: 20rem;"
                    >
                      <h2 style="color:black;">Join our Telegram!</h2>
                      <p>Click the link below:</p>
                      <nav-invite-link> ...loading </nav-invite-link>
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td>
                  <p
                    style="color: black; padding: 3rem 3rem 1rem 3rem; font-size: 1rem; text-align: center; margin-top: 1rem;"
                  >
                    Congratz 🎉 <b>You've made it!</b>:
                  </p>
                </td>
              </tr>
              <tr>
                <td
                  style="padding: 0 0 3rem 0; display: flex; justify-content: space-evenly;"
                >
                  <a href="/">
                    <button
                      style="width:auto;"
                      class="button-secondary"
                      id="button-onboarding"
                    >
                      Start using Kiwi!
                    </button>
                  </a>
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
