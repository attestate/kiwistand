//@format
import htm from "htm";
import vhtml from "vhtml";

import { custom } from "./components/head.mjs";
import { Page, BackBar, Section, Icon } from "./components/n2.mjs";

const html = htm.bind(vhtml);

const LinkRow = (href, label) => html`<a
  class="n2-set-row n2-set-link"
  href="${href}"
  ><span>${label}</span>${Icon("chevronRight")}</a
>`;

// NOTE: /settings, like the apps' settings screen and the "Web 2 · Desktop ·
// Settings" design. What depends on this browser (who is logged in, the
// analytics choice, Private RPC) is rendered by Settings.jsx into
// #n2-settings; the rows here are what it shows until it has loaded. The
// apps' muted words, blocked users and hidden posts don't exist on the web.
export default async function settings(theme) {
  return Page({
    theme,
    path: "/settings",
    backbar: BackBar("Settings", "/"),
    bodyClass: "n2-settings-page",
    head: custom(
      undefined,
      "Settings | Kiwi News",
      "Your account, privacy and Private RPC settings on Kiwi News.",
    ),
    body: html`<div class="n2-settings">
      <header class="n2-page-head n2-d">
        <h1 class="n2-title">Settings</h1>
      </header>
      <div id="n2-settings">
        ${Section(
          "Account",
          html`<div class="n2-set-row n2-set-placeholder">
            <span>Logged in as</span><span class="n2-set-value">…</span>
          </div>`,
        )}
        ${Section(
          "Privacy",
          html`<div class="n2-set-row n2-set-placeholder">
            <span>Share usage analytics</span>
          </div>`,
        )}
        ${Section(
          "Private RPC",
          html`<div class="n2-set-row n2-set-placeholder">
            <span>Private RPC</span>
          </div>`,
        )}
      </div>
      ${Section(
        "About",
        html`${LinkRow("/guidelines", "Guidelines")}
        ${LinkRow("/privacy-policy", "Privacy Policy")}
        ${LinkRow("/guidelines#community-rules", "Terms of Use")}
        ${LinkRow("mailto:tim@daubenschuetz.de", "Contact")}`,
      )}
    </div>`,
  });
}
