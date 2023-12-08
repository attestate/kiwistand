//@format
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";

const html = htm.bind(vhtml);

export default async function (theme, userAddress, transactionHash) {
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
                ${await Header(theme)}
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
                      We're looking for your Kiwi onchain!
                    </h3>
                    <p style="color: black; text-align: left; padding: 0 2rem;">
                      <b
                        >This can take 3 or 5 minutes, so maybe grab a coffee or
                        kiwi in the meantime :D
                      </b>
                      <span> </span>
                      This page automatically redirects...
                      <br />
                      <br />
                      In the mean time, check what you can do here!
                      <br />
                      <br />
                      <a href="/onboarding" target="_blank">
                        <button style="width:auto;" id="button-onboarding">
                          Explore Kiwi News
                        </button>
                      </a>
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
