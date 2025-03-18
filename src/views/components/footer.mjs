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

  // Check if CSS path exists in the manifest
  const cssLink =
    manifest["src/main.css"] && manifest["src/main.css"].css
      ? html`<link rel="stylesheet" href="${manifest["src/main.css"].css}" />`
      : "";

  // Check if JS path exists in the manifest
  const jsScript =
    manifest["src/main.jsx"] && manifest["src/main.jsx"].file
      ? html`<script
          type="module"
          src="${manifest["src/main.jsx"].file}"
        ></script>`
      : "";

  // Combine the elements
  scripts = html`${cssLink}${jsScript}`;
} else {
  // NOTE: There can be cases where you want to test the development build with
  // vite hot reloading and then it's best to define your machine's host name
  // as the CUSTOM_HOST_NAME here - and not have it be localhost.
  const protocol = env.CUSTOM_PROTOCOL ? env.CUSTOM_PROTOCOL : "http://";
  const host = env.CUSTOM_HOST_NAME ? env.CUSTOM_HOST_NAME : "localhost:5173";
  scripts = html`
    <script type="module" src="refresh-react.js"></script>
    <script type="module" src="${protocol}${host}/@vite/client"></script>
    <script type="module" src="${protocol}${host}/src/main.jsx"></script>
  `;
}

const footer = (theme, path) => html`
  ${Nav(path)}
  <footer style="overflow-y: hidden; background-color: var(--header-beige);">
    <div
      class="footer-table"
      style="display: flex; justify-content: space-around; padding: 0.75rem 0 1rem 0;"
    >
      <div>
        <strong>Resources</strong><br />
        <a href="/privacy-policy">Privacy Policy</a><br />
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
    <div
      style="display: flex; justify-content: center; align-items: center; gap: 0.5rem;"
    >
      <img
        loading="lazy"
        src="/etherium.webp"
        alt="Powered by Ethereum"
        style="height: 4.5rem;"
      />
      <div>
        <span>This instance of Kiwi News is hosted by </span>
        <a
          style="text-decoration: underline;"
          href="https://attestate.com"
          target="_blank"
          >attestate.com</a
        >
        <span> (Kontakt).</span>
      </div>
    </div>

    ${scripts}
    <script
      defer
      src="https://www.googletagmanager.com/gtag/js?id=G-21BKTD0NKN"
    ></script>
    <script defer src="ga.js"></script>
    <script async src="instantpage.js" type="module"></script>
    <nav-signup-dialogue />
  </footer>
`;
export default footer;
