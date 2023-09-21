//@format
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";

const html = htm.bind(vhtml);

export default function index(theme) {
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
                ${Header(theme)}
              </tr>
              <tr>
                <td>
                  <p
                    style="color: black; margin-bottom: 0; padding: 8px 0 0 8px; font-size: 14pt;"
                  >
                    <b>SETTINGS</b>
                  </p>
                  <p
                    style="color: black; margin-top: 0; padding: 8px 0 0 15px; font-size: 13pt;"
                  >
                    <b>Signless upvoting and submitting</b>
                  </p>
                  <p
                    style="color: black; padding: 7px 7px 15px 17px; font-size: 12pt;"
                  >
                    Enable to skip manual signature confirmations.
                    <span> </span>
                    <a
                      style="text-decoration: underline;"
                      href="https://www.loom.com/share/244e444db3444cc3b50376d38e72bd69"
                      target="_blank"
                      >Learn more</a
                    >.
                    <span style="display: block; min-height: 60px;">
                      <delegate-button />
                    </span>
                  </p>
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
