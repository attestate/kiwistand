//@format
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import PWALine from "./components/iospwaline.mjs";
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
  "mishaderidder.eth",
  "ccarella.eth",
  "thatalexpalmer.eth",
  "freeatnet.eth",
  "destiner.eth",
  "cerv1.eth",
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
            width: 100%;
          }

          .circular-image {
            border-radius: 2px;
          }

          .avatar-container {
            text-align: center;
            margin: 10px;
          }

          .avatar-row {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            align-items: center;
          }

          .parent-container {
            width: 100%; /* or any specific width you want */
          }

          .full-width-container {
            width: 100%;
          }

          .desktop-image {
            display: block;
          }
          .mobile-image {
            display: none;
          }

          /* Mobile styles */
          @media (max-width: 768px) {
            .flex-container {
              flex-direction: column;
            }

            .avatar-row {
              flex-direction: row;
              flex-wrap: wrap;
              justify-content: space-around;
            }

            .avatar-container {
              flex: 0 0 auto;
              width: 50px;
              margin: 30px;
            }

            .text-right button {
              text-align: center;
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

            .desktop-image {
              display: none;
            }
            .mobile-image {
              display: block;
            }
          }

          body {
            line-height: 1.6;
            margin: 0;
            padding: 0;
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
          .image-and-text {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            align-items: stretch;
          }
          .image-container,
          .text-container {
            flex: 1;
            width: 100%;
          }

          @media (min-width: 768px) {
            .image-container,
            .text-container {
              padding: 0 20px 20px 20px;
            }
            .text-content {
              font-size: 1rem;
            }
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
          .text-content button {
            width: 100%;
            margin-top: 15px;
          }
          .kiwi-nft {
            max-width: 100%;
            height: auto;
            border-radius: 2px;
          }
          .image-meta {
            font-size: 0.9rem;
            margin-top: 5px;
            text-align: center;
          }
          .selling-points {
            font-size: 0.9rem;
            margin-bottom: 20px;
          }
          .list-unstyled {
            list-style-type: none;
            padding: 10px;
          }
          .bullet-point {
            margin-bottom: 10px;
            padding-right: 10px;
          }
          .bullet-point strong {
            color: ${theme.color};
          }
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
            border-radius: 2px;
            font-family: "Helvetica", "Arial", sans-serif;
          }

          .buy-button:disabled {
            background-color: grey;
            cursor: not-allowed;
          }

          @media screen and (max-width: 768px) {
            .image-and-text {
              flex-direction: column;
            }
            .list-unstyled {
              padding: 0 10px 0 10px;
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
        ${PWALine}
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
                    <div
                      class="flex-container flex-image-right"
                      style="align-items: center;"
                    >
                      <div class="text-left">
                        <h2>Don’t just read Kiwi, join our community.</h2>
                        <h4>
                          Shape the kiwi feed, get discovered by 1,500+ monthly
                          readers & meet 800+ other crypto connoisseurs. Get all
                          that for an early adopter price.
                        </h4>
                      </div>
                      <div class="image-right">
                        <img src="KiwiPass.png" />
                      </div>
                    </div>
                    <div class="full-width-container">
                      <a href="#mint-dialogue">
                        <button
                          id="button-onboarding"
                          style="margin-right: 0; width: auto;"
                        >
                          Mint Kiwi Pass
                        </button>
                      </a>
                      <span style="margin-left: 5px;"
                        ><b>Price:</b> <nft-price data-fee="0.000777"
                      /></span>
                    </div>
                    <div class="full-width-container">
                      <p>Already minted by:</p>
                      <div class="avatar-row">
                        ${avatarData.map(
                          (data) => html`
                            <div class="avatar-container">
                              <img
                                class="circular-image"
                                src="${data.avatarUrl}"
                                alt="${data.address}"
                                style="border: 1px solid #828282; width: 35px; height: 35px;"
                              />
                              <div style="font-size: 12px;">
                                ${data.address}
                              </div>
                            </div>
                          `,
                        )}
                        <div>
                          <a
                            style="text-decoration: underline;"
                            href="/community"
                            target="_blank"
                          >
                            & 800+ more
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                  <br />
                  <br />
                  <br />
                  <br />
                  <br />
                  <div class="flex-container flex-image-left">
                    <div class="image-left">
                      <img
                        style="border-radius: 2px;"
                        src="Kiwi_Notifications.png"
                        alt="Kiwi Posts"
                      />
                    </div>
                    <div class="text-right">
                      <h2>Shape the kiwi feed</h2>
                      <p>
                        All links on Kiwi are curated by our community of Kiwi
                        Pass holders. You can shape our feed by submitting and
                        upvoting content you find interesting.
                      </p>
                    </div>
                  </div>
                  <br />
                  <br />
                  <br />
                  <div class="flex-container flex-image-right">
                    <div class="text-left">
                      <h2>Get discovered by 1,500+ readers & curators</h2>
                      <p>
                        You will get a profile that shows all your submissions.
                        You can link your personal website & socials to help
                        people learn more about your projects or reach out to
                        you.
                      </p>
                    </div>
                    <div class="image-right">
                      <img style="border-radius: 2px;" src="Kiwi_Profile.png" />
                    </div>
                  </div>
                  <br />
                  <br />
                  <br />
                  <div class="flex-container flex-image-left">
                    <div class="image-left">
                      <img
                        style="border-radius: 2px;"
                        src="LP_community.png"
                        alt="Kiwi signless"
                      />
                    </div>
                    <div class="text-right">
                      <h2>
                        Meet 150+ crypto connoisseurs via our Telegram Channel
                      </h2>
                      <p>
                        We are people building the decentralized future -
                        primarily web3 founders, developers, investors and
                        creators. Discuss the crypto content, ask questions and
                        meet new, smart people on our curator-only channel.
                      </p>
                    </div>
                  </div>

                  <br />
                  <br />
                  <br />
                  <div class="flex-container flex-image-right">
                    <div class="text-left">
                      <h2>Decide who gets ETH from Kiwi grants</h2>
                      <p>
                        We share part of our NFT revenue with the most active
                        contributors. Our community decide who gets the money -
                        so far we distributed over $2,000 to 10+ people.
                      </p>
                    </div>
                    <div class="image-right">
                      <img
                        style="border-radius: 2px;"
                        src="Kiwi_Sales.png"
                        alt="Kiwi Revenue Split"
                      />
                    </div>
                  </div>
                  <br />
                  <br />
                  <div class="flex-container flex-image-left">
                    <div class="image-left">
                      <img
                        style="border-radius: 2px;"
                        src="Kiwi_Telegram.png"
                        alt="Kiwi signless"
                      />
                    </div>
                    <div class="text-right">
                      <h2>Take part in building the product you use</h2>
                      <p>
                        We discuss our feature ideas with the community, to
                        ensure that we build something they want. You can join
                        us and help us build the future of decentralized tech.
                      </p>
                    </div>
                  </div>
                  <br />
                  <br />
                  <section>
                    <h2
                      id="mint-dialogue"
                      style="text-align: center; margin-bottom: 1rem;"
                    >
                      Mint Kiwi Pass to join the community of Kiwi curators!
                    </h2>
                    <div class="image-and-text">
                      <div class="image-container">
                        <img
                          style="border-radius: 2px;"
                          src="pass.jpeg"
                          alt="Kiwi News NFT"
                          class="kiwi-nft"
                        />
                      </div>
                      <div
                        class="text-container"
                        style="display: flex; flex-direction: column; justify-content:end;"
                      >
                        <div class="text-content">
                          <div class="text-row">
                            <div>Lifetime membership</div>
                            <div>
                              <nft-price />
                            </div>
                          </div>
                          <div class="text-row">
                            <div>
                              <b>ZORA</b> mint fee
                              <span> </span>
                              (<a
                                style="font-size: 0.8rem; text-decoration: underline;"
                                href="https://support.zora.co/en/articles/8192123-understanding-protocol-rewards-on-zora"
                                target="_blank"
                                >Learn more</a
                              >)
                            </div>
                            <div>0.000777 ETH</div>
                          </div>
                          <div class="text-row">
                            <div>Total</div>
                            <div>
                              <nft-price data-fee="0.000777" />
                            </div>
                          </div>
                          <div id="buy-button-container">
                            <button class="buy-button" disabled>
                              Loading...
                            </button>
                          </div>
                        </div>
                        <br />
                        <span style="margin-top: 5px;"
                          >Want to buy another NFT to support us? Buy it
                          directly on
                          <span> </span>
                          <u
                            ><a
                              target="_blank"
                              href="https://zora.co/collect/oeth:0x66747bdc903d17c586fa09ee5d6b54cc85bbea45"
                              >ZORA.co</a
                            ></u
                          ></span
                        >
                      </div>
                    </div>
                  </section>
                  <br />
                  <div
                    style="display: flex; flex-direction: column; align-items: center;"
                  >
                    <h2 style="margin-bottom: 1rem;">
                      What people say about Kiwi:
                    </h2>
                    <div class="image" style="margin-bottom: 1rem;">
                      <img
                        style="border-radius: 2px;"
                        class="desktop-image"
                        src="LP_referrals.png"
                        alt="Kiwi Referrals"
                      />
                      <img
                        style="border-radius: 2px;"
                        class="mobile-image"
                        src="LP_referrals_mobile.png"
                        alt="Kiwi Referrals"
                      />
                    </div>
                  </div>
                  <br />
                  <div style="max-width: 70%; margin: auto;">
                    <h2 style="text-align: center;">FAQ</h2>
                    <b>Why Kiwi?</b>
                    <p>
                      It's a long story that started with a meme on Farcaster.
                      You can learn more about it on
                      <span> </span>
                      <u
                        ><a href="https://howtoeat.kiwi" target="_blank"
                          >howtoeat.kiwi</a
                        ></u
                      >
                      <span> </span>
                      and mint a free Kiwi NFT.
                    </p>

                    <b>Which chain is the Kiwi Pass on?</b>
                    <!-- prettier-ignore -->
                    <p>
                      Our NFTs are on Optimism. If you need to bridge your ETH,
                      we suggest using <u><a href="https://app.optimism.io/bridge">Optimism Bridge</a></u>.
                    </p>

                    <b>Is it lifetime access?</b>
                    <p>
                      At this point buying an NFT gives you unlimited access. In
                      the future it might change but if we do change it, we ‘ll
                      definitely reward our early contributors.
                    </p>

                    <b>Can I sell this NFT?</b>
                    <p>
                      Theoretically yes. But the utility is tied to your
                      profile, so only you can post links with it. Otherwise
                      someone could buy (or steal) an NFT and submit links on
                      your behalf.
                    </p>

                    <b>Are my submissions and upvotes public?</b>

                    <p>
                      Yes, at this point all of them are. Thanks to that, you
                      can check other people’s submissions on their profile page
                      and learn more about them.
                    </p>

                    <b>What if I don’t use Telegram?</b>
                    <p>
                      You can reach out to Tim and Mac on Farcaster or Twitter.
                      We are also working on comments to give our users other
                      ways to connect.
                    </p>

                    <b>How do I fill in my profile?</b>
                    <p>
                      We fetch the data from ENS. So the best way is to set up
                      your ENS avatar and add links there and we will
                      automatically fetch it.
                    </p>

                    <b>How the contributor rewards work?</b>
                    <p>
                      Everyone who has at least 1 karma can propose a person for
                      a PropHouse. Then our curators vote and decide who is
                      going to get money. You can learn more about the process
                      looking at our last PropHouse <link />.
                    </p>
                    <br />
                    <br />
                    <p>***</p>
                    <p>
                      Have more questions? Reach out to @macbudkowski or
                      @timdaub on Farcaster and Twitter. We use the same handles
                      on both networks.
                      <br />
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
