import htm from "htm";
import vhtml from "vhtml";
import * as curation from "./curation.mjs";
import * as moderation from "./moderation.mjs";
import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";

const html = htm.bind(vhtml);

function CanonRow(sheets) {
  sheets = sheets.sort((a, b) => 0.5 - Math.random()).slice(0, 9); // Get 9 sheets
  const rows = [];
  for (let i = 0; i < sheets.length; i += 3) {
    const rowSheets = sheets.slice(i, i + 3);
    rows.push(
      html`
        <tr>
          <td>
            <div
              style="justify-content: space-evenly; scroll-snap-type: x mandatory; border-radius: 5px; margin-bottom: -10px; padding: 20px 0; gap: 15px; display: flex; overflow-x: auto; width: 100%;"
            >
              ${rowSheets.map(
                ({ preview, name }) => html`
                  <div style="flex: 0 0 30%; scroll-snap-align: center;">
                    <a href="/canons?name=${name}" target="_blank">
                      <img
                        loading="lazy"
                        src="${preview}"
                        style="width: 100%; height: auto;"
                      />
                    </a>
                  </div>
                `,
              )}
            </div>
          </td>
        </tr>
      `,
    );
  }
  return rows;
}

export default async function displayCanonRow(theme, identity) {
  const path = "/canonrow";
  let sheets;
  try {
    const activeSheets = await moderation.getActiveCanons();
    sheets = await curation.getSheets(activeSheets);
  } catch (err) {
    console.error(err);
    return;
  }

  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
      </head>
      <body>
        <div class="container">
          ${Sidebar(path)}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme, identity)}
              </tr>
              <tr>
                <td style="padding: 10px; font-size: 16px;">
                  <h2>Kiwi Lists</h2>
                  <p>
                    Lists let you dive into specific subjects. Kiwi curators -
                    like Spotify DJs - collect the top content from one genre
                    and lead you into an educational journey. Click one of the
                    lists below to check what we prepared for you.
                  </p>
                </td>
              </tr>
              ${sheets ? CanonRow(sheets) : ""}
            </table>
          </div>
        </div>
        ${Footer(theme)}
      </body>
    </html>
  `;
}
