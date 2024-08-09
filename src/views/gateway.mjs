//@format

import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import { ethereum } from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";
import * as ens from "../ens.mjs";
import DOMPurify from "isomorphic-dompurify";

const html = htm.bind(vhtml);

export default async function (referral) {
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
      </head>
      <body>
        <nav-delegation-modal />
        <div class="container">
          <div
            id="hnmain"
            style="margin: 0 !important; border: none !important; background-color: #f6f6ef; width: 100%; height: 100vh; display: flex; justify-content: center; flex-direction: column;"
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
 border-radius: 2px; background-color: #e6e6df; text-align: left; padding: 1rem;"
                  >
                    <h3 style="color: black; margin: 0;">
                      Hacker News, without the "crypto derangement syndrome."
                    </h3>
                    <p style="margin: 0.75rem 0 2rem 0;">
                      Kiwi News is a self-funded, credible neutral,
                      decentralized Hacker News, built on the submissions of
                      crypto devs, founders, creators and investors.
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
                        >Already have an account?
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
                href="https://attestate.com"
                target="_blank"
                >Kontakt</a
              >
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}
