//@format

import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import { custom } from "./components/head.mjs";
import SecondHeader from "./components/secondheader.mjs";
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
            width: auto;
            min-width: 200px;
            font-size: 1rem;
            display: inline-block;
            text-align: center;
          }
          .buy-button:disabled {
            background-color: #666;
            cursor: not-allowed;
          }
        </style>

        <div class="container">
          ${Sidebar(path)}
          <div id="hnmain" style="border: 1px dotted rgba(219, 105, 141, 0.5);">
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
                    style="max-width: 800px; margin: 40px auto; padding: 0 20px;"
                  >
                    <!-- Title Section -->
                    <h1
                      style="font-size: 32px; color: black; margin: 0 0 40px 0; font-weight: 600;"
                    >
                      Join the Kiwi Community
                    </h1>

                    <!-- Card Container -->
                    <div
                      style="border: 1px dotted rgba(219, 105, 141, 0.5); background: white;"
                    >
                      <!-- Pass Image with layered background -->
                      <div
                        style="padding: 40px; background: linear-gradient(to bottom, #1B4332, #2A5A32);"
                      >
                        <div
                          style="max-width: 400px; margin: 0 auto; position: relative;"
                        >
                          <div
                            style="background: #2A5A32; border-radius: 8px; padding: 20px;"
                          >
                            <div
                              style="background: #1B4332; border-radius: 4px; padding: 20px;"
                            >
                              <img
                                loading="lazy"
                                src="KiwiPass.webp"
                                alt="Kiwi Pass"
                                style="width: 100%; height: auto; display: block;"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Content Section -->
                      <div style="padding: 32px;">
                        <div
                          style="text-align: center; max-width: 500px; margin: 0 auto;"
                        >
                          <p
                            style="font-size: 18px; color: black; margin: 0 0 24px 0;"
                          >
                            Become a Kiwi user and unlock exclusive access to
                            our community
                          </p>

                          <!-- Trust Indicators -->
                          <div
                            style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 32px;"
                          >
                            ${avatarData
                              .slice(0, 4)
                              .map(
                                (data) => html`
                                  <img
                                    loading="lazy"
                                    src="${data.avatarUrl}"
                                    alt="${data.address}"
                                    style="width: 32px; height: 32px; border: 1px dotted rgba(219, 105, 141, 0.5); border-radius: 2px;"
                                  />
                                `,
                              )}
                            <div style="text-align: left;">
                              <div style="font-weight: 500; color: black;">
                                800+ members
                              </div>
                              <div
                                style="color: var(--visited-link); font-size: 14px;"
                              >
                                already joined
                              </div>
                            </div>
                          </div>

                          <!-- Important Notice Box -->
                          <div
                            style="background: var(--header-beige); border: 1px dotted rgba(219, 105, 141, 0.5); padding: 16px; margin-bottom: 32px; text-align: left;"
                          >
                            <div
                              style="font-weight: 500; color: black; margin-bottom: 8px;"
                            >
                              Important
                            </div>
                            <div style="color: #666; font-size: 14px;">
                              • <b>Mint is now completely free</b><br />
                              • You only pay for network gas fees<br />
                              • Your wallet will be used to create an app key
                            </div>
                          </div>

                          <!-- Action Section -->
                          <div style="margin-bottom: 24px;">
                            <div
                              id="buy-button-container"
                              style="margin-bottom: 12px;"
                            >
                              <button class="buy-button" disabled>
                                Loading...
                              </button>
                            </div>
                            <nav-simple-disconnect-button
                              style="color: var(--visited-link); font-size: 14px;"
                            />
                          </div>
                        </div>
                      </div>

                      <!-- Footer Links -->
                      <div
                        style="border-top: 1px dotted rgba(219, 105, 141, 0.5); padding: 20px; background: white;"
                      >
                        <div
                          style="text-align: center; color: var(--visited-link); font-size: 14px;"
                        >
                          <div style="margin-bottom: 8px;">
                            Verify Kiwi Pass on
                          </div>
                          <a
                            href="https://optimistic.etherscan.io/address/0x66747bdc903d17c586fa09ee5d6b54cc85bbea45"
                            target="_blank"
                            style="color: inherit;"
                            >Etherscan</a
                          >
                          <span> </span>|<span> </span>
                          <a
                            href="https://zora.co/collect/oeth:0x66747bdc903d17c586fa09ee5d6b54cc85bbea45"
                            target="_blank"
                            style="color: inherit;"
                            >ZORA</a
                          >
                          <span> </span>|<span> </span>
                          <a
                            href="https://opensea.io/collection/kiwi-pass"
                            target="_blank"
                            style="color: inherit;"
                            >OpenSea</a
                          >
                        </div>
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
