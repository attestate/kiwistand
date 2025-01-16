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
          @keyframes spin {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }

          .container {
            width: 100%;
            box-sizing: border-box;
          }

          #hnmain {
            width: 100%;
            margin-top: 0;
            margin-bottom: 0;
            border: none;
          }

          .sidebar,
          .desktop-nav {
            display: none;
          }
          .sidebar-toggle {
            visibility: hidden;
          }
        </style>
      </head>
      <body ontouchstart="">
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
                    style="display: flex; flex-direction: column; align-items: center; justify-content: start; height: 100vh; text-align: center;"
                  >
                    <h1
                      style="max-width: 720px; 
                    margin-left: auto;
                    margin-right: auto;
                    text-align: center;
                    color: black;margin-top: 4rem; margin-bottom: 0; padding-bottom: 0;"
                    >
                      You're <i>almost</i> set!
                    </h1>
                    <div
                      style="display: flex; align-items: center; justify-content: center; flex-direction: column; max-width: 20rem;"
                    >
                      <p
                        style="color: black; font-size: 1.1rem; text-align: center;"
                      >
                        Please do <b>NOT</b> close this site!
                      </p>

                      <p>We're indexing your transaction...</p>
                    </div>
                    <div
                      style="margin-top: 2rem; display: flex; align-items: center; justify-content: center; flex-direction: column; max-width: 20rem;"
                    >
                      <push-subscription-button data-wrapper="false">
                        ...loading
                      </push-subscription-button>
                    </div>
                    <div
                      style="position: fixed; right: 20px; bottom: 20px; z-index: 100; text-align: center;"
                    >
                      <button
                        style="background-color: grey; color: white; padding: 0.5rem 1rem; display: inline-flex; align-items: center; justify-content: center; gap: 10px; font-size: 1.2rem; cursor: pointer; border-radius: 2px;"
                      >
                        Next
                        <span
                          style="border: 4px solid #fff; border-top: 4px solid ${theme.color}; border-radius: 50%; width: 20px; height: 20px; animation: spin 2s linear infinite;"
                        ></span>
                      </button>
                      <div class="nav-countdown">
                        <div style="margin-top: 10px;">
                          Should only take a few seconds... <br />
                          0:20
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </table>
            <div style="display: none;">${Footer(theme, "/indexing")}</div>
          </div>
        </div>
      </body>
    </html>
  `;
}
