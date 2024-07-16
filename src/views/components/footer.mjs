//@format
import { env } from "process";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

import htm from "htm";
import vhtml from "vhtml";

import Nav from "./nav.mjs";

const html = htm.bind(vhtml);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadManifest() {
  try {
    const manifestPath = path.resolve(__dirname, "../../public/manifest.json");
    const manifestJSON = readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestJSON);
    return manifest;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

let scripts;
if (env.NODE_ENV === "production") {
  const manifest = loadManifest();
  scripts = html`
    <link rel="stylesheet" href="${manifest["src/main.css"].css}" />
    <script type="module" src="${manifest["src/main.jsx"].file}"></script>
  `;
} else {
  // NOTE: There can be cases where you want to test the development build with
  // vite hot reloading and then it's best to define your machine's host name
  // as the CUSTOM_HOST_NAME here - and not have it be localhost.
  const host = env.CUSTOM_HOST_NAME ? env.CUSTOM_HOST_NAME : "localhost:5173";
  scripts = html`
    <script type="module" src="refresh-react.js"></script>
    <script type="module" src="http://${host}/@vite/client"></script>
    <script type="module" src="http://${host}/src/main.jsx"></script>
  `;
}

const footer = (theme, path) => html`
  ${["/", "/images", "/new", "/community"].includes(path)
    ? html`
        <div
          class="submit-button"
          style="position: fixed; right: 2rem; z-index: 5;"
        >
          <a
            class="submit-button"
            href="/submit"
            style="align-items: center; justify-content: center; height: 50px; width: 50px; background-color: black; border-radius: 2px; box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);"
          >
            <svg
              style="color: white; width: 1.75rem;"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 256 256"
            >
              <rect width="256" height="256" fill="none" />
              <path
                d="M92.69,216H48a8,8,0,0,1-8-8V163.31a8,8,0,0,1,2.34-5.65L165.66,34.34a8,8,0,0,1,11.31,0L221.66,79a8,8,0,0,1,0,11.31L98.34,213.66A8,8,0,0,1,92.69,216Z"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="16"
              />
              <line
                x1="136"
                y1="64"
                x2="192"
                y2="120"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="16"
              />
              <line
                x1="164"
                y1="92"
                x2="68"
                y2="188"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="16"
              />
              <line
                x1="95.49"
                y1="215.49"
                x2="40.51"
                y2="160.51"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="16"
              />
            </svg>
          </a>
        </div>
      `
    : null}
  ${Nav(path)}
  <footer style="overflow-y: hidden; background-color: #e6e6df;">
    <div
      class="footer-table"
      style="display: flex; justify-content: space-around; padding: 0.75rem 0 1rem 0;"
    >
      <div>
        <strong>Resources</strong><br />
        <a href="/kiwipass-mint">Access NFT</a><br />
        <a href="/privacy-policy">Privacy Policy</a><br />
        <a href="/onboarding">Onboarding</a><br />
        <a href="/shortcut">iOS Shortcut</a><br />
      </div>
      <div>
        <strong>Community</strong><br />
        <a href="/guidelines">Guidelines</a><br />
        <a href="https://dune.com/rvolz/kiwi-news" target="_blank"
          >Dune Dashboard</a
        ><br />
        <a
          href="https://drive.google.com/drive/folders/1vH5vEcXCsbbrYfCpTIvimLSzDMgq1eIa?usp=sharing"
          target="_blank"
          >Brand Assets</a
        >
      </div>
      <div>
        <strong>Devs</strong><br />
        <a target="_blank" href="https://attestate.com/kiwistand/main/">API</a
        ><br />
        <a target="_blank" href="https://kiwistand.github.io/kiwi-docs/">Docs</a
        ><br />
        <a
          target="_blank"
          href="https://github.com/attestate/kiwistand"
          target="_blank"
          >Source code</a
        ><br />
      </div>
    </div>
    <div style="display: flex; justify-content: center;">
      <div>
        <span>This instance of Kiwi News is hosted by </span>
        <a
          style="text-decoration: underline;"
          href="https://attestate.com"
          target="_blank"
          >attestate.com</a
        >
        (Kontakt).
      </div>
    </div>

    ${scripts}
    <script
      async
      src="https://www.googletagmanager.com/gtag/js?id=G-21BKTD0NKN"
    ></script>
    <script async src="ga.js"></script>
    <nav-signup-dialogue />
  </footer>
`;
export default footer;
