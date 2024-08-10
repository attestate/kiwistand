//@format

import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import { custom } from "./components/head.mjs";

const html = htm.bind(vhtml);

export default async function (theme) {
  const title = "What to submit";
  const description =
    "Never miss great content with our Kiwi app. Onboard to Kiwi News as a reader by following these five steps.";
  return html`
    <html lang="en" op="news">
      <head>
        ${custom(null, title, description)}
        <style>
          @media screen and (min-width: 769px) {
            .sidebar {
              display: none;
            }

            #hnmain {
              border: none;
            }
          }
          #hnmain {
            border: none;
            margin-top: 0;
            margin-bottom: 0;
          }
          .sidebar,
          .desktop-nav {
            display: none;
          }
          .sidebar-toggle {
            visibility: hidden;
          }
          .flex-container {
            display: flex;
            align-items: flex-start; /* Align the top edges of the child elements */
          }

          .text-left,
          .text-right {
            padding-top: 1rem;
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
          ${Sidebar()}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr style="background-color: rgb(246, 246, 239);">
                <td style="padding: 1rem; text-align: center; color: black;">
                  <h1>What to submit</h1>
                  <br />
                  <br />
                  <div class="flex-container flex-image-left">
                    <div class="image-left">
                      <img
                        style="background-color: rgba(0,0,0,0.1); border-radius: 2px; border: 1px solid #828282;"
                        src="crypto-aligned.png"
                      />
                    </div>
                    <div class="text-right">
                      <h2>Share stories about crypto culture</h2>
                      <p>
                        We love stories about crypto's culture. What happened
                        the other day on Farcaster? What's the deeper meaning
                        behind memecoins?
                      </p>
                    </div>
                  </div>
                  <br />
                  <br />
                  <div class="flex-container flex-image-right">
                    <div class="text-left">
                      <h2>AI tells and we listen...</h2>
                      <p>
                        Apps like Readwise Reader, Omnivore and Substack now
                        allow anyone to listen to articles. That's why we love
                        long stories that open up new perspectives.
                      </p>
                    </div>
                    <div class="image-right">
                      <img
                        style="background-color: rgba(0,0,0,0.1); border-radius: 2px; border: 1px solid #828282;"
                        src="text-to-speech.png"
                      />
                    </div>
                  </div>
                  <br />
                  <br />
                  <div class="flex-container flex-image-left">
                    <div class="image-left">
                      <img
                        style="border-radius: 2px; border: 1px solid #828282;"
                        src="bell-curve.png"
                      />
                    </div>
                    <div class="text-right">
                      <h2>Left or right-curve it!</h2>
                      <p>
                        We're news junkies and so the average headlines won't do
                        it for us. We want to read about original ideas and
                        expand our horizon.
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td>
                  <p
                    style="color: black; padding: 1rem 3rem 1rem 3rem; font-size: 1rem; text-align: center; margin-top: 1rem;"
                  >
                    Your next step:
                  </p>
                </td>
              </tr>
              <tr>
                <td
                  style="padding: 0 0 3rem 0; display: flex; justify-content: space-evenly;"
                >
                  <a href="/onboarding-reader">
                    <button style="width:auto;" id="button-onboarding">
                      Explore Kiwi
                    </button>
                  </a>
                </td>
              </tr>
            </table>
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
