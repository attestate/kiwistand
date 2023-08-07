//@format
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";

const html = htm.bind(vhtml);

export default function (theme) {
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
      </head>
      <body>
        <div class="container">
          ${Sidebar}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${Header(theme)}
              </tr>
              <tr>
                <td>
                  <div style="padding: 20px;">
                    <h2><b>Learn more about Kiwi</b></h2>
                    <p>
                      <b>Why we are building Kiwi:</b>
                      <br />
                      <a style="color: black;" href="/why"><u>/why</u></a>
                    </p>
                    <p>
                      <b>How to get involved:</b>
                      <br />
                      <a style="color: black;" href="/welcome"
                        ><u>/welcome</u></a
                      >
                    </p>
                    <p>
                      <b>Submission guidelines:</b>
                      <br />
                      <a
                        style="color: black;"
                        target="_blank"
                        href="https://hackmd.io/a-r--DX2T5uEEKX0Z8PRlQ?view"
                        ><u>https://hackmd.io/a-r--DX2T5uEEKX0Z8PRlQ?view</u></a
                      >
                    </p>
                    <p>
                      <b>Our current plans:</b>
                      <br />
                      <a
                        style="color: black;"
                        target="_blank"
                        href="https://hackmd.io/egIZnDStR8-zUtQuTUrxyw"
                        ><u>Kiwi News Season 2</u></a
                      >
                    </p>
                    <p>
                      <b>Feature Requests:</b>
                      <br />
                      <a
                        style="color: black;"
                        target="_blank"
                        href="https://kiwinews.sleekplan.app/"
                        ><u>https://kiwinews.sleekplan.app/</u></a
                      >
                    </p>
                    <p>
                      <b>Economics:</b>
                      <br />
                      <a
                        style="color: black;"
                        target="_blank"
                        href="https://hackmd.io/zmZsDW-XTsizJzChl1n3WA?view"
                        ><u>Dynamic Pricing for Kiwi NFT</u></a
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
