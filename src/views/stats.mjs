//@format
import { env } from "process";
import url from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";

import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import Sidebar from "./components/sidebar.mjs";
import Head from "./components/head.mjs";

const html = htm.bind(vhtml);

export default async function (trie, theme) {
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
                ${await Header(theme)}
              </tr>
              <tr>
                <td style="padding: 20px;">
                  <h2>PROTOCOL CHARTS</h2>
                  <p>
                    - The stats have been split into multiple themed sites.
                    <br />
                    - You can reach them by clicking the links below
                  </p>
                  <ul style="text-decoration: underline;">
                    <li>
                      <a href="/basics">Basics</a>
                    </li>
                    <li>
                      <a href="/price">Price</a>
                    </li>
                    <li>
                      <a href="/users">Users</a>
                    </li>
                    <li>
                      <a href="/retention">Retention</a>
                    </li>
                  </ul>
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
