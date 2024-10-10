//@format
import htm from "htm";
import vhtml from "vhtml";
import { ethers } from "ethers";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";
import InviteRow from "./components/invite-row.mjs";
import * as ens from "../ens.mjs";
import * as price from "../price.mjs";
import * as registry from "../chainstate/registry.mjs";
import { getLeaders } from "../cache.mjs";

const html = htm.bind(vhtml);

export default async function (theme) {
  const mints = await registry.mints();
  const { reward, percentageOff } = await price.getReferralReward(mints);
  const leaders = getLeaders();
  const ensLeaders = await Promise.all(
    leaders.map(({ identity, totalKarma }) =>
      ens.resolve(identity).then((resolved) => ({ ...resolved, totalKarma })),
    ),
  );

  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
      </head>
      <body ontouchstart="">
        <div class="container">
          ${Sidebar("/referral")}
          <div id="hnmain" class="scaled-hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                <td style="padding: 1rem; text-align: left;">
                  <h1 style="color: black; font-size: 1.5rem;">
                    Curate to earn
                  </h1>
                  <p>Let's grow the Kiwi community together!</p>
                  <p>
                    We've designed an incentive program for those who curate the
                    content on Kiwi News.
                  </p>
                  <p>
                    The website charges a slight premium over the smart
                    contract. We're forwarding this amount to the top karma
                    earners.
                  </p>
                  <div style="display: flex; justify-content: center;">
                    <img
                      style="width: 80%; border: 1px solid #828282;"
                      src="onchainprice.png"
                    />
                  </div>
                  <h1
                    style="margin-top: 1.5rem; color: black; font-size: 1.5rem;"
                  >
                    How to become a Karma earner
                  </h1>
                  <p>
                    Through submitting good links and upvoting others' content
                    you can earn karma.
                  </p>
                  <p>
                    The top 10 karma earners of the last 7 days get a share of
                    the mint price!
                  </p>
                  <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                      <tr style="color: black;">
                        <th style="text-align: left; padding: 8px;">#</th>
                        <th style="text-align: left; padding: 8px;">Name</th>
                        <th style="text-align: left; padding: 8px;">
                          🥝 (7 days)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      ${ensLeaders.map(
                        (leader, index) => html`
                          <tr
                            style="background-color: ${index % 2 === 0
                              ? "transparent"
                              : "rgba(0,0,0,0.1)"};"
                          >
                            <td style="padding: 8px;">${index + 1}</td>
                            <td style="padding: 8px;">
                              <div style="display: flex; align-items: center;">
                                ${leader.safeAvatar
                                  ? html`<img
                                      src="${leader.safeAvatar}"
                                      style="width: 20px; height: 20px; vertical-align: middle; border: 1px solid #828282; border-radius: 2px; margin-right: 5px;"
                                    />`
                                  : ""}
                                <a
                                  href="/upvotes?address=${leader.address}"
                                  style="color: inherit; text-decoration: none;"
                                  >${leader.displayName}</a
                                >
                              </div>
                            </td>
                            <td style="padding: 8px;">${leader.totalKarma}</td>
                          </tr>
                        `,
                      )}
                    </tbody>
                  </table>
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
