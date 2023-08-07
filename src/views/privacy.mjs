//@format
import { env } from "process";
import url from "url";

import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";

const html = htm.bind(vhtml);

export default function (theme) {
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
      </head>
      <body>
        <div class="container">
          ${Sidebar}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${Header(theme)}
              </tr>
              <tr>
                <td style="padding: 1rem;">
                  <h1>Privacy Policy for Kiwi News</h1>
                  <p>Last updated: 2023-05-01</p>
                  <p>
                    This Privacy Policy outlines the types of data collected by
                    Kiwi News, how it is used, and how it is protected. By using
                    Kiwi News, you agree to the collection and use of
                    information in accordance with this policy.
                  </p>
                  <h2>Data Controller:</h2>
                  <p>Kiwi News is hosted by Tim Daubenschütz.</p>
                  <h2>Data Collection and Usage:</h2>
                  <ul>
                    <li>
                      Google Analytics: We collect data such as browsing
                      history, device information, and location data to observe
                      and analyze user behavior, aiming to grow the
                      application's user base. For more information on Google
                      Analytics data practices, please refer to
                      <span> </span>
                      <a href="https://policies.google.com/privacy"
                        >their privacy policy</a
                      >.
                    </li>
                    <li>
                      Email Newsletter: Users can sign up for our email
                      newsletter via Buttondown.email. Email addresses are
                      collected for this purpose.
                      <span> </span>
                      <a href="https://buttondown.email/legal/privacy"
                        >Privacy Policy</a
                      >
                    </li>
                    <li>
                      Customized Theme: We store a cookie for each user's
                      selected theme on the page.
                    </li>
                    <li>
                      Wallet Address: We record users' NFT minter's addresses
                      for storing stories and granting privileged access. Users
                      need to mint an NFT to interact with the page on Zora,
                      which may also collect data. For more information, refer
                      to
                      <span> </span>
                      <a
                        href="https://support.zora.co/en/articles/6383373-zora-privacy-policy"
                        >Zora's privacy policy</a
                      >.
                    </li>
                  </ul>
                  <h2>Data Sharing:</h2>
                  <p>
                    We use service providers that may have access to parts of
                    the data: Hetzner, Google Analytics, Buttondown.email, and
                    Zora. Data transfers to third countries such as the United
                    States are done under the legal basis of Standard
                    Contractual Clauses.
                  </p>
                  <h2>Data Retention:</h2>
                  <p>
                    EIP712 messages are potentially available indefinitely in
                    our p2p network and are public. A set reconciliation
                    algorithm replaces them across a number of nodes. Deletion
                    of these messages is not possible.
                  </p>
                  <h2>User Rights:</h2>
                  <p>
                    All users have access to the stories and upvotes submitted
                    via the p2p network through the respective APIs. Users
                    cannot delete or modify data once it's submitted to the p2p
                    network. For exercising rights related to data processed by
                    our service providers, users should contact the respective
                    providers directly.
                  </p>
                  <h2>Security Measures:</h2>
                  <p>
                    We implement industry-standard security measures to protect
                    user data.
                  </p>
                  <h2>Minors:</h2>
                  <p>
                    Our site is not intended for minors. We do not knowingly
                    collect or process data from minors.
                  </p>
                  <h2>Policy Updates:</h2>
                  <p>
                    Users can check this policy for updates by referring to the
                    "Last updated" date.
                  </p>
                  <h2>Contact Information:</h2>
                  <p>
                    If you have any questions or concerns regarding this privacy
                    policy, please contact tim@daubenschuetz.de.
                  </p>
                  <p>
                    By using Kiwi News, you consent to the practices described
                    in this Privacy Policy.
                  </p>
                </td>
              </tr>
            </table>
          </div>
        </div>
        ${Footer(theme)}
      </body>
    </html>
  `;
}
