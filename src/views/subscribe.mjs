//@format
import { env } from "process";
import htm from "htm";
import vhtml from "vhtml";
import url from "url";

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

export default function index(trie) {
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
                  style="padding:10px"
                >
                  <tr>
                    <td style="width:18px;padding-right:4px"></td>
                    <td style="line-height:12pt; height:10px;">
                      <span class="pagetop">
                        <b class="hnname">
                          <a href="/"> ${`${theme.emoji} ${theme.name}`} </a>
                        </b>
                      </span>
                    </td>
                    <td style="text-align:right;padding-right:4px;"></td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px; font-size: 16px;">
                <b>Who here ordered those Kiwis?!</b>
                <p>
                  <u>Here's the deal:</u>
                  <br />

                  - Every morning we're sending you an email with the link to
                  this website.
                  <br />
                  - That's it. No spam and we'll keep your data safe!
                </p>
                <form
                  action="https://buttondown.email/api/emails/embed-subscribe/kiwinews"
                  method="post"
                  target="popupwindow"
                  onsubmit="window.open('https://buttondown.email/kiwinews', 'popupwindow')"
                  class="embeddable-buttondown-form"
                >
                  <input
                    style="min-width: 20rem; font-size: 16px"
                    placeholder="your email"
                    type="email"
                    name="email"
                    id="bd-email"
                  />
                  <input
                    style="font-size: 17px"
                    type="submit"
                    value="Subscribe"
                  />
                </form>
              </td>
            </tr>
          </table>
          <span
            >Three great stories about crypto a day, check back tomorrow for
            more!</span
          >
          <br />
          <span>Today's stories were curated by </span>
          <a style="color:black;" href="https://twitter.com/mptherealmvp">
            @mptherealmvp</a
          >
          <span> and </span>
          <a style="color:black;" href="https://warpcast.com/chrsmaral"
            >@chrsmaral</a
          >
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
      </body>
    </html>
  `;
}
