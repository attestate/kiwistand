import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";
import * as ens from "../ens.mjs";

const html = htm.bind(vhtml);

export default async function (theme) {
  const videoUrl = "shortcut.mp4";
  const shortcutUrl =
    "https://www.icloud.com/shortcuts/711553cd22924328818215a2fdf79bdb";
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
      </head>
      <body>
        <div class="container">
          ${Sidebar()}
          <div id="hnmain" class="scaled-hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                <td style="padding: 1rem;">
                  <div
                    style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px;"
                  >
                    <h1 style="color: #333; margin-bottom: 0;">
                      Submit to Kiwi
                    </h1>
                    <p style="color: #555;">
                      Easily share links directly to Kiwi News with our iOS
                      Shortcut.
                    </p>

                    <video
                      controls
                      style="background-color: black; border: 7px solid black; border-radius: 18px; max-width: 50vw; max-height: 80vh;"
                    >
                      <source src="${videoUrl}" type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>

                    <a
                      href="${shortcutUrl}"
                      target="_blank"
                      style="text-decoration: none;"
                    >
                      <button
                        style="width: auto; margin-top: 2rem;"
                        id="button-onboarding"
                      >
                        Download Shortcut
                      </button>
                    </a>
                  </div>
                </td>
              </tr>
            </table>
            ${Footer(theme)}
          </div>
        </div>
      </body>
    </html>
  `;
}
