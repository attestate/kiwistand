//@format
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/Header.mjs";
import Footer from "./components/footer.mjs";

const html = htm.bind(vhtml);

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
              ${Header}
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
          ${Footer}
        </center>
      </body>
    </html>
  `;
}
