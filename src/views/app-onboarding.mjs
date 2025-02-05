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
                  <!-- Main Content -->
                  <div
                    style="max-width: 800px; margin: 40px auto; padding: 0 20px;"
                  >
                    <!-- Header -->
                    <h1 style="
                      font-size: 28px; 
                      font-weight: 600; 
                      color: black; 
                      margin-bottom: 16px;
                      text-align: left;
                    ">
                      TestFlight App Setup
                    </h1>
                    
                    <!-- Breadcrumb -->
                    <div
                      style="margin-bottom: 32px; display: flex; align-items: center; gap: 12px;"
                    >
                      <div style="color: black; font-weight: 500;">
                        TestFlight Setup
                      </div>
                      <div style="color: #666;">→</div>
                      <div style="color: black; font-weight: 600;">
                        1. Backup Key
                      </div>
                      <div style="color: #666;">→</div>
                      <div style="color: #666;">2. Install Beta App</div>
                    </div>

                    <!-- Card Container -->
                    <div
                      style="border: 1px dotted rgba(219, 105, 141, 0.5); background: white;"
                    >
                      <!-- Content Section -->
                      <div style="padding: 32px;">
                        <div
                          style="text-align: center; max-width: 500px; margin: 0 auto;"
                        >
                          <nav-passkeys-backup redirect-button="false">
                            ...loading
                          </nav-passkeys-backup>
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
