//@format

import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import { custom } from "./components/head.mjs";
import SecondHeader from "./components/secondheader.mjs";

const path = "/kiwipass-mint";

const html = htm.bind(vhtml);

const ogImage = "https://news.kiwistand.com/kiwipass_mint_page.png";

export default async function (theme) {
  const html = htm.bind(vhtml);

  return html`
    <html lang="en" op="news">
      <head>
        ${custom(ogImage)}
        <meta property="eth:nft:collection" content="Kiwi Pass" />
        <meta property="eth:nft:schema" content="erc721" />
        <meta property="eth:nft:mint_status" content="live" />
      </head>
      <body ontouchstart="">
        <style>
          .kiwipass-mint-page #hnmain {
            border-bottom: none !important;
          }
          #hnmain {
            margin: 0;
          }
          .buy-button {
            background-color: black;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 2px;
            cursor: pointer;
            width: 100%;
            font-size: 1rem;
            display: inline-block;
            text-align: center;
          }
          .buy-button:disabled {
            background-color: #666;
            cursor: not-allowed;
          }
          .profile-avatar {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            object-fit: cover;
          }
          .profile-avatar-placeholder {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background-color: #472a91;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .profile-placeholder {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }
          @media (max-width: 768px) {
            .mint-container {
              margin-top: 10px !important;
              padding: 0 15px !important;
            }
          }
        </style>

        <div class="container">
          ${Sidebar(path)}
          <div id="hnmain">
            <table
              border="0"
              cellpadding="0"
              cellspacing="0"
              bgcolor="var(--bg-off-white)"
            >
              <tr>
                ${await Header(theme, path)}
              </tr>
              <tr>
                <td>
                  <!-- Main Content -->
                  <div
                    class="mint-container"
                    style="max-width: 450px; margin: 40px auto; padding: 0 20px;"
                  >
                    <!-- Sign up card -->
                    <div
                      style="background: white; padding: 48px 40px; text-align: center;"
                    >
                      <!-- Profile Display -->
                      <div id="user-profile" style="margin-bottom: 24px; display: flex; flex-direction: column; align-items: center; min-height: 140px;">
                        <!-- Placeholder to prevent layout shift -->
                        <div class="profile-placeholder" style="text-align: center;">
                          <div class="profile-avatar-placeholder" style="margin: 0 auto;">
                            <svg
                              width="40"
                              height="40"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              style="color: white;"
                            >
                              <path
                                d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              />
                            </svg>
                          </div>
                          <div style="margin-top: 20px;">
                            <h2 style="font-weight: 600; font-size: 24px; color: #111827; margin: 0 0 8px 0;">
                              Connect your wallet
                            </h2>
                            <p style="color: #6b7280; font-size: 16px; margin: 0;">
                              to get your Kiwi Pass
                            </p>
                          </div>
                        </div>
                        <!-- React component will replace the above -->
                      </div>

                      <!-- Sign up message with avatars -->
                      <div style="margin-bottom: 32px;">
                        <p style="font-size: 16px; color: #4b5563; margin: 0 0 20px 0; line-height: 1.6;">
                          Join 3000+ members in the Kiwi community
                        </p>
                        
                        <!-- Member avatars -->
                        <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                          <img
                            src="https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/461b71b7-e9af-47af-28f8-e9da43b99700/original"
                            alt="ccarella.eth"
                            style="width: 36px; height: 36px; border-radius: 50%; border: 2px solid #e5e7eb; object-fit: cover;"
                          />
                          <img
                            src="https://i.imgur.com/AYw6SFa.jpg"
                            alt="Peteris Erins"
                            style="width: 36px; height: 36px; border-radius: 50%; border: 2px solid #e5e7eb; object-fit: cover;"
                          />
                          <img
                            src="https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/343ce6bb-b2d3-4f7c-1359-deba9af91000/original"
                            alt="Pichi"
                            style="width: 36px; height: 36px; border-radius: 50%; border: 2px solid #e5e7eb; object-fit: cover;"
                          />
                          <div style="background: #f3f4f6; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #6b7280; font-weight: 500;">
                            +3k
                          </div>
                        </div>
                      </div>

                      <!-- Buy Button -->
                      <div id="buy-button-container" style="margin-bottom: 16px;">
                        <button class="buy-button" disabled>
                          Loading...
                        </button>
                      </div>
                      
                      <div style="height: 20px; margin-top: 12px;">
                        <nav-simple-disconnect-button
                          style="display: block; text-align: center; color: #6b7280; font-size: 14px; text-decoration: none;"
                        />
                      </div>

                      <!-- Small print -->
                      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                        <p style="font-size: 14px; color: #6b7280; margin: 0; line-height: 1.5;">
                          Price: 0.0004 ETH • Creates app key
                        </p>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </table>
            ${Footer(theme)}
          </div>
        </div>
      </body>
    </html>
  `;
}
