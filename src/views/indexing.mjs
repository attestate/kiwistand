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
                    style="display: flex; flex-direction: column; align-items: center; justify-content: start; height: 100vh; text-align: center;"
                  >
                    <h1 style="color: limegreen; margin-bottom: 1rem;">
                      Minting in Progress
                    </h1>
                    <div
                      style="border: 16px solid #e6e6df; border-top: 16px solid limegreen; border-radius: 50%; width: 25vmin; height: 25vmin; animation: spin 2s linear infinite;"
                    ></div>
                    <h2 style="color: limegreen; margin: 2rem 0;">
                      Please keep this page open while we confirm your
                      transaction.
                    </h2>
                    <p
                      style="color: black; max-width: 600px; margin-bottom: 2rem;"
                    >
                      <strong>Confirmation usually takes a few minutes.</strong>
                      <br />
                      Meanwhile, you can explore additional content or share
                      your action with the community.
                    </p>
                    <a
                      href="https://warpcast.com/~/compose?text=I+just+minted+a+@kiwi&embeds[]=https://news.kiwistand.com/kiwipass"
                      target="_blank"
                    >
                      <button
                        style="background-color: #472a91; color: white; border: none; padding: 10px 20px; margin-bottom: 1rem;"
                      >
                        Share on Warpcast
                      </button>
                    </a>
                    <a
                      href="https://twitter.com/intent/tweet?url=https%3A%2F%2Fnews.kiwistand.com%2Fkiwipass&text=I%20just%20minted%20a%20kiwi%21"
                      target="_blank"
                    >
                      <button
                        style="background-color: black; color: white; border: none; padding: 10px
 20px;"
                      >
                        Tweet on X
                      </button>
                    </a>
                    <a
                      href="/onboarding"
                      style="margin-top: 10px; color: #472a91; text-decoration: underline; margin-bottom:
 1rem;"
                      >Explore More Content</a
                    >
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
