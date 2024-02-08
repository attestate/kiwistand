import htm from "htm";
import vhtml from "vhtml";

import SecondHeader from "./components/secondheader.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Header from "./components/header.mjs";
import Head from "./components/head.mjs";
import Row from "./components/row.mjs";

const html = htm.bind(vhtml);

export default async function index(theme) {
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
        <style>
          @media screen and (min-width: 769px) {
            .sidebar {
              display: none;
            }

            #hnmain {
              width: 100%;
            }
        </style>
      </head>
      <body>
        <div class="container">
          ${Sidebar("/")}
          <div
            id="hnmain"
            style="width: 100%; display: flex; justify-content: center;"
          >
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                <td
                  style="flex-direction: column; display: flex; justify-content: space-between; align-items: center;"
                >
                  <p
                    style="color: black; padding: 1rem 3rem 0 3rem; font-size: 1.5rem; font-weight: bold; text-align: center;"
                  >
                    You're in!
                  </p>
                  <p
                    style="color: black; margin-top: 0; padding: 0 3rem 1rem 3rem; font-size: 1rem; text-align: center; font-weight: bold;"
                  >
                    Now you can<span style="color: limegreen;"
                      ><span> </span> upvote, submit & comment links.</span
                    >
                    <br />
                    <br />
                  </p>
                  <tr>
                    <td style="display: flex; justify-content: center;">
                      <div
                        style="
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        width: 100%; 
                        max-width: 60%; 
                        padding: 0.5rem 3rem 2rem; /* Adjusted padding */
                        border: 1px solid rgba(0,0,0,0.05);
                        border-radius: 10px;
                        background-color: rgba(0,0,0,0.05);
                        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                      "
                      >
                        <p
                          style="
                          color: black;
                          font-size: 1rem;
                          font-weight: bold;
                          text-align: center;
                          margin-bottom: 1rem;
                        "
                        >
                          Try upvoting by clicking on
                          <span> </span><span class="votearrow">▲</span> next to
                          one of the links below:
                        </p>
                        <table style="width: auto; margin: auto;">
                          ${mockStories.map((story, index) =>
                            Row(
                              index,
                              null,
                              false,
                              true,
                              mockStories.length === index + 1,
                            )(story),
                          )}
                        </table>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <p
                        style="color: black; padding: 1rem 3rem 1rem 3rem; font-size: 1rem; text-align: center; margin-top: 1rem;"
                      >
                        Your next step:
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td
                      style="display: flex; justify-content: space-evenly; padding: 20px;"
                    >
                      <div
                        style="position: fixed; right: 20px; bottom: 20px; z-index: 100; text-align: center;"
                      >
                        <button
                          style="background-color: grey; color: white; padding: 0.5rem 1rem; display: inline-flex; align-items: center; justify-content: center; gap: 10px; font-size: 1.2rem; cursor: pointer; border-radius: 0.5rem;"
                        >
                          Explore Kiwi
                        </button>
                      </div>
                    </td>
                  </tr>
                </td>
              </tr>
            </table>
          </div>
        </div>
        <div style="display: none;">${Footer(theme, "/demonstration")}</div>
      </body>
    </html>
  `;
}
