//@format

import htm from "htm";
import vhtml from "vhtml";
import DOMPurify from "isomorphic-dompurify";

import Header from "./components/header.mjs";
import { ethereum } from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";
import * as ens from "../ens.mjs";

const html = htm.bind(vhtml);

export default async function (referral) {
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
      </head>
      <body ontouchstart="">
        <nav-delegation-modal />
        <div class="container">
          <div
            id="hnmain"
            style="margin: 0 !important; border: none !important; background-color: #f6f6ef; width: 100%; height: 100vh; display: flex; justify-content: start; flex-direction: column;"
          >
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                <div
                  style="background-color: #f6f6ef; display: flex; width: 100%; align-items: center;justify-content: center; padding: 2rem 0 0 0; color: black;"
                >
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <img
                      src="pwa_icon.png"
                      style="width: 50px; border-radius: 0.75rem;"
                    />
                    <span style="font-size: 24px; font-weight: bold;"
                      >Kiwi News</span
                    >
                  </div>
                </div>
                <div
                  class="gateway-container"
                  style="padding: 0 15vw; display: flex; flex-wrap: wrap; justify-content: center; align-items: start;
 background-color: #f6f6ef;"
                >
                  <img
                    src="/webapp.webp"
                    alt="Decentralized HN"
                    style="flex: 1 1 auto; max-width: 50%; object-fit: contain; max-height: 80vh; padding-bottom: 20px;"
                  />
                  <div
                    class="gateway-banner"
                    style="flex: 1 1 auto; max-width: 50%; border: 1px solid rgba(0,0,0,0.1);
 border-radius: 2px; background-color: #e6e6df; text-align: left; padding: 1.5rem 2rem;"
                  >
                    <h3 style="font-size: 1.5rem; color: black; margin: 0;">
                      Onchain Hacker News
                    </h3>
                    <p style="font-size: 1.2rem; margin: 0.75rem 0 2rem 0;">
                      Join our community of onchain devs, founders, creators and
                      investors to curate the best Ethereum links!
                    </p>
                    <div
                      style="flex-direction: column; display: flex; align-items: center; justify-content: center;"
                    >
                      <a
                        href="/kiwipass-mint${referral
                          ? `?referral=${DOMPurify.sanitize(referral)}`
                          : ""}"
                        id="button-onboarding"
                        style="width: auto; font-weight: 700;"
                      >
                        Sign up
                      </a>
                      <br />
                      <span style="color: black;"
                        >Already have a Kiwi Pass?
                        <span> </span>
                        <div
                          style="color: black; font-weight: bold;"
                          class="connect-button-wrapper"
                        >
                          Connect
                        </div>
                      </span>
                    </div>
                  </div>
                </div>
              </tr>
            </table>
            <div style="display: none;">${Footer()}</div>
            <div
              style="margin-top: 1rem; background-color: #f6f6ef; text-align: center;"
            >
              <a
                style="color: rgba(0,0,0,0.4); text-decoration: underline;"
                href="https://kiwistand.github.io/kiwi-docs/"
                >About</a
              >
              <span> | </span>
              <a
                style="color: rgba(0,0,0,0.4); text-decoration: underline;"
                href="https://attestate.com"
                target="_blank"
                >Kontakt</a
              >
              <span> | </span>
              <a
                style="color: rgba(0,0,0,0.4); text-decoration: underline;"
                href="https://warpcast.com/kiwi"
                target="_blank"
                >Warpcast</a
              >
              <span> | </span>
              <a
                style="color: rgba(0,0,0,0.4); text-decoration: underline;"
                href="https://x.com/KiwiNewsHQ"
                target="_blank"
                >X (Twitter)</a
              >
              <span> | </span>
              <a
                style="color: rgba(0,0,0,0.4); text-decoration: underline;"
                href="https://orb.club/@kiwinews"
                target="_blank"
                >Orb</a
              >
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}
