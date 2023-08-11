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
                  <p style="color: black; padding: 5px; font-size: 14pt;">
                    <b>SETTINGS</b>
                  </p>
                  <p
                    style="color: black; padding: 7px 7px 15px 7px; font-size: 12pt;"
                  >
                    You can turn on “Signless Kiwi Experience” to submit and upvote stories without needing to sign every action. You can set it up on your mobile and desktop.
                    <br />
                    <br />
                    After you click "Turn on", it might take up to 5 minutes to make it work. If you'd like to learn how it works check <u><a href="https://www.loom.com/share/244e444db3444cc3b50376d38e72bd69" target="_blank">Tim's Loom video</a></u>.
                    <br />
                    <br />
                    <delegate-button />
                    <br />
                    <br />
                    
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
