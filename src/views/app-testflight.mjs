//@format
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import { custom } from "./components/head.mjs";

const html = htm.bind(vhtml);
const path = "/app-onboarding";

export default async function (theme) {
  return html`
    <html lang="en" op="news">
      <head>
        ${custom()}
      </head>
      <body ontouchstart="">
        <div class="container">
          ${Sidebar(path)}
          <div id="hnmain" style="border: 1px dotted rgba(219, 105, 141, 0.5);">
            <table
              border="0"
              cellpadding="0"
              cellspacing="0"
              bgcolor="var(--bg-off-white)"
            >
              <tr>
                ${await Header(theme, path)}
              </tr>
              <tr>
                <td>
                  <div
                    style="max-width: 800px; margin: 40px auto; padding: 0 20px;"
                  >
                    <!-- Breadcrumb -->
                    <div
                      style="margin-bottom: 40px; display: flex; align-items: center; gap: 12px;"
                    >
                      <div style="color: black; font-weight: 500;">
                        iOS App Setup
                      </div>
                      <div style="color: #666;">→</div>
                      <div style="color: #666;">1. Backup Key</div>
                      <div style="color: #666;">→</div>
                      <div style="color: black; font-weight: 600;">
                        2. Install App
                      </div>
                    </div>

                    <!-- Card Container -->
                    <div
                      style="border: 1px dotted rgba(219, 105, 141, 0.5); background: white;"
                    >
                      <div style="padding: 32px;">
                        <div
                          style="text-align: center; max-width: 500px; margin: 0 auto;"
                        >
                          <h3
                            style="margin-top: 0; font-size: 1.2rem; color: black; margin-bottom: 20px;"
                          >
                            Continue to TestFlight
                          </h3>
                          <p
                            style="color: black; margin-bottom: 20px; text-align: left;"
                          >
                            You'll be taken to TestFlight to install the app.
                            Just follow their instructions to complete the
                            installation.
                          </p>
                          <a
                            href="https://testflight.apple.com/join/6jyvYECH"
                            style="font-weight: bold; display: inline-block; padding: 10px 20px; color: black; text-decoration: none; border-radius: 2px;"
                          >
                            Open TestFlight
                          </a>
                        </div>
                      </div>
                    </div>
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
