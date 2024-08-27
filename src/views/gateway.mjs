//@format

import htm from "htm";
import vhtml from "vhtml";
import DOMPurify from "isomorphic-dompurify";

import Header from "./components/header.mjs";
import { ethereum } from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";
import * as ens from "../ens.mjs";
import * as frame from "../frame.mjs";

const html = htm.bind(vhtml);

const Octant = html` <svg
  data-test="Svg"
  viewBox="0 0 40 40"
  style="height: 1rem;"
>
  <g clip-path="url(#octant)">
    <path
      fill="#171717"
      fill-rule="evenodd"
      d="M40 20C40 5.244 34.78 0 20 0 5.263 0 0 5.312 0 20c0 14.632 5.35 20 20 20 14.693 0 20-5.3 20-20Zm-27.067 6.058a6.06 6.06 0 0 0 5.588-3.715 9.095 9.095 0 0 0 7.854 6.697c.78.08.929-.056.929-.9v-3.62c0-.707.239-1.491 1.371-1.491h2.172c.468 0 .487-.01.752-.385 0 0 1.139-1.59 1.365-1.928.226-.338.203-.426 0-.716S31.6 18.106 31.6 18.106c-.266-.37-.288-.378-.752-.378h-2.893c-.473 0-.65.252-.65.757v2.627c0 .64 0 1.16-.93 1.16-1.35 0-2.082-1.017-2.082-2.272 0-1.1.816-2.227 2.083-2.227.852 0 .929-.204.929-.613v-5.49c0-.72-.314-.773-.93-.71a9.095 9.095 0 0 0-7.852 6.696A6.06 6.06 0 0 0 6.874 20a6.058 6.058 0 0 0 6.058 6.058Zm0-4.039a2.02 2.02 0 1 0 0-4.039 2.02 2.02 0 0 0 0 4.04Z"
      clip-rule="evenodd"
    ></path>
  </g>
  <defs>
    <clipPath id="octant"><path fill="#fff" d="M0 0h40v40H0z"></path></clipPath>
  </defs>
</svg>`;

export default async function (referral) {
  return html`
    <html lang="en" op="news">
      <head>
        ${Head} ${frame.header(referral)}
      </head>
      <body>
        <a
          href="/kiwipass-mint?discount=octant"
          style="position: sticky; top: 0; display: block; color: #2d9b87; background-color: white; font-weight: bold; font-size: 1rem; text-align: center; padding: 10px; text-decoration: none; z-index: 1000;"
        >
          <span
            style="display: flex; align-items: center; justify-content: center; gap: 0.25rem; "
          >
            ${Octant} Octant voter? Get a discount!
          </span>
        </a>
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
