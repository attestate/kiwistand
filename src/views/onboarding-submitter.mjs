//@format
import htm from "htm";
import vhtml from "vhtml";
import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import { custom } from "./components/head.mjs";
const html = htm.bind(vhtml);

export default async function (theme, identity) {
  const ogImage =
    "https://news.kiwistand.com/kiwi_onboarding_submitter_page.png";
  return html`
    <html lang="en" op="news">
      <head>
        ${custom(
          ogImage,
          "Onboard as a link submitter",
          "Share your findings and let everyone know what kind of articles, videos or podcasts you find interesting.",
        )}
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
          ${Sidebar()}
          <div id="hnmain" class="scaled-hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                <td style="padding: 1rem; text-align: center; color: black">
                  <br />
                  <p>
                    <a href="/onboarding-reader"><u>Level I: Reader</u></a>
                  </p>
                  <p>
                    <a href="/onboarding-curator"><u>Level II: Curator</u></a>
                  </p>
                  <h1>Level III: Link Hunter</h1>
                  <br />
                  <br />
                  <br />
                  <div class="flex-container flex-image-right">
                    <div class="text-left">
                      <h2>
                        Submit your first link and start collecting kiwi karma
                      </h2>
                      <p>
                        Share your findings and let everyone know what kind of
                        articles, videos or podcasts you find interesting. Both
                        new & evergreen content is much welcome.
                        <br />While submitting, please be mindful of our<a
                          href="/guidelines"
                          target="_blank"
                          >${" "}<u>Guidelines</u></a
                        >.
                      </p>
                      <a style="display: block;" href="/submit" target="_blank">
                        <button id="button-onboarding" style="margin-right: 0;">
                          Go to Submission page
                        </button></a
                      >
                    </div>
                    <div class="image-right">
                      <img src="kiwi_submit.gif" alt="Kiwi Submit" />
                    </div>
                  </div>
                  <br />
                  <br />
                  <br />
                  <div class="flex-container flex-image-left">
                    <div class="image-left">
                      <img src="kiwi_chrome.gif" alt="Kiwi Chrome" />
                    </div>
                    <div class="text-right">
                      <h2>Get the Kiwi Chrome Extension</h2>
                      <p>
                        Submit links in two clicks with our Chrome Extension.
                      </p>
                      <a
                        href="https://chrome.google.com/webstore/detail/kiwi-news-chrome-extensio/ifchjojjeocdanjhhmbihapfjokljllc"
                        target="_blank"
                      >
                        <button id="button-onboarding" style="margin-right: 0;">
                          Get Extension from Chrome Web Store
                        </button>
                      </a>
                    </div>
                  </div>
                  <br />
                  <br />
                  <br />
                  <div class="flex-container flex-image-right">
                    <div class="text-left">
                      <h2>Grow your Kiwi Score</h2>
                      <p>
                        Every submission and every upvote your links receive
                        give you one Kiwi point. Stand out in our community and
                        become a beloved curator of everyday and evergreen
                        content.
                      </p>
                      <a href="/community" target="_blank">
                        <button id="button-onboarding" style="margin-left: 0;">
                          Check Kiwi leaderboard
                        </button>
                      </a>
                    </div>
                    <div class="image-right">
                      <img src="Leaderboard.png" alt="Kiwi News NFT" />
                    </div>
                  </div>
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
          style="
        display: none;
        position: fixed;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        overflow: auto;
        background-color: rgba(0, 0, 0, 0.4);
      "
        >
          <div
            style="
          background-color: #fefefe;
          margin: 15% auto;
          padding: 20px;
          border: 1px solid #888;
          width: 80%;
        "
          >
            <span
              id="close-modal"
              style="color: #aaa; float: right; font-size: 28px; font-weight: bold"
              >&times;</span
            >
            <p id="bookmark-instructions"></p>
          </div>
        </div>
      </body>
    </html>
  `;
}
