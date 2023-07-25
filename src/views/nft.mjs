//@format
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";

const html = htm.bind(vhtml);

const price = "0.01";

export default function (theme) {
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
        <meta name="description" content="Learn about Kiwi News, the prime feed for hacker engineers building a decentralized future. Our content is handpicked and curated by a crypto-savvy community. Join us by minting the Kiwi NFT." />
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 0;
          }
          .container {
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
            align-items: center;
          }
          .image-container,
          .text-container {
            flex: 1;
            padding: 0 20px 20px 20px;
          }
          .kiwi-nft {
            max-width: 100%;
            height: auto;
            border-radius: 3px;
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
            border-radius: 3px;
            font-family: 'Helvetica', 'Arial', sans-serif;
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
      </head>
      <body>
        ${Sidebar}
        <center>
          <table
            id="hnmain"
            border="0"
            cellpadding="0"
            cellspacing="0"
            width="85%"
            bgcolor="#f6f6ef"
          >
            <tr>
              ${Header(theme)}
            </tr>
            <tr>
              <td>
                <div class="container">
                  <header class="header">
                    <h1>Welcome to Kiwi News</h1>
                  </header>
                  <div class="text-container">
                      <p style="font-size: 0.9rem;">
                        Kiwi News is the prime feed for hacker engineers building a decentralized future.
                      </p>
                      <p style="font-size: 0.9rem;">
                        You don’t need to scroll Twitter anymore - all our content is handpicked and curated by the crypto-savvy <a href="/community">Community</a>. 
                      </p>
                      <p style="font-size: 0.9rem;">
                        We all follow <u><a target="_blank" href="https://hackmd.io/a-r--DX2T5uEEKX0Z8PRlQ?view">Submission Guidelines</a></u> to protect the feed from mid and off-topic content.
                      </p>
                      <p style="font-size: 0.9rem;">
                        We are also credibly neutral - Kiwi News is built on top of the <u><a target="_blank" href="https://github.com/attestate/kiwistand/">Kiwistand P2P network</a></u>.
                      </p>
                  </div>
                  <section>
                    <div class="image-and-text">
                      <div class="image-container">
                        <img
                          src="animation.gif"
                          alt="Kiwi News NFT"
                          class="kiwi-nft"
                        />
                        <div class="image-meta">
                          <span
                            >Minting Price:
                            <span> </span>
                            <strong><nft-price /> ETH</strong></span
                          >
                          <span> | </span>
                          <a
                            href="https://etherscan.io/address/0xebb15487787cbf8ae2ffe1a6cca5a50e63003786"
                            style="color: ${
                              theme.color
                            }; text-decoration: none;"
                            >View on Etherscan</a
                          >
                        </div>
                      </div>
                      <div class="text-container">
                      <p style="font-size: 0.9rem;">
                        <b>If you want to join our community, mint the Kiwi NFT to:</b>
                      </p>
                      <ul class="list-unstyled selling-points">
                        <li class="bullet-point">
                          <strong>•</strong> Submit and curate stories on the Kiwi News P2P network,
                        </li>
                        <li class="bullet-point">
                          <strong>•</strong> Get distribution by exposing your content to a broader crypto-native audience,
                        </li>
                        <li class="bullet-point">
                          <strong>•</strong> Share our links to Warpcast,
                        </li>
                        <li class="bullet-point">
                          <strong>•</strong> Co-create the Kiwi News moderation system and influence governance,
                        </li>
                        <li class="bullet-point">
                          <strong>•</strong> Gain access to the exclusive "Kiwi News NFT Holder" Telegram channel.
                        </li>
                      </ul>
                        <p>
                          Your contribution supports the project's growth and
                          its creator team, including
                          <span> </span>
                          <a
                            target="_blank"
                            href="https://warpcast.com/timdaub"
                            style="color: ${
                              theme.color
                            }; text-decoration: none;"
                            >@timdaub</a
                          >
                          <span>, </span>
                          <a
                            target="_blank"
                            href="https://warpcast.com/macbudkowski"
                            style="color: ${
                              theme.color
                            }; text-decoration: none;"
                            >@macbudkowski</a
                          >
                          <span>, </span>
                          <a
                            target="_blank"
                            href="https://warpcast.com/freeatnet"
                            style="color: ${
                              theme.color
                            }; text-decoration: none;"
                            >@freeatnet</a
                          >
                          <span> and others!</span>
                        </p>
                        <a
                          style="color:black;"
                          href="https://zora.co/collect/eth:0xebb15487787cbf8ae2ffe1a6cca5a50e63003786"
                          target="_blank"
                        >
                          <button class="buy-button" style="display: flex; align-items: center;">
                            <zora-zorb style="margin-right: 15px;" size="20px" address="0xebb15487787cbf8ae2ffe1a6cca5a50e63003786"></zora-zorb>
                            <span> Buy on <b>ZORA</b> for <nft-price /> ETH</span>
                          </button>
                        </a>
                        <br />
                        <span>alternatives: </span>
                        <a
                          style="color:black;"
                          href="https://mint.fun/0xebb15487787cbf8ae2ffe1a6cca5a50e63003786"
                          target="_blank"
                          >mint.fun</a
                        >
                      </div>
                    </div>
                  </section>
                  <div class="text-container">
                  <p style="font-size: 0.9rem;"><strong>FAQ:</strong></p>

                  <p style="font-size: 0.9rem;"><strong>Who is picking these links?</strong></p>
                  <p style="font-size: 0.9rem;">We are a community of 80+ crypto-savvy people who submit and upvote links to create a newsfeed we all want to use. You can learn more about the community <a href="/community"><u>here</a></u>.</p>

                  <p style="font-size: 0.9rem;"><strong>Why do we build this?</strong></p>
                  <p style="font-size: 0.9rem;">We want to create a space where crypto content can thrive. Where creators can reach new audiences and readers can find inspiring texts, podcasts and videos. You can read more about our vision <a href="/why"><u>here</a></u>.</p>

                  <p style="font-size: 0.9rem;"><strong>What is your current roadmap?</strong></p>
                  <p style="font-size: 0.9rem;">We are working to make the web app experience more seamless. We also plan to ship the mobile app. You can read more about our plans here <a target="_blank" href="https://hackmd.io/egIZnDStR8-zUtQuTUrxyw"><u>here</a></u>.</p>

                  <p style="font-size: 0.9rem;"><strong>Where can I share my feature requests?</strong></p>
                  <p style="font-size: 0.9rem;">If you’re our NFT holder, you can reach out to @timdaub or @macbudkowski to get added to the holders-only Telegram Chat. If you don’t hold our NFT, you can always add your requests <a target="_blank" href="https://kiwinews.sleekplan.app/"><u>here</a></u>.</p>

                  <p style="font-size: 0.9rem;"><strong>How do you determine the price of the NFT?</strong></p>
                  <p style="font-size: 0.9rem;">We have a simple algorithm for price discovery. You can learn more about it <a target="_blanK" href="https://hackmd.io/zmZsDW-XTsizJzChl1n3WA?view"><u>here</a></u>.</p>
                  </div>
                </div>
              </td>
            </tr>
          </table>
          ${Footer(theme)}
        </center>
      </body>
    </html>
  `;
}
