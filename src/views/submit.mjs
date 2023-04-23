//@format
import { env } from "process";
import htm from "htm";
import vhtml from "vhtml";
import url from "url";

import * as store from "../store.mjs";

const html = htm.bind(vhtml);

let theme = {};
if (env.THEME === "kiwi") {
  theme.color = "limegreen";
  theme.emoji = "🥝";
  theme.name = "Kiwi News";
} else if (env.THEME === "orange") {
  theme.color = "orange";
  theme.emoji = "🍊";
  theme.name = "Orange News";
} else {
  throw new Error("Must define env.THEME");
}

export default function submit() {
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
              <td bgcolor="${theme.color}">
                <table
                  border="0"
                  cellpadding="0"
                  cellspacing="0"
                  width="100%"
                  style="padding:5px"
                >
                  <tr>
                    <td style="width:18px;padding-right:4px"></td>
                    <td style="line-height:12pt; height:10px;">
                      <span class="pagetop"
                        ><b class="hnname">${`${theme.emoji} ${theme.name}`}</b>
                      </span>
                    </td>
                    <td style="text-align:right;padding-right:4px;">
                      <a target="_blank" href="/submit">Submit Story</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr id="pagespace" title="" style="height:10px"></tr>
            <tr>
              <td>
                <div id="root"></div>
              </td>
            </tr>
          </table>
          Three great stories about crypto a day, check back tomorrow for more!
          <div
            id="privacy-notice"
            style="width: 85%; padding: 5px; font-size: 10px;"
          >
            <h2 style="font-size: 12px; margin: 0 0 3px; color: #f0f0f0;">
              Privacy Notice & Cookie Policy
            </h2>
            <p style="margin: 0 0 3px; color: #e0e0e0;">
              We use Google Analytics, a web analysis service provided by Google
              Inc., on our website. Google Analytics uses cookies to analyze
              your use of the website, generate reports on website activity, and
              provide other services related to website usage and internet
              usage.
            </p>
            <p style="margin: 0 0 3px; color: #e0e0e0;">
              Google may transfer this information to third parties if required
              by law or if third parties process this data on behalf of Google.
              Google will not associate your IP address with any other data held
              by Google.
            </p>
            <p style="margin: 0; color: #e0e0e0;">
              By using this website, you consent to the processing of data about
              you by Google in the manner and for the purposes set out above.
              For more information, please review our
              <a
                href="/privacy-policy"
                style="color: #ffffff; text-decoration: underline;"
                >Privacy Policy</a
              >.
            </p>
          </div>
        </center>
        <script src="bundle.js"></script>
      </body>
    </html>
  `;
}
