//@format
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";

const html = htm.bind(vhtml);

export default function (theme) {
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
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
                <div style="padding: 20px;">
                  <p><b>What links to submit on Kiwi News:</b></p>
                  <ul>
                    <li>
                      We welcome content that might expand the intellectual
                      horizons of web3 builders: tech, economics, culture,
                      sociology, art, etc.
                    </li>
                    <li>
                      If you have a choice between an original source and a
                      report about something found on the other website, choose the
                      original source.
                    </li>
                    <li>
                      Ensure the links are not paywalled (consider NOT posting
                      paywalled content)
                    </li>
                  </ul>
                  <p><b>How to prepare your title:</b></p>
                  <ul>
                    <li>
                      If you don't use the original title, ensure your title is
                      not too clickbaity.
                    </li>
                    <li>
                      Fit into less than 80 characters. Otherwise, the title
                      will be cropped.
                    </li>
                    <li>
                      Don't put the name of the site (like YouTube or Reddit) in
                      the title since it's going to be displayed below the link.
                    </li>
                  </ul>
                  <p>
                    Since we want to keep the content quality high, we reserve
                    the right to moderate the links that won't follow these
                    rules.
                  </p>
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
