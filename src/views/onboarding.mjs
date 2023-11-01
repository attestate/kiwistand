//@format

import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";

const html = htm.bind(vhtml);

export default async function (theme, identity) {
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
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
                  <h1>
                    Thanks for joining Kiwi. <br />
                    This is how to get 100% from it.
                  </h1>
                  <img
                    src="kiwi-website.png"
                    alt="Kiwi News NFT"
                    style="height: 200px; width: auto;"
                  />
                  <br />
                  <br />
                  <br />
                  <h1>Level I</h1>
                  <br />
                  <br />
                  <br />
                  <div class="flex-container flex-image-right">
                    <div class="text-left">
                      <h2>Mint Kiwi Pass to join the Kiwi community</h2>
                      <p>
                        Shape the kiwi feed, get discovered by 1,200+ monthly
                        readers & meet 150+ other crypto connoisseurs. Get all
                        that for an early adopter price - just $10.
                      </p>
                      <a href="/KiwiPass" target="_blank">
                        <button
                          id="button-onboarding"
                          style="margin-left: 0; width: 40%;"
                        >
                          Mint Kiwi Pass for around $10 (0.0007 ETH)
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
                      <h2>Join our Kiwi holders Telegram channel.</h2>
                      <p>
                        Discuss the project, links and anything you’d like to
                        chat about on our Telegram Channel. Join us and say gm!
                      </p>
                      <p>Message @timdaub or @macbudkowski to get invited!</p>
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
                  <h1>Level II</h1>
                  <br />
                  <br />
                  <br />
                  <div class="flex-container flex-image-right">
                    <div class="text-left">
                      <h2>Submit your first link</h2>
                      <p>
                        Share your findings and let everyone know what kind of
                        readings, videos or podcasts you find interesting.
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
                    <div class="image">
                      <img
                        src="kiwi_bookmark.gif"
                        alt="Kiwi Bookmark"
                        style="height: 300px; width: auto;"
                      />
                    </div>
                    <div class="text-right">
                      <h2>Install our progressive web app!</h2>
                      <p>
                        On iPhone (Safari) and Android (Chrome) we're offering
                        users to install our progressive web app. This will make
                        Kiwi News look like any other app on your phone!
                      </p>
                      <button
                        id="button-onboarding"
                        style="margin-right: 0;"
                        onclick="window.dispatchEvent(new CustomEvent('openModal'));"
                      >
                        Install app (only on iPhone (Safari) or Android
                        (Chrome))
                      </button>
                    </div>
                  </div>

                  <br />
                  <br />
                  <br />
                  <div class="flex-container flex-image-right">
                    <div class="text-left">
                      <h2>Subscribe to our newsletters or RSS</h2>
                      <p>
                        If you don’t want to miss the best links of the day or
                        week, check options to subscribe.
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
                  <h1>Level III</h1>
                  <br />
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
                        Submit links in one click with our Chrome Extension.
                      </p>
                      <a
                        href="https://chrome.google.com/webstore/detail/kiwi-news-chrome-extensio/ifchjojjeocdanjhhmbihapfjokljllc"
                        target="_blank"
                      >
                        <button id="button-onboarding" style="margin-right: 0;">
                          Check our Extension
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
                  ${identity
                    ? html`<div style="text-align: left;">
                          <h2>Earn Protocol Rewards!</h2>
                          <p>
                            Reading together is more fun than alone! So invite
                            your friends and earn Zora's Protocol Rewards!
                            0.000222 ETH per referred mint!
                          </p>
                          <div style="display: flex; align-items: center;">
                            <button
                              onclick="document.getElementById('invitelink').select(); document.execCommand('copy');"
                              id="button-onboarding"
                              style="border-radius: 2px; padding: 10px 15px; background-color: black; border: 1px
 solid black; color: white; cursor: pointer; width: 50%; margin-right: 10px;"
                            >
                              Copy invite link
                            </button>
                            <input
                              id="invitelink"
                              type="text"
                              value="https://news.kiwistand.com/welcome?referral=${identity}"
                              readonly
                              style="width: 70%; padding: 10px 15px; border: 1px solid #ccc; border-radius: 2px;"
                            />
                          </div>
                        </div>
                        <br />
                        <br />
                        <br />`
                    : ""}
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
