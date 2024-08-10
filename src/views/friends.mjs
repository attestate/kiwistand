//@format

import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import { custom } from "./components/head.mjs";
import * as ens from "../ens.mjs";

async function getENSAvatars(addresses) {
  const avatarData = [];

  for (const address of addresses) {
    const ensData = await ens.resolve(address);

    avatarData.push({
      address,
      avatarUrl: ensData.safeAvatar,
    });
  }

  return avatarData;
}

const addresses = [
  "yashbora.eth",
  "ccarella.eth",
  "mishaderidder.eth",
  "annoushka.eth",
  "cerv1.eth",
];

const avatarData = await getENSAvatars(addresses);

const path = "/kiwipass-mint";

const html = htm.bind(vhtml);

export default async function (theme) {
  const ogImage = "https://news.kiwistand.com/kiwipass_mint_page.png";
  return html`
    <html lang="en" op="news">
      <head>
        ${custom(ogImage)}
        <style>
          .buy-input {
            padding: 5px 10px;
            font-size: 16px;
            margin-bottom: 1rem;
            width: 100% !important;
          }
          /* Base Styles */
          body {
            font-family: Verdana, Geneva, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 0;
          }

          .sidebar-toggle {
            visibility: hidden;
          }

          .kiwipass-mint-page #hnmain {
            border-bottom: none !important;
          }

          #hnmain {
            margin-top: 0;
            margin-bottom: 0;
            border: none;
          }

          .desktop-nav {
            display: none;
          }

          .flex-container {
            display: flex;
            align-items: flex-start; /* Align the top edges of the child elements */
          }

          .text-left,
          .text-right {
            width: 50%;
            flex: 0 0 50%; /* This ensures the flex items don't grow or shrink, and take up 50% of the width */
          }

          .avatar-row {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            align-items: center;
          }

          .avatar-container {
            text-align: center;
            margin: 8px;
            display: block;
          }

          .circular-image {
            width: 35px;
            height: 35px;
            border-radius: 2px;
            border: 1px solid #828282;
          }

          .address {
            font-size: 12px;
          }

          .community-link {
            text-decoration: underline;
          }

          .inner-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }

          .header {
            text-align: center;
            margin-bottom: 20px;
          }

          .header h1 {
            font-size: 1.5rem;
            margin-bottom: 10px;
          }

          .content-container {
            display: flex;
            align-items: center; /* Align items vertically */
          }

          /* Image and Text Related Styles */
          .image-container,
          .text-container {
            flex: 1;
            width: 100%;
          }

          .text-section,
          .image-section,
          .minted-section {
            flex: 1; /* Each section takes up half of the space */
            margin: 1rem;
          }

          .image-section img {
            max-width: 100%; /* Image will now take up at most 100% of the .image-section */
            height: auto; /* Maintain aspect ratio */
          }

          .text-content {
            display: flex;
            flex-direction: column;
            width: 100%;
            font-size: 1rem;
          }

          .text-row {
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid #828282;
            padding: 15px 5px 15px 5px;
          }

          .kiwi-nft {
            max-width: 100%;
            height: auto;
            border-radius: 2px;
          }

          .text-below-button {
            text-align: center; /* Centers the text and image */
          }

          .text-below-button img {
            max-height: 35px; /* Sets the maximum height for the image */
            vertical-align: middle; /* Aligns the image vertically with the text */
          }

          /* Button Styles */
          .friend-buy-button {
            background-color: black;
            border: none;
            color: white;
            padding: 10px 20px;
            text-align: center;
            text-decoration: none;
            display: flex;
            font-size: 0.9rem;
            cursor: pointer;
            border-radius: 2px;
            font-family: Verdana, Geneva, sans-serif;
            justify-content: center;
            align-items: center;
          }

          .friend-buy-button:disabled {
            background-color: grey;
            cursor: not-allowed;
          }

          #friend-buy-button-container div {
            width: 100%;
            display: flex;
            justify-content: center;
          }

          #friend-buy-button-container {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100%;
            margin-top: 3rem;
            flex-direction: column;
          }

          .parent-container {
            display: flex;
            justify-content: space-between; /* Adjusts the spacing between the two sections */
            align-items: center; /* Aligns items vertically in the center */
          }

          /* Media Query for Mobile Devices */
          @media screen and (max-width: 768px) {
            .parent-container {
              flex-direction: column;
            }

            .text-section,
            .image-section {
              flex: none; /* Default sizing */
              width: 100%; /* Full width on small screens */
            }

            .friend-buy-button {
              width: 100%;
              margin-right: 0;
              font-size: 1.2 rem;
            }

            .flex-container {
              flex-direction: column;
            }

            .avatar-row {
              justify-content: space-around;
            }

            .avatar-container {
              flex: 0 0 auto;
              width: 50px;
            }

            .circular-image {
              width: 30px;
              height: 30px;
            }

            .address {
              font-size: 8px;
            }

            .text-section {
              text-align: center;
            }
          }

          .hide-on-mobile {
            display: none;
          }

          @media screen and (min-width: 769px) {
            .avatar-row {
              flex-wrap: nowrap; /* Prevents wrapping of items */
            }

            .avatar-container {
              display: block;
            }

            .friend-buy-button {
              width: 100%;
              font-size: 2rem; /* Increase font size */
              padding: 15px 25px; /* Increase padding */
              /* Optional: Adjust the width and height if needed */
            }
            .sidebar {
              display: none;
            }
            .image-section img {
              width: 80%;
            }
            h2 {
              font-size: 2.5rem;
            }
          }
        </style>
        <meta property="eth:nft:collection" content="Kiwi Curator's Pass" />
        <meta
          property="eth:nft:contract_address"
          content="0xebb15487787cbf8ae2ffe1a6cca5a50e63003786"
        />
        <meta
          property="eth:nft:creator_address"
          content="0xee324c588cef1bf1c1360883e4318834af66366d"
        />
        <meta property="eth:nft:schema" content="erc721" />
        <meta
          property="eth:nft:media_url"
          content="https://news.kiwistand.com/pass.jpeg"
        />
        <meta property="eth:nft:mint_status" content="live" />
        <meta property="eth:nft:chain" content="ethereum" />
      </head>
      <body class="kiwipass-mint-page">
        <div class="container">
          <div class="sidebar">${Sidebar()}</div>
          <div id="hnmain" style="width: 100%;">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme, path)}
              </tr>
              <tr>
                <td style="padding: 1rem; color: black;">
                  <div class="parent-container">
                    <div
                      class="image-section"
                      style="display: flex; flex-direction: column; align-items: center;"
                    >
                      <h2 style="font-size: 2rem; text-align: center;">
                        Invite a friend
                      </h2>
                      <img src="KiwiPass.png" alt="Kiwi Pass" />
                    </div>
                    <div class="text-section">
                      <div id="friend-buy-button-container">
                        <input
                          type="text"
                          class="buy-input"
                          placeholder="Your friend's address or ENS"
                        />
                        <button class="friend-buy-button" disabled>
                          Loading...
                        </button>
                      </div>
                      <br />
                      <p class="text-below-button">
                        on <img src="OP-logo.svg" alt="OP Logo" /> powered
                        by<span> </span>
                        <u
                          ><a
                            target="_blank"
                            rel="noopener noreferrer"
                            href="https://zora.co/collect/oeth:0x66747bdc903d17c586fa09ee5d6b54cc85bbea45"
                            ><img
                              src="ZORA-logo.svg"
                              alt="ZORA Logo"
                              style="height: 20px;"
                            /> </a
                        ></u>
                      </p>
                    </div>
                  </div>
                  <br />
                </td>
              </tr>
            </table>
            <div style="display: none;">${Footer(theme)}</div>
          </div>
        </div>
      </body>
    </html>
  `;
}
