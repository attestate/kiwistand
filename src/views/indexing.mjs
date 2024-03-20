//@format
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";

const html = htm.bind(vhtml);

const path = "/indexing";

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

          .container {
            width: 100%;
            box-sizing: border-box;
          }

          #hnmain {
            width: 100%;
          }

          @media screen and (min-width: 769px) {
            .sidebar {
              display: none;
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
                ${await Header(theme, path)}
              </tr>
              <tr>
                <td>
                  <div
                    style="display: flex; flex-direction: column; align-items: center; justify-content: start; height: 100vh; text-align: center;"
                  >
                    <h1
                      style="max-width: 720px; 
                    margin-left: auto;
                    margin-right: auto;
                    text-align: center;
                    color: black;margin-top: 4rem; margin-bottom: 4rem;"
                    >
                      You minted
                      <span style="color: limegreen;"> a Kiwi Pass 🎉</span>
                    </h1>
                    <h1
                      style="color: black; text-align: center; margin-top: 30px;"
                    >
                      Share
                    </h1>
                    <div
                      style="margin: 1rem; display:flex; justify-content:center; align-items:center;"
                    >
                      <a
                        href="https://warpcast.com/~/compose?text=I+just+minted+a+@kiwi&embeds[]=https://news.kiwistand.com/kiwipass-mint?referral=${userAddress}"
                        target="_blank"
                        style="display: inline-flex; justify-content: center; align-items: center; margin-right: 1rem;"
                      >
                        <img
                          src="farcaster_logo.svg"
                          alt="Farcaster"
                          style="width: 50px; height: 50px;"
                        />
                      </a>
                      <a
                        href="https://twitter.com/intent/tweet?url=https%3A%2F%2Fnews.kiwistand.com%2Fkiwipass-mint?referral=${userAddress}&text=I%20just%20minted%20a%20kiwi%21"
                        target="_blank"
                        style="display: inline-flex; justify-content: center; align-items: center; margin-right: 1rem;"
                      >
                        <img
                          src="x_logo.svg"
                          alt="X"
                          style="width: 50px; height: 50px;"
                        />
                      </a>
                      <a
                        href="https://t.me/share/url?url=https%3A%2F%2Fnews.kiwistand.com%2Fkiwipass-mint?referral=${userAddress}&text=I%20just%20minted%20a%20kiwi"
                        target="_blank"
                        style="display: inline-flex; justify-content: center; align-items: center;"
                      >
                        <img
                          src="telegram_logo.svg"
                          alt="Telegram"
                          style="width: 50px; height: 50px;"
                        />
                      </a>
                    </div>
                    <div
                      style="margin: 1rem; display: flex; flex-direction: column; align-items: center; justify-content: center;"
                    >
                      <div
                        style="display: flex; justify-content: center; width: 25rem; margin-bottom: 1rem;"
                      >
                        <input
                          id="invitelink"
                          type="text"
                          value="https://news.kiwistand.com/kiwipass-mint?referral=${userAddress}"
                          readonly
                          style="width: 100%; max-width: 1200px; padding: 10px; background-color: #E8E8DF; font-size: 0.8rem; border-radius: 2px; border: none;"
                        />
                        <button
                          onclick="document.getElementById('invitelink').select(); document.execCommand('copy');"
                          style="padding: 10px 15px; background-color: black; color: white; cursor: pointer; font-size: 1.2rem; font-weight: bold; border-radius: 2px; border: none; margin-left: 10px;"
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    <div
                      style="position: fixed; right: 20px; bottom: 20px; z-index: 100; text-align: center;"
                    >
                      <button
                        style="background-color: grey; color: white; padding: 0.5rem 1rem; display: inline-flex; align-items: center; justify-content: center; gap: 10px; font-size: 1.2rem; cursor: pointer; border-radius: 2px;"
                      >
                        Next
                        <span
                          style="border: 4px solid #fff; border-top: 4px solid limegreen; border-radius: 50%; width: 20px; height: 20px; animation: spin 2s linear infinite;"
                        ></span>
                      </button>
                      <p>
                        We are indexing your NFT, <br />it might take 3-5
                        minutes
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            </table>
          </div>
        </div>
        <div style="display: none;">${Footer(theme, "/indexing")}</div>
      </body>
    </html>
  `;
}
