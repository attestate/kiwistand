import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import { custom } from "./components/head.mjs";

const html = htm.bind(vhtml);

// Mini App landing page for Warpcast frame
export default async function frameSubscribe(theme) {
  const path = "/miniapp";
  return html`
    <html lang="en" op="news">
      <head>
        ${custom()}
        <meta
          name="fc:frame"
          content='{"version":"next","imageUrl":"https://news.kiwistand.com/pwa_maskable_icon.png","button":{"title":"Add Kiwi News","action":{"type":"launch_frame"}}}'
        />
      </head>
      <body ontouchstart="">
        <div class="container">
          ${Sidebar(path)}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0">
              <tr>
                ${await Header(theme, path)}
              </tr>
              <tr>
                <td style="text-align:center; padding:3rem 1rem;">
                  <h1 style="font-size:1.5rem; margin-bottom:1rem;">
                    Get Kiwi News in Warpcast
                  </h1>
                  <p style="margin-bottom:2rem; color:#333;">
                    Add our mini-app to receive the top-3 curated links daily as
                    Farcaster notifications.
                  </p>
                  <button
                    id="frame-add-btn"
                    class="button-primary"
                    style="padding:0.75rem 1.5rem; border-radius:2px;"
                  >
                    Add Kiwi News
                  </button>
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
