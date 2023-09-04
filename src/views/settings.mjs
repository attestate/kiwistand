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
                    From now on you can submit and upvote links without
                    confirming them in your wallet.
                    <br />
                    <br />
                    Thanks to that using Kiwi is going to feel like using
                    Warpcast or a web2 app. You just need to click the button
                    below and delegate posting authority. It's safe and works
                    like magic.
                    <br />
                    <br />
                    <span
                      >If you want to learn how it works under the hood, check
                    </span>
                    <span> </span>
                    <u
                      ><a
                        href="https://www.loom.com/share/244e444db3444cc3b50376d38e72bd69"
                        target="_blank"
                      >
                        Tim's Loom video.</a
                      ></u
                    >
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
          </div>
        </div>
        ${Footer(theme)}
      </body>
    </html>
  `;
}
