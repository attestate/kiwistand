//@format

import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import { custom } from "./components/head.mjs";
import * as ens from "../ens.mjs";

const html = htm.bind(vhtml);

export default async function (theme, identity) {
  return html`
    <html lang="en" op="news">
      <head>
        ${custom("", "$KIWI")}
      </head>
      <body>
        <div class="container">
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                <td
                  style="font-family: monospace; font-size: 1.2rem; padding: 1rem; color: black;"
                >
                  <h2>$KIWI</h2>
                  <p>
                    Kiwi, the original
                    <span> </span>
                    <span style="font-weight: bold; color: #472a91"
                      >Farcaster</span
                    >
                    <span> </span>
                    meme token.
                    <span> </span>
                  </p>
                  <p>
                    Build with or use $KIWI however you want. The code is
                    <span> </span>
                    <a
                      style="color: black; text-decoration: underline;"
                      href="https://github.com/attestate/kiwistand"
                      target="_blank"
                      >open source</a
                    >
                    <span> </span>
                    and the contract is
                    <span> </span>
                    <a
                      style="color: black; text-decoration: underline;"
                      href="https://optimistic.etherscan.io/address/0x66747bdc903d17c586fa09ee5d6b54cc85bbea45"
                      target="blank"
                      >verified on Etherscan</a
                    >.
                    <span> </span>
                  </p>

                  <p>Contracts are safe and audited.</p>

                  <p>
                    There is a maximum supply of 8,000,000,000 $KIWI. Once
                    everyone owns a $kiwi, no more can be created.
                  </p>
                  <h2>Want $KIWI?</h2>
                  <p>• $KIWI are 0.00256Ξ for 1 token. Locked NFT.</p>
                  <p>
                    • All proceeds fund
                    <span> </span>
                    <a href="/" target="_blank">Kiwi News</a>
                    <span> </span>

                    (public good).
                  </p>
                  <p>
                    • $KIWI are not listed on Uniswap or any other exchange.
                  </p>
                  <p>
                    • Mint $KIWI on Optimism. <b>Real utility</b>. Upvotes and
                    submissions.
                  </p>
                  <div id="buy-button-container">
                    <button class="buy-button" disabled>Loading...</button>
                  </div>
                  <hr />
                  <i
                    >None of the above should be taken as investment advice or
                    an advertisement for investment services. $KIWI has no
                    connection with the Warpcast team.</i
                  >
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
