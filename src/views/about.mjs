//@format
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";

const html = htm.bind(vhtml);

const price = "0.01";

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
                  <h2><b>Learn more about Kiwi</b></h2>
                  <p>
                  <b>Why we are building Kiwi:</b>
                  <br/>
                  <a style="color: black;" href="/why"><u>https://news.kiwistand.com/why</u></a>
                  </p>
                  <p>
                  <b>How to get involved:</b>
                  <br/>
                  <a style="color: black;" href="https://news.kiwistand.com/welcome"><u>https://news.kiwistand.com/welcome</u></a>
                  </p>
                  <p>
                  <b>Submission guidelines:</b>
                  <br/> 
                  <a style="color: black;" href="https://hackmd.io/a-r--DX2T5uEEKX0Z8PRlQ?view"><u>https://hackmd.io/a-r--DX2T5uEEKX0Z8PRlQ?view</u></a>
                  </p>
                  <p>
                  <b>Our plans:</b>
                  <br/> 
                  <a style="color: black;" href="https://hackmd.io/egIZnDStR8-zUtQuTUrxyw"><u>https://hackmd.io/egIZnDStR8-zUtQuTUrxyw</u></a>
                  </p>
                  <p>
                  <b>Feature Requests:</b>
                  <br/>
                  <a style="color: black;" href="https://kiwinews.sleekplan.app/"><u>https://kiwinews.sleekplan.app/</u></a>
                  </p>
                </div>
              </td>
            </tr>
          </table>
          ${Footer(theme)}
        </center>
      </body>
    </html>
  `;
}
