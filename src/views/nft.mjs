//@format
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";

const html = htm.bind(vhtml);

export default function (theme) {
  return html`
    <html lang="en" op="news">
      <head>
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-21BKTD0NKN"
        ></script>
        <script src="ga.js"></script>
        <meta charset="utf-8" />
        <meta name="referrer" content="origin" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link
          rel="apple-touch-icon"
          sizes="152x152"
          href="apple-touch-icon.png"
        />
        <link rel="stylesheet" type="text/css" href="news.css" />
        <link rel="shortcut icon" href="favicon.ico" />
        <title>Kiwi News</title>
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
            border: 4px solid #4caf50;
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
            color: #4caf50;
          }
          .buy-button {
            background-color: #4caf50;
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
                          <span>Minting Price: <strong>0.01 Ξ</strong></span>
                          <span> | </span>
                          <a
                            href="https://etherscan.io/address/0xebb15487787cbf8ae2ffe1a6cca5a50e63003786"
                            style="color: #4CAF50; text-decoration: none;"
                            >View on Etherscan</a
                          >
                        </div>
                      </div>
                      <div class="text-container">
                        <p class="selling-points">
                          Connect your wallet and buy a Kiwi NFT to:
                        </p>
                        <ul class="list-unstyled selling-points">
                          <li class="bullet-point">
                            <strong>•</strong> Submit and upvote stories on the
                            Kiwi News network
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
                          its creator,
                          <span> </span>
                          <a
                            href="https://warpcast.com/timdaub"
                            style="color: #4CAF50; text-decoration: none;"
                            >@timdaub</a
                          >.
                        </p>
                        <button class="buy-button">
                          Buy Kiwi NFT for 0.01 Ξ
                        </button>
                      </div>
                    </div>
                  </section>
                </div>
              </td>
            </tr>
          </table>
          ${Footer}
        </center>
      </body>
    </html>
  `;
}
