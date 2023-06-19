//@format
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";

const html = htm.bind(vhtml);

const price = "0.01";

export default function (theme) {
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
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
            border: 4px solid ${theme.color};
            border-radius: 5px;
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
            background-color: ${theme.color};
            border: none;
            color: white;
            padding: 10px 20px;
            text-align: center;
            text-decoration: none;
            display: inline-block;
            font-size: 0.9rem;
            cursor: pointer;
            border-radius: 3px;
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
                  <section>
                    <div class="image-and-text">
                      <div class="image-container">
                        <img
                          src="https://ipfs.decentralized-content.com/ipfs/bafkreierdgazvr3olgitxjhhspmb2dsyzaqti5nqegxb5rjoixzs6y6sc4"
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
                            style="color: ${theme.color}; text-decoration: none;"
                            >View on Etherscan</a
                          >
                        </div>
                      </div>
                      <div class="text-container">
                      <p style="font-size: 0.9rem;">
                        Kiwi News is the prime feed for engineers building a decentralized future.
                      </p>
                      <p style="font-size: 0.9rem;">
                        You don’t need to scroll Twitter anymore - all our content is handpicked and curated by the crypto-savvy community. 
                      </p>
                      <p style="font-size: 0.9rem;">
                        We all follow <u><a href="https://hackmd.io/a-r--DX2T5uEEKX0Z8PRlQ?view">Submission Guidelines</a></u> to protect the feed from mid and off-topic content.
                      </p>
                      <p style="font-size: 0.9rem;">
                        We are also credibly neutral - Kiwi News is built on top of the <u><a href="https://github.com/attestate/kiwistand/">P2P network</a></u>.
                      </p>
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
                            href="https://warpcast.com/timdaub"
                            style="color: ${theme.color}; text-decoration: none;"
                            >@timdaub</a
                          >
                          <span>, </span>
                          <a
                            href="https://warpcast.com/macbudkowski"
                            style="color: ${theme.color}; text-decoration: none;"
                            >@macbudkowski</a
                          >
                          <span>, </span>
                          <a
                            href="https://warpcast.com/freeatnet"
                            style="color: ${theme.color}; text-decoration: none;"
                            >@freeatnet</a
                          >
                          <span>, </span>
                          <a
                            href="https://warpcast.com/chrsmaral"
                            style="color: ${theme.color}; text-decoration: none;"
                            >@chrsmaral</a
                          >
                          <span> and others!</span>
                        </p>
                        <a
                          style="color:black;"
                          href="https://zora.co/collect/0xebb15487787cbf8ae2ffe1a6cca5a50e63003786"
                          target="_blank"
                        >
                          <button class="buy-button">
                            Buy Kiwi NFT for <nft-price /> ETH (on zora.co)
                          </button>
                        </a>
                        <br />
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
