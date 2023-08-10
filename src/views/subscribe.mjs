//@format
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";

const html = htm.bind(vhtml);

export default function index(theme) {
  const path = "/subscribe";
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
      </head>
      <body>
        <div class="container">
          ${Sidebar(path)}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${Header(theme)}
              </tr>
              <tr>
                <td style="padding: 10px; font-size: 16px;">
                  <p>
                    There are a few ways to stay up to date with Kiwi. Feel free
                    to choose whatever method you prefer.
                  </p>
                  <br />
                  <p>
                    <b>Kiwi Weekly (TOP10 most upvoted links of the week)</b>
                  </p>
                  <div style="text-align: left;">
                    <iframe
                      src="https://paragraph.xyz/@kiwi-weekly/embed?minimal=true"
                      width="480"
                      height="80"
                      frameborder="0"
                      scrolling="no"
                    ></iframe>
                  </div>
                  <p>
                    <b>Kiwi Daily (Editor's Picks, Monday to Friday)</b>
                  </p>
                  <div style="text-align: left;">
                    <iframe
                      src="https://paragraph.xyz/@kiwi-daily/embed?minimal=true"
                      width="480"
                      height="80"
                      frameborder="0"
                      scrolling="no"
                    ></iframe>
                  </div>
                  <p>
                    <b
                      >Real-Time RSS Feeds (maintained by our community member:
                      <span> </span>
                      <a href="warpcast.com/freeatnet" target="_blank"
                        >@freeatnet</a
                      >):</b
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
      </body>
    </html>
  `;
}
