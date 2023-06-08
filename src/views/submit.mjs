import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";

const html = htm.bind(vhtml);

export default function submit(theme) {
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
                <form style="${formContainerStyle}">
                  <div style="${labelInputContainerStyle}">
                    <label for="title" style="${labelStyle}">Title:</label
                    ><br />
                    <textarea
                      id="titleInput"
                      name="title"
                      rows="4"
                      cols="50"
                      maxlength="80"
                      required
                      style="${inputStyle}"
                      wrap="soft"
                    ></textarea>
                  </div>
                  <div style="${labelInputContainerStyle}">
                    <label for="link" style="${labelStyle}">Link:</label><br />
                    <input
                      id="urlInput"
                      type="text"
                      name="link"
                      size="50"
                      maxlength="2048"
                      required
                      style="${inputStyle}"
                    />
                  </div>
                  <div id="submit-button">
                    <button
                      type="submit"
                      value="Submit"
                      style="${buttonStyle}"
                    />
                  </div>
                </form>
                <p style="${noteStyle}">
                  <span>Please be mindful of our </span>
                  <a
                    style="color:black;"
                    target="_blank"
                    href="https://hackmd.io/a-r--DX2T5uEEKX0Z8PRlQ?view"
                    >Guidelines</a
                  >.
                </p>
              </td>
            </tr>
          </table>
          ${Footer(theme)}
        </center>
      </body>
    </html>
  `;
}

const formContainerStyle = `
  display: flex;
  flex-direction: column;
  gap: 25px;
  max-width: 600px;
  margin: 0 auto;
  padding: 1rem 2rem;
`;

const labelInputContainerStyle = `
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const labelStyle = `
  font-size: 16px;
`;

const inputStyle = `
  width: 100%;
  padding: 5px 10px;
  font-size: 16px;
  box-sizing: border-box;
`;

const buttonStyle = `
  width: 100%;
  padding: 5px;
  font-size: 16px;
  cursor: pointer;
`;

const noteStyle = `
  font-size: 14px;
  text-align: center;
  line-height: 1.5;
  color: #777;
  padding: 0 3px 15px 3px;
`;
