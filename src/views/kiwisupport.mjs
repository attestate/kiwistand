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
  "realcameron.eth",
  "x0r.eth",
  "pugson.eth",
];

const avatarData = await getENSAvatars(addresses);

const html = htm.bind(vhtml);

export default async function (theme) {
  const ogImage = "https://news.kiwistand.com/pass_preview.jpeg";
  return html`
    <html lang="en" op="news">
      <head>
        ${custom(ogImage)}
        <style>
        /* Base Styles */
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          margin: 0;
          padding: 0;
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
          margin: 10px;
        }
      
        .circular-image {
          width: 35px;
          height: 35px;
          border-radius: 50%;
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
          
        .text-section, .image-section {
            flex: 1; /* Each section takes up half of the space */
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
          border-bottom: 1px solid #000;
          padding: 15px 5px 15px 5px;
        }
      
        .kiwi-nft {
          max-width: 100%;
          height: auto;
          border-radius: 3px;
        }
      
        /* Button Styles */
        .buy-button {
          background-color: black;
          border: none;
          color: white;
          padding: 10px 20px;
          text-align: center;
          text-decoration: none;
          display: inline-block;
          font-size: 0.9rem;
          cursor: pointer;
          border-radius: 3px;
          font-family: "Helvetica", "Arial", sans-serif;
        }
      
        .buy-button:disabled {
          background-color: grey;
          cursor: not-allowed;
        }

        .parent-container {
            display: flex;
            justify-content: space-between; /* Adjusts the spacing between the two sections */
            align-items: center; /* Aligns items vertically in the center */
          }
      
        /* Media Query for Mobile Devices */
        @media screen and (max-width: 768px) {

            .parent-container {
            flex-direction: column; /* Stack vertically on small screens */
              }
            
            .text-section, .image-section {
                flex: none; /* Default sizing */
                width: 100%; /* Full width on small screens */
              }
            
              .buy-button { 
                width: 100%; 
                margin-right: 0; 
                height: 60px;
                font-size: 1.2 rem;
              }

        .minted-text {
            text-align: center;
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

        @media screen and (min-width: 769px) {
            .avatar-row {
              width: 50%; /* Half of the screen width */
              /* Additional styles here to align it as needed, e.g., margin, padding */
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
      <body>
        <div class="container">
          ${Sidebar()}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                <td style="padding: 1rem; color: black;">
                <div class="parent-container">
                <div class="text-section">
                  <h2>Kiwipass mint supports us for 1 month by default</h2>
                  <h3>If you like Kiwi you can support us for more months</h3>
                </div>
                <div class="image-section">
                  <img src="Kiwi-website.png" alt="Kiwi Smiling" />
                </div>
                </div>
                <br />
                    <div class="full-width-container">
                    <div>
                    <button id="decrementButton">-</button>
                    <span id="supportMonthsDisplay">1</span> month(s)
                    <button id="incrementButton">+</button>
                  </div>
                    <div class="minted-text">Top supporters</div>
                    <div class="avatar-row">
                      ${avatarData.map(
                        (data) => html`
                          <div class="avatar-container">
                            <img
                              class="circular-image"
                              src="${data.avatarUrl}"
                              alt="${data.address}"
                            />
                            <div class="address">${data.address}</div>
                          </div>
                        `,
                      )}
                      <div>
                        <a class="community-link" href="/community" target="_blank">
                          & 800+ more
                        </a>
                      </div>
                    </div> 
                    </div> 
                    <br />
                  <div class="full-width-container">
                      <a href="#mint-dialogue">
                      <button class="buy-button">
                      Mint Kiwi Pass:
                      <span><nft-price data-fee="0.000777" /></span>
                    </button>
                      </a>
                    </div>            
                  <br />
                  <div
      style="margin: 1rem; border: 1px solid rgba(0,0,0,0.05); border-radius: 5px; background-color: rgba(0,0,0,0.05); padding: 1rem; box-shadow: 0px 4px 8px rgba(0,0,0,0.2);"
    >
                    <p><h3>5 reasons to mint Kiwipass:</h3>
                    <ul>
                      <li>
                        Shape the Kiwi feed by submitting and upvoting links.
                      </li>
                      <li>Get discovered by 1,600+ monthly readers.</li>
                      <li>
                        Meet 300+ other crypto connoisseurs on our Telegram
                        chat.
                      </li>
                      <li>Vote who gets ETH from Kiwi grants.</li>
                      <li>
                        Take part in building the product you use.</li></ul>
                        Get all that for an early adopter price. Or if you're still not convinced, <u><a href="https://news.kiwistand.com/kiwipass" target="_blank">learn more about the utility</a></u>.
                      </p>
                  </div>
                </td>
              </tr>
            </table>
          </div>
        </div>
        ${Footer(theme)}
      </body>
    </html>
  `;
}
