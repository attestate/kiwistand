//@format
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";

const html = htm.bind(vhtml);

export default function (theme, userAddress, transactionHash) {
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
        <style>
          @keyframes spin {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
        </style>
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
                  <div
                    style="flex-direction: column; height: 100vh; display: flex; align-items: center;"
                  >
                    <h1
                      style="color: black; align-self: center; margin-top: 2rem;"
                    >
                      Thanks for minting!
                    </h1>
                    <div
                      style="border: 16px solid #e6e6df;
      border-top: 16px solid limegreen;
      border-radius: 50%;
      width: 25vmin;
      height: 25vmin;
      animation: spin 2s linear infinite;
  "
                    ></div>
                    <h3
                      style="color: black; align-self: center; margin-top: 2rem;"
                    >
                      Please give us a moment...
                    </h3>
                    <p style="color: black; text-align: left; padding: 0 2rem;">
                      We're looking for your Kiwi Pass onchain! As soon as we
                      find it, this page will redirect...
                      <br />
                      <br />
                      <a
                        href="https://optimistic.etherscan.io/tx/${transactionHash}"
                        target="_blank"
                        >Your transaction on Etherscan</a
                      >
                    </p>
                  </div>
                </td>
              </tr>
            </table>
          </div>
        </div>
        ${Footer(theme, "/indexing")}
      </body>
    </html>
  `;
}
