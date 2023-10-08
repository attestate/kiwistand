//@format

import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";

const html = htm.bind(vhtml);

export default async function (theme, identity) {
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
      </head>
      <body>
        <div class="container">
          ${Sidebar()}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme, identity)}
              </tr>
              <tr>
                <td style="padding: 1rem;">
                  <h1>Why guidelines are important</h1>
                  <p>
                    We have an opportunity to build our own corner of the
                    onchain internet. With awesome people, links, resources, and
                    learning. To ensure this corner is valuable, we need to
                    follow some submission guidelines.
                  </p>
                  <h2>What to submit?</h2>
                  <h3>On topic:</h3>
                  <p>
                    Anything that gratifies the intellectual curiosities of
                    builders, engineers, hackers, and craftspeople in the
                    community.
                  </p>
                  <p>That includes:</p>
                  <ul>
                    <li>Technical resources, hacking, and awesome git repos</li>
                    <li>Startups, cryptocurrencies, cryptography</li>
                    <li>Networking, privacy, decentralization</li>
                    <li>Hardware, open source, art, economics, game theory</li>
                  </ul>
                  <h3>Off topic:</h3>
                  <ul>
                    <li>
                      Sensationalist journalism for the sake of ad revenue
                      (including overly optimized click-bait, rage-bait, fluff
                      headlines, clickthrough optimized headlines, cliffhanger
                      headlines, posts with no substance)
                    </li>
                    <li>Mediocre resources</li>
                    <li>
                      Old stories we all read and that have been widely shared
                      elsewhere
                    </li>
                    <li>Shilling (you know what this means)</li>
                  </ul>
                  <h2>How to submit?</h2>
                  <p>
                    A good headline tells you exactly what to expect without
                    embellishing or optimizing for clickthrough. Some
                    recommendations:
                  </p>
                  <ul>
                    <li>Attempt to submit the original title</li>
                    <li>
                      Trim the title if it's too long without losing substance
                    </li>
                    <li>
                      Avoid Title Casing Because It Looks Like Spam (and it's
                      terrible to read)
                    </li>
                    <li>
                      Avoid Upworthy and Buzzfeed style titles along the lines
                      of, "Fiat Crisis with Balaji (shocking!)" - there's no
                      need to add the last part
                    </li>
                    <li>Consider NOT submitting pay-walled articles</li>
                  </ul>
                  <h2>How to upvote?</h2>
                  <p>
                    Within a small community, upvoting carries a lot of weight.
                    The recommendation here is to carefully consider what's
                    worth upvoting and what isn't. Avoid upvoting things you
                    haven't read, watched, or vetted as worthy of other people's
                    time.
                  </p>
                  <p>
                    <span>Thanks to </span>
                    <u
                      ><a
                        href="https://news.kiwistand.com/upvotes?address=0x3601a913fD3466f30f5ABb978E484d1B37Ce995D"
                        >@thatalexpalmer</a
                      ></u
                    >
                    <span> who helped us prepare these guidelines.</span>
                  </p>
                  <a href="/submit">
                    <button
                      style="font-size: 1.01rem; border-radius: 2px; cursor: pointer; padding: 5px 15px 5px 15px; background-color: transparent; border: 1px solid"
                    >
                      Go to Submit page
                    </button>
                  </a>
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
