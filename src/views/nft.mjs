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
                            >Minting Price: <strong>${price} Ξ</strong></span
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
                        <p class="selling-points">
                          Become part of our community by buying a Kiwi NFT to:
                        </p>
                        <ul class="list-unstyled selling-points">
                          <li class="bullet-point">
                            <strong>•</strong> Submit and upvote stories on the
                            Kiwi News p2p network
                          </li>
                          <li class="bullet-point">
                            <strong>•</strong> Expose your content to a broader
                            audience, driving growth and marketing
                          </li>
                          <li class="bullet-point">
                            <strong>•</strong> Curate top crypto stories and
                            shape the discourse
                          </li>
                          <li class="bullet-point">
                            <strong>•</strong> Gain access to the exclusive
                            "Kiwi News NFT Holder" Telegram channel
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
                        <div id="buy-button">
                          <button class="buy-button">
                            Buy Kiwi NFT for ${price} Ξ
                          </button>
                        </div>
                        <br />
                        <span>Or buy on </span>
                        <br />
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
