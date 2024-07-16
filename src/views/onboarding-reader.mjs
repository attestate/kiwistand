//@format

import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import { custom } from "./components/head.mjs";

const html = htm.bind(vhtml);

export default async function (theme, identity) {
  const ogImage = "https://news.kiwistand.com/kiwi_onboarding_reader_page.png";
  const title = "Onboard as a Reader";
  const description =
    "Never miss great content with our Kiwi app. Onboard to Kiwi News as a reader by following these five steps.";
  return html`
    <html lang="en" op="news">
      <head>
        ${custom(ogImage, title, description)}
        <style>
          .flex-container {
            display: flex;
            align-items: flex-start; /* Align the top edges of the child elements */
          }

          .text-left,
          .text-right {
            width: 50%;
            flex: 0 0 50%; /* This ensures the flex items don't grow or shrink, and take up 50% of the width */
          }

          .image {
            margin: 0 15px;
            width: 50%;
          }

          .centered-image {
            display: flex;
            justify-content: center;
            align-items: center;
          }

          /* Mobile styles */
          @media (max-width: 768px) {
            .flex-container {
              flex-direction: column;
            }

            .text-right button {
              text-align: center; /* Aligns buttons to the center within .text-right class */
              margin-left: auto;
              margin-right: auto;
              display: block;
            }

            .flex-image-left .image,
            .flex-image-right .image,
            .text-left,
            .text-right {
              text-align: center; /* Aligns text and buttons to the center */
              margin: 15px 0;
              width: 100%; /* Set width to 100% on smaller screens */
            }

            .flex-image-left .image,
            .flex-image-right .image {
              order: 0; /* Place the image first */
            }

            .flex-image-left .text-right,
            .flex-image-right .text-left {
              order: 1; /* Place the text after the image */
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          ${Sidebar("/onboarding-reader")}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                <td style="padding: 1rem; text-align: center; color: black;">
                  <h1>Improve your crypto content diet with Kiwi</h1>
                  <img
                    src="kiwi-website.png"
                    alt="Kiwi News NFT"
                    style="height: 100px; width: auto;"
                  />
                  <br />
                  <br />
                  <br />
                  <h1>Level I: Reader</h1>
                  <p>
                    <a href="/onboarding-curator"><u>Level II: Curator</u></a>
                  </p>
                  <p>
                    <a href="/onboarding-submitter"
                      ><u>Level III: Link Hunter</u></a
                    >
                  </p>
                  <br />
                  <br />
                  <br />
                  <div class="flex-container flex-image-right">
                    <div class="text-left">
                      <h2>Never miss great content with Kiwi app</h2>
                      <p>
                        On iPhone (Safari) and Android (Chrome/Brave) you can
                        install our Progressive Web App (PWA). This will make
                        Kiwi News look like any other app on your phone!
                      </p>
                    </div>
                    <div class="image centered-image">
                      <img
                        src="kiwi_bookmark.gif"
                        alt="Kiwi Bookmark"
                        style="height: 300px; width: auto;"
                      />
                    </div>
                  </div>
                  <br />
                  <br />
                  <br />
                  <div class="flex-container flex-image-left">
                    <div class="image-left">
                      <img src="Telegram.png" />
                    </div>
                    <div class="text-right">
                      <h2>
                        Share and discuss content with fellow crypto builders
                      </h2>
                      <p>
                        Discuss the content, project and anything you’d like to
                        chat about on our Telegram Channel. Join us and say gm!
                      </p>
                      <p>
                        Message @timdaub or @macbudkowski if you have issues
                        with your invite!
                        <br />
                        (You need to hold
                        <span>
                          <a href="/kiwipass" target="_blank"
                            >${" "}<u>Kiwipass</u></a
                          >${" "}
                        </span>
                        to join the chat)
                      </p>
                      <a href="https://t.me/macbudkowski" target="_blank">
                        <button
                          id="button-onboarding"
                          style="margin-left: 0; width: 40%;"
                        >
                          @macbudkowski
                        </button>
                      </a>
                      <a href="https://t.me/timdaub" target="_blank">
                        <button
                          id="button-onboarding"
                          style="margin-left: 1rem; width: 40%;"
                        >
                          @timdaub
                        </button>
                      </a>
                    </div>
                  </div>
                  <br />
                  <br />
                  <br />
                  <div class="flex-container flex-image-right">
                    <div class="text-left">
                      <h2>
                        Get top Kiwi links delivered to your e-mail, Twitter,
                        Farcaster or RSS reader
                      </h2>
                      <p>
                        If you don’t want to miss the best links of the day or
                        week, you can subscribe to a newsletter, follow our
                        Twitter and Farcaster bots or use our RSS feeds.
                      </p>
                      <a href="/subscribe" target="_blank">
                        <button id="button-onboarding" style="margin-left: 0;">
                          Check subscription options
                        </button>
                      </a>
                    </div>
                    <div class="image-right">
                      <img src="Newsletter.png" alt="Kiwi Newsletter" />
                    </div>
                  </div>
                  <br />
                  <br />
                  <br />
                  <h1>Ready to explore Kiwi Level II?</h1>
                  <a href="/onboarding-curator">
                    <button id="button-onboarding" style="margin-left: 0;">
                      Check Level II: Curator
                    </button>
                  </a>

                  <br />
                  <br />
                  <br />
                  <p>
                    If you had any questions, feel free to reach out to
                    @macbudkowski or @timdaub on Telegram!
                  </p>
                  <br />
                </td>
              </tr>
            </table>
            ${Footer(theme)}
          </div>
        </div>
        <div
          id="bookmark-modal"
          style="display: none; position: fixed; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.4);"
        >
          <div
            style="background-color: #fefefe; margin: 15% auto; padding: 20px; border: 1px solid #888; width: 80%;"
          >
            <span
              id="close-modal"
              style="color: #aaa; float: right; font-size: 28px; font-weight: bold;"
              >&times;</span
            >
            <p id="bookmark-instructions"></p>
          </div>
        </div>
      </body>
    </html>
  `;
}
