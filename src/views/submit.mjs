import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import Sidebar from "./components/sidebar.mjs";
import { prefetchHead } from "./components/head.mjs";
import Row, { extractDomain } from "./components/row.mjs";
import * as parser from "../parser.mjs";

const html = htm.bind(vhtml);

export default async function submit(theme, url = "", title = "") {
  if (url && !title) {
    let data;
    try {
      const generateTitle = true;
      data = await parser.metadata(url, generateTitle);
    } catch (err) {
      // noop, if the request fails we just continue as though nothing ever happened.
    }
    if (data && data.ogTitle) {
      title = data.ogTitle;
    }
    if (data && data.canonicalLink) {
      url = data.canonicalLink;
    }
  }
  const path = "/submit";
  const story = {
    title: "Ethereum Whitepaper",
    href: "https://ethereum.org/en/whitepaper/",
    upvoters: [],
    avatars: [],
    timestamp: new Date() / 1000 - 60,
    identity: "0x00000000000000000000000000000000CafeBabe",
    displayName: "you",
  };
  const rowNumber = 0;
  const rowStyle =
    "overflow: hidden; max-width: 600px; min-height: 65px; padding: 1rem 1rem 0 1rem;";
  const interactive = true;
  return html`
    <html lang="en" op="news">
      <head>
        ${prefetchHead(["/", "/best"])}
      </head>
      <body ontouchstart="">
        <div class="container">
          ${Sidebar(path)}
          <div id="hnmain" class="scaled-hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              ${Row(rowNumber, "/submit", rowStyle, interactive)(story)}
              <tr>
                <td>
                  <form style="${formContainerStyle}">
                    <div style="${labelInputContainerStyle}">
                      <label for="title" style="${labelStyle}">Title:</label>
                      <div
                        contenteditable="true"
                        role="textbox"
                        aria-multiline="true"
                        id="titleInput"
                        name="title"
                        maxlength="80"
                        required
                        style="${editableContent}"
                        wrap="soft"
                        data-placeholder="Ethereum Whitepaper"
                        onpaste="
                          event.preventDefault();
                          const text = event.clipboardData.getData('text/plain');
                          document.execCommand('insertText', false, text);"
                      >
                        ${title}
                      </div>
                      <span style="font-size: 0.8rem;">
                        <span>Characters remaining: </span>
                        <span class="remaining"
                          >${80 - title.length}</span
                        ></span
                      >
                    </div>
                    <div id="submit-button">
                      <div style="${labelInputContainerStyle}">
                        <label for="link" style="${labelStyle}">Link:</label>
                        <div style="display: flex; align-items: center;">
                          <input
                            placeholder="Enter or paste article URL"
                            id="urlInput"
                            type="text"
                            name="link"
                            size="50"
                            maxlength="2048"
                            required
                            style="${inputStyle}"
                            value="${url}"
                          />
                          <input
                            type="file"
                            id="imageUpload"
                            accept="image/*"
                            style="display: none;"
                            disabled
                          />
                          <label
                            for="imageUpload"
                            style="
                              margin-left: 10px;
                              padding: 0 16px;
                              background-color: grey;
                              color: #fff;
                              border-radius: 2px;
                              cursor: pointer;
                              font-size: 14px;
                              height: 50px;
                              box-sizing: border-box;
                              display: flex;
                              align-items: center;
                              justify-content: center;
                              text-align: center;
                            "
                          >
                            Upload Image
                          </label>
                        </div>
                      </div>
                      <div
                        style="display: flex;flex-direction: column;gap: 5px; max-width: 600px; margin-top: 2rem;"
                      >
                        <label
                          style="display:flex;gap:1rem;align-items:center;"
                        >
                          <input
                            type="checkbox"
                            style="transform:scale(1.5);"
                          />
                          Submit story as an ad
                        </label>
                      </div>
                      <button
                        id="button-onboarding"
                        disabled
                        style="width: 100%;max-width: 600px;margin-top: 2rem;padding: 5px;font-size: 16px;cursor: pointer;"
                      >
                        Loading...
                      </button>
                      <p>Please <b>only</b> submit Ethereum-related content</p>
                    </div>
                  </form>
                </td>
              </tr>
              <tr>
                <td>
                  <div style="${previewContainerStyle}">
                    <div style="${previewStyle}" id="embed-preview"></div>
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
const submitButtonStyles = {
  width: "100%",
  maxWidth: "600px",
  marginTop: "1rem",
  padding: "5px",
  fontSize: "16px",
  cursor: "pointer",
};
const formContainerStyle = `
   display: flex;
   flex-direction: column;
   gap: 15px;
   margin: 0 auto;
   padding: 1rem 1rem;
 `;

const labelInputContainerStyle = `
   display: flex;
   flex-direction: column;
   gap: 5px;
   max-width: 600px;
 `;

const labelStyle = `
   font-size: 16px;
 `;
const inputStyle = `
   width: 80%;
   padding: 12px 16px;
   font-size: 16px;
   box-sizing: border-box;
   border: 2px solid black;
   background: white;
   min-height: 50px;
   border-radius: 2px;
`;

const buttonStyle = `
   width: 100%;
   max-width: 600px;
   margin-top: 0.5rem;
   padding: 5px;
   font-size: 16px;
   cursor: pointer;
 `;

const fileInputStyle = `
   display: none;
 `;

const fileInputLabelStyle = `
   width: 33px;
   height: 33px;
   display: flex;
   align-items: center;
   justify-content: center;
   background: grey;
   color: #fff;
   border-radius: 2px;
   cursor: pointer;
 `;

const editableContent = `
   overflow-wrap: anywhere;
   width: 100%;
   max-width: 600px;
   height: 105px;
   padding: 20px;
   font-size: 19px;
   box-sizing: border-box;
   border: 1px solid #828282;
   overflow: auto;
   resize: both;
   white-space: pre-wrap;
   background-color: #fafafa;
   color: black;
   border-radius: 2px;
 `;

const previewContainerStyle = `
  display: flex;
  flex-direction: column;
  margin: 0 auto;
  padding: 1rem 1rem;
`;

const previewStyle = `
  width: 100%;
  max-width: 600px;
  min-height: 450px;
  font-size: 16px;
  box-sizing: border-box;
`;
