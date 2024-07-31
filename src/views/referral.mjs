//@format
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";
import * as ens from "../ens.mjs";

const html = htm.bind(vhtml);
import { ethers } from "ethers";

export default async function (
  theme,
  websitePrice,
  onchainPrice,
  identity,
  leaders,
) {
  const ensLeaders = await Promise.all(
    leaders.map(({ identity, totalKarma }) =>
      ens.resolve(identity).then((resolved) => ({ ...resolved, totalKarma })),
    ),
  );

  const referralReward = (websitePrice - onchainPrice) / 2;
  const referralRewardEth = parseFloat(
    ethers.utils.formatEther(referralReward.toString()),
  ).toFixed(4);

  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
      </head>
      <body>
        <div class="container">
          ${Sidebar("/referral")}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                <td style="padding: 1rem; text-align: left;">
                  <h1 style="color: black; font-size: 1.5rem;">
                    Earn ${referralRewardEth} ETH for Every Friend You Invite
                  </h1>
                  <p>Let's grow the Kiwi community together!</p>
                  <p>
                    We've designed an incentive program for both those who
                    promote Kiwi to their friends on social media, as well as
                    for those who earn the most Kiwi Karma!
                  </p>
                  <p>
                    For each new sign up, we're giving away a percentage. The
                    website charges a slight premium over the smart contract.
                    But we're forwarding 50% of this amount to the referrer, and
                    50% to the top karma earners.
                  </p>
                  <div style="display: flex; justify-content: center;">
                    <img
                      style="width: 80%; border: 1px solid #828282;"
                      src="onchainprice.png"
                    />
                  </div>
                  <p>
                    If you send a friend the link below and they sign up, you're
                    being sent ${referralRewardEth} ETH immediately. No need to
                    wait for withdrawing or stupid retention games. You get the
                    funds sent directly to your wallet!
                  </p>
                  <p>
                    Best of all, the more people sign up, the bigger the
                    difference between website an onchain price will become!
                  </p>
                  <div
                    style="margin-top: 1rem; display: flex; align-items: center;"
                  >
                    <button
                      onclick="document.getElementById('invitelink').select(); document.execCommand('copy'); window.toast.success('Link copied!');"
                      id="button-onboarding"
                      style="border-radius: 2px; padding: 10px 15px; background-color: black; border: 1px
 solid black; color: white; cursor: pointer; width: 25%; margin-right: 10px;"
                    >
                      Copy
                    </button>
                    <input
                      id="invitelink"
                      type="text"
                      value="https://news.kiwistand.com/?referral=${identity}"
                      readonly
                      style="width: 75%; padding: 10px 15px; border: 1px solid #ccc; border-radius: 2px;"
                    />
                  </div>
                  <h1
                    style="margin-top: 1.5rem; color: black; font-size: 1.5rem;"
                  >
                    Get rewards by becoming a top karma earner!
                  </h1>
                  <p>
                    The other 50% of the price difference between website and
                    onchain price go to the top karma earners of the week!
                  </p>
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
