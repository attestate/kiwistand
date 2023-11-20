//@format
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";

const html = htm.bind(vhtml);

export default async function index(theme, identity) {
  const path = "/subscribe";
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <div class="container">
          ${Sidebar(path)}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme, identity)}
              </tr>
              <tr>
                <td style="padding: 10px; font-size: 16px;">
                  <p>
                    There are a few ways to stay up to date with Kiwi. Feel free
                    to choose whatever method you prefer.
                  </p>
                  <br />
                  <p>
                    <h3>Kiwi Weekly (TOP10 most upvoted links of the week)</h3>
                  </p>
                  <div style="text-align: left;">
                    <iframe
                      src="https://paragraph.xyz/@kiwi-weekly/embed?minimal=true"
                      width="100%"
                      height="80"
                      frameborder="0"
                      scrolling="no"
                    ></iframe>
                  </div>
                  <div>
                    <p>
                      <h3>Kiwi mobile app</h3>
                    </p>
                    <p>
                      On iPhone (Safari) and Android (Chrome) you can install
                      our progressive web app. This will make Kiwi News look
                      like any other app on your phone!
                    </p>
                    <button
                      id="button-onboarding"
                      style="margin-right: 0;"
                      onclick="window.dispatchEvent(new CustomEvent('openModal'));"
                      >
                      Install app - only on iPhone (Safari) or Android (Chrome)
                    </button>
                  </div>
                  <br />
                  <p>
                    <h3
                      >Real-Time RSS Feeds (maintained by our community member:
                      <span> </span>
                      <a href="https://warpcast.com/freeatnet" target="_blank"
                        >@freeatnet</a
                      >):</h3
                    >
                  </p>
                  <div>
                    <p>
                      <span>Top Links feed: </span>
                      <a
                        href="https://kiwinews.lol/api/feed/top"
                        target="_blank"
                        >https://kiwinews.lol/api/feed/top</a
                      >
                    </p>
                    <p>
                      <span>New Links feed: </span>
                      <a
                        href="https://kiwinews.lol/api/feed/new"
                        target="_blank"
                        >https://kiwinews.lol/api/feed/new</a
                      >
                    </p>
                  </div>
                </td>
              </tr>
            </table>
          </div>
        </div>
        ${Footer(theme)}
        <div
          id="bookmark-modal"
          style="display: none; position: fixed; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.4);"
        >
          <div
            style="background-color: #fefefe; margin: 15% auto; padding: 20px; border: 1px solid #888; width: 80%;"
          >
            <span
              id="close-modal"
              style="color: #aaa; float: right; font-size: 28px; font-weight: bold;"
              >&times;</span
            >
            <p id="bookmark-instructions"></p>
          </div>
        </div>
      </body>
    </html>
  `;
}
