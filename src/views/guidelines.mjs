//@format
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
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
        <center>
          <table
            id="hnmain"
            border="0"
            cellpadding="0"
            cellspacing="0"
            width="85%"
            bgcolor="#f6f6ef"
          >
            <tr>
              ${Header(theme)}
            </tr>
            <tr>
              <td>
                <a href="https://hackmd.io/a-r--DX2T5uEEKX0Z8PRlQ?view"
                  >Guidelines have moved here</a
                >
              </td>
            </tr>
          </table>
          ${Footer(theme)}
        </center>
      </body>
    </html>
  `;
}
