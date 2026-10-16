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

// NOTE: Hints and labels as in Settings.jsx, which replaces #n2-settings
// once it has loaded. Keep them in sync: the server-rendered rows below are
// the same rows at the same sizes, so the page doesn't move when it mounts.
const analyticsHint =
  "Anonymous usage data (screens viewed, likes, comments) helps us improve Kiwi News. Once you’re logged in it’s linked to your address. No ads, no cross-app tracking.";
const rpcHint =
  "Chain reads go through Tor so RPC providers can’t tie them to your IP. Slower. Wallet transactions are unaffected.";

const Toggle = (label, checked) => html`<span class="n2-toggle">
  <input
    type="checkbox"
    role="switch"
    aria-label="${label}"
    checked=${checked}
    tabindex="-1"
  />
  <span class="n2-toggle-track"></span>
</span>`;

// NOTE: /settings, like the apps' settings screen and the "Web 2 · Desktop ·
// Settings" design. What depends on this browser (who is logged in, the
// analytics choice, anon-rpc) is rendered by Settings.jsx into #n2-settings.
// Until then the same rows show here: both versions of "Account" are
// rendered and news.css/pages.css show the one that matches
// html[data-signed-out] (set by theme-init.js before the first paint). The
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
          html`<div class="n2-set-ssr-in">
              <div class="n2-set-row">
                <span>Logged in as</span
                ><span class="n2-set-value n2-mono">…</span>
              </div>
              <div class="n2-set-row n2-set-danger">Log out</div>
            </div>
            <div class="n2-set-row n2-set-action n2-set-ssr-out">Log in</div>`,
        )}
        ${Section(
          "Privacy",
          html`<div class="n2-set-row">
            <span>Share usage analytics</span>${Toggle("Share usage analytics", true)}
          </div>`,
          analyticsHint,
        )}
        ${Section(
          "anon-rpc",
          html`<div class="n2-set-row n2-set-rpc">
            <span class="n2-set-rpc-ssr">
              <span>anon-rpc</span>
              <span class="n2-set-rpc-ssr-sub">Read the chain via Tor · about</span>
            </span>
            ${Toggle("anon-rpc", false)}
          </div>`,
          rpcHint,
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
