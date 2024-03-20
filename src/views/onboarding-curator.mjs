//@format

import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import { custom } from "./components/head.mjs";
import * as ens from "../ens.mjs";

const html = htm.bind(vhtml);

export default async function (theme, identity) {
  const ogImage = "https://news.kiwistand.com/kiwi_onboarding_curator_page.png";
  const title = "Onboard as a curator";
  const description =
    "Mint the Kiwi pass and help to curate our front page by upvoting the most important crypto stories of the day.";
  let ensData;
  if (identity) {
    ensData = await ens.resolve(identity);
  }
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
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme, identity)}
              </tr>
              <tr>
                <td style="padding: 1rem; text-align: center; color: black;">
                  <br />
                  <p>
                    <a href="/onboarding-reader"><u>Level I: Reader</u></a>
                  </p>
                  <h1>Level II: Curator</h1>
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
                      <h2>Mint Kiwi Pass to join the Kiwi community</h2>
                      <p>
                        Shape the kiwi feed, get discovered by 1,500+ monthly
                        readers & meet 800+ other crypto connoisseurs.
                      </p>
                      <a
                        href="/kiwipass?referral=0x9fa714F170E9488F70536d947003308eBd1A2bbD"
                        target="_blank"
                      >
                        <button
                          id="button-onboarding"
                          style="margin-left: 0; width: 40%;"
                        >
                          Mint Kiwi Pass
                        </button>
                      </a>
                    </div>
                    <div class="image-right">
                      <img src="KiwiPass.png" />
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
                        Discuss the project, content and anything you’d like to
                        chat about on our Telegram Channel. Join us and say gm!
                      </p>
                      <p>
                        Message @timdaub or @macbudkowski to get invited!
                        <br />
                        (You need to hold Kiwipass to join the chat)
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
                      <h2>Test your Kiwi superpowers</h2>
                      <p>
                        Use your Kiwipass superpowers to upvote links. Check the
                        most popular links of the last month and upvote the ones
                        you find interesting.
                        <br />
                        <br />While upvoting, please be mindful of our<a
                          href="/guidelines"
                          target="_blank"
                          >${" "}<u>Guidelines</u></a
                        >.
                      </p>
                      <a
                        style="display: block;"
                        href="/best?period=month"
                        target="_blank"
                      >
                        <button id="button-onboarding" style="margin-right: 0;">
                          Upvote your first link
                        </button></a
                      >
                    </div>
                    <div class="image-right">
                      <img src="Top-links.png" alt="Kiwi Top links" />
                    </div>
                  </div>
                  <br />
                  <br />
                  <br />
                  ${ensData
                    ? html`<div class="flex-container flex-image-left">
                          <div class="image-left">
                            <img src="kiwi-profile.png" />
                          </div>
                          <div class="text-right">
                            <h2>Check your Kiwi profile</h2>
                            <p>
                              We pull the data, links & avatar from your ENS and
                              Farcaster so that people can get to know you. When
                              you submit your first links, they'll show up on
                              your profile.
                            </p>
                            <a href="/${ensData.displayName}" target="_blank">
                              <button
                                id="button-onboarding"
                                style="margin-left: 0; width: 40%;"
                              >
                                Check your Kiwi profile
                              </button>
                            </a>
                          </div>
                        </div>
                        <br />
                        <br />
                        <br />`
                    : ""}
                  <h1>Ready to explore Kiwi Level III?</h1>
                  <a href="/onboarding-submitter">
                    <button id="button-onboarding" style="margin-left: 0;">
                      Check Level III: Link Hunter
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
          </div>
        </div>
        ${Footer(theme)}
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
