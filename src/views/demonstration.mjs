import htm from "htm";
import vhtml from "vhtml";

import SecondHeader from "./components/secondheader.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Header from "./components/header.mjs";
import Head from "./components/head.mjs";
import Row from "./components/row.mjs";

const html = htm.bind(vhtml);

export default async function index(theme, identity) {
  const mockStories = [
    {
      title: "Bitcoin: A Peer-to-Peer Electronic Cash System",
      href: "https://bitcoin.org/bitcoin.pdf",
      upvoters: ["satoshi", "finney", "dob"],
      timestamp: new Date("2008-10-31").getTime() / 1000,
      avatars: ["btc.png", "hal.png", "mac.png"],
      displayName: "Satoshi Nakamoto",
    },
    {
      title: "Ethereum Whitepaper",
      href: "https://ethereum.org/whitepaper/",
      upvoters: ["vitalik", "mihai", "joseph"],
      timestamp: new Date("2013-12-01").getTime() / 1000,
      avatars: ["vit.png", "gav.png", "tim.png"],
      displayName: "Vitalik Buterin",
    },
  ];

  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
        <meta
          name="description"
          content="Kiwi News is the prime feed for hacker engineers building a decentralized future. All our content is handpicked and curated by crypto veterans."
        />
      </head>
      <body>
        <div class="container">
          ${Sidebar("/")}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme, identity)}
              </tr>
              <tr>
                <td
                  style="flex-direction: column; display: flex; justify-content: space-between; align-items: center;"
                >
                  <p
                    style="color: black; padding: 1rem 3rem 0 3rem; font-size: 14pt; font-weight: bold; text-align: center;"
                  >
                    You're in!
                  </p>
                  <p
                    style="color: black; margin-top: 0; padding: 0 3rem 1rem 3rem; font-size: 14pt; text-align: center;"
                  >
                    The Kiwi Pass allows you to upvote stories.
                    <br />
                    <br />
                    <b>Try it out!</b>
                  </p>
                </td>
              </tr>
              ${mockStories.map((story, index) =>
                Row(
                  index,
                  "padding: 1rem 2rem; background-color: #e6e6df;",
                  false,
                  true,
                )(story),
              )}
              <tr>
                <td>
                  <p
                    style="color: black; padding: 1rem 3rem 1rem 3rem; font-size: 14pt; text-align: center;"
                  >
                    Your next steps:
                  </p>
                </td>
              </tr>
              <tr>
                <td
                  style="display: flex; justify-content: space-evenly; padding: 20px;"
                >
                  <a
                    id="button-onboarding"
                    style="width: auto;"
                    href="/onboarding"
                  >
                    Learn more
                  </a>
                  <a
                    href="/submit"
                    style="display: flex; align-items: center; text-decoration: underline; color: black;"
                    >Submit a story</a
                  >
                </td>
              </tr>
            </table>
          </div>
        </div>
        ${Footer(theme, "/demonstration")}
      </body>
    </html>
  `;
}
