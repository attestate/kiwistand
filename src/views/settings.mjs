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
        ${Sidebar}
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
                <p style="color: black; padding: 5px; font-size: 14pt;">
                  <b>SETTINGS</b>
                </p>
                <p
                  style="color: black; padding: 7px 7px 15px 7px; font-size: 12pt;"
                >
                  <b>Delegation: </b> From now on you can submit and upvote
                  links without confirming them in your wallet. To do that you
                  need to delegate posting authority. The keys are only used for
                  Kiwi News and will be stored in your browser. We use the same
                  mechanism as Warpcast.
                  <br />
                  <br />
                  PS: Don’t worry if you have enough ETH on Optimism - we
                  airdropped you some so you can do it easily.
                  <br />
                  <br />
                  <delegate-button />
                </p>
              </td>
            </tr>
          </table>
          ${Footer(theme)}
        </center>
      </body>
    </html>
  `;
}
