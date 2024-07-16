//@format
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import { custom } from "./components/head.mjs";
import { twitterSvg, warpcastSvg } from "./components/socialNetworkIcons.mjs";

const html = htm.bind(vhtml);

const rss = (style) => html`
  <svg
    style="${style}"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <path
      d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM76,192a12,12,0,1,1,12-12A12,12,0,0,1,76,192Zm44,0a8,8,0,0,1-8-8,40,40,0,0,0-40-40,8,8,0,0,1,0-16,56.06,56.06,0,0,1,56,56A8,8,0,0,1,120,192Zm32,0a8,8,0,0,1-8-8,72.08,72.08,0,0,0-72-72,8,8,0,0,1,0-16,88.1,88.1,0,0,1,88,88A8,8,0,0,1,152,192Zm32,0a8,8,0,0,1-8-8A104.11,104.11,0,0,0,72,80a8,8,0,0,1,0-16A120.13,120.13,0,0,1,192,184,8,8,0,0,1,184,192Z"
    />
  </svg>
`;

export default async function index(theme) {
  const ogImage = "https://news.kiwistand.com/kiwi_subscribe_page.png";
  const path = "/subscribe";
  const iconStyle = "width: 2rem; color: black;";
  return html`
    <html lang="en" op="news">
      <head>
        ${custom(
          ogImage,
          "Subscribe to Kiwi News",
          "Stay in touch with Kiwi News by subscribing to our weekly news letter or by follwing us on social media.",
        )}
      </head>
      <body>
        <div class="container">
          ${Sidebar(path)}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                <td style="padding: 10px 10px 3rem 10px; font-size: 16px;">
                  <div
                    style="display: flex; flex-direction: column; align-items: center; text-align:
 center;"
                  >
                    <h3
                      style="margin-left: 20px; margin-bottom: 0; align-self: start; color:black;"
                    >
                      Follow us on social media
                    </h3>
                    <div
                      style="padding: 1rem 20px; color: black; text-align: left;"
                    >
                      You can pick from a selection of platforms to follow us.
                      On X and Warpcast our automated bot curates the latest
                      links from the main page. Our weekly newsletter gives you
                      an overview about what happened in the last few days and
                      our RSS feeds are a privacy-friendly alternative to using
                      the website.
                    </div>
                    <div
                      style="display: grid; grid-template-columns: 3fr 2fr 2fr 3fr; grid-template-rows:
 auto auto; grid-gap: 25px; padding: 0 20px;"
                    >
                      <div
                        style="background-color: rgba(0,0,0,0.05);display: flex; align-items: center; justify-content: center; flex-direction: column; grid-column: 1 / span 2; border: 1px solid #ccc; padding: 20px; border-radius: 2px;"
                      >
                        <div style="margin-bottom: 10px;">
                          <img
                            src="paragraph.png"
                            alt="Paragraph Logo"
                            style="height: 2rem; display: block; margin: auto;"
                          />
                        </div>
                        <a
                          target="_blank"
                          href="https://paragraph.xyz/@kiwi-weekly/subscribe"
                          >Subscribe to Kiwi Weekly</a
                        >
                      </div>
                      <div
                        style="background-color: rgba(0,0,0,0.05); grid-column: 3; grid-row: 1; border: 1px solid #ccc; padding: 20px; border-radius: 2px;"
                      >
                        <div style="margin-bottom: 10px;">
                          ${twitterSvg(iconStyle)}
                        </div>
                        <a target="_blank" href="https://twitter.com/KiwiNewsHQ"
                          >Follow on X</a
                        >
                      </div>
                      <div
                        style="grid-column: 1 / span 3; grid-row: 2; display: flex; flex-direction: column; align-items; center; justify-content: center; background-color: rgba(0,0,0,0.05);  border: 1px solid #ccc; padding:
 20px; border-radius: 2px;"
                      >
                        <div style="margin-bottom: 10px;">
                          ${warpcastSvg(iconStyle)}
                        </div>
                        <a target="_blank" href="https://warpcast.com/kiwi"
                          >Follow us on Warpcast</a
                        >
                      </div>
                      <div
                        style="grid-column: 4 / span 2; grid-row: 1 / span 2;background-color: rgba(0,0,0,0.05); border: 1px solid #ccc; padding:
 20px; border-radius: 2px;"
                      >
                        <div
                          style="display: flex; flex-direction: column; align-items: center; justify-content: center;"
                        >
                          ${rss(
                            "width: 4rem; color: black; margin-bottom: 1rem;",
                          )}
                          <div>
                            <a href="https://kiwinews.lol/api/feed/top"
                              >Top Links Feed</a
                            ><br /><br />
                            <a href="https://kiwinews.lol/api/feed/new"
                              >New Links Feed</a
                            >
                          </div>
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
