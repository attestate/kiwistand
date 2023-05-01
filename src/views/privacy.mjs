//@format
import { env } from "process";
import url from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import { formatDistanceToNow } from "date-fns";

import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import * as store from "../store.mjs";
import banlist from "../../banlist.mjs";
import * as id from "../id.mjs";

const html = htm.bind(vhtml);

function extractDomain(link) {
  const parsedUrl = new url.URL(link);
  return parsedUrl.hostname;
}

const addresses = banlist.addresses.map((addr) => addr.toLowerCase());
const hrefs = banlist.hrefs.map((href) => normalizeUrl(href));
export function moderate(leaves) {
  return leaves
    .map((leaf) => ({
      address: id.ecrecover(leaf),
      ...leaf,
    }))
    .filter(({ address }) => !addresses.includes(address.toLowerCase()))
    .filter(({ href }) => !hrefs.includes(normalizeUrl(href)));
}

const totalStories = parseInt(env.TOTAL_STORIES, 10);
export default async function index(trie, theme) {
  let leaves = await store.leaves(trie);
  leaves = moderate(leaves);
  const stories = store.count(leaves).slice(0, totalStories);
  return html`
    <html lang="en" op="news">
      <head>
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-21BKTD0NKN"
        ></script>
        <script src="ga.js"></script>
        <meta charset="utf-8" />
        <meta name="referrer" content="origin" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link
          rel="apple-touch-icon"
          sizes="152x152"
          href="apple-touch-icon.png"
        />
        <link rel="stylesheet" type="text/css" href="news.css" />
        <link rel="shortcut icon" href="favicon.ico" />
        <title>Kiwi News</title>
      </head>
      <body>
        <center>
          <table
            id="hnmain"
            border="0"
            cellpadding="0"
            cellspacing="0"
            width="85%"
            bgcolor="#f6f6ef"
          >
            <tr>
              ${Header(theme)}
            </tr>
              <tr>
                <td>
                  <h1>Privacy Policy for Kiwi News</h1>
<p>Last updated: (Insert date)</p>
<p>This Privacy Policy outlines the types of data collected by Kiwi News, how it is used, and how it is protected. By using Kiwi News, you agree to the collection and use of information in accordance with this policy.</p>
<h2>Data Controller:</h2>
<p>Kiwi News is hosted by an individual, _____.</p>
<h2>Data Collection and Usage:</h2>
<ul>
  <li>Google Analytics: We collect data such as browsing history, device information, and location data to observe and analyze user behavior, aiming to grow the application's user base. For more information on Google Analytics data practices, please refer to <a href="https://policies.google.com/privacy">their privacy policy</a>.</li>
  <li>Email Newsletter: Users can sign up for our email newsletter via Buttondown.email. Email addresses are collected for this purpose.</li>
  <li>Customized Theme: We store a cookie for each user's selected theme on the page.</li>
  <li>Wallet Address: We record users' NFT minter's addresses for storing stories and granting privileged access. Users need to mint an NFT to interact with the page on Zora, which may also collect data. For more information, refer to <a href="https://zora.co/legal/privacy">Zora's privacy policy</a>.</li>
</ul>
<h2>Data Sharing:</h2>
<p>We use service providers that may have access to parts of the data: Hetzner, Google Analytics, Buttondown.email, and Zora. Data transfers to third countries such as the United States are done under the legal basis of Standard Contractual Clauses.</p>
<h2>Data Retention:</h2>
<p>EIP712 messages are potentially available indefinitely in our p2p network and are public. A set reconciliation algorithm replaces them across a number of nodes. Deletion of these messages is not possible.</p>
<h2>User Rights:</h2>
<p>All users have access to the stories and upvotes submitted via the p2p network through the respective APIs. Users cannot delete or modify data once it's submitted to the p2p network. For exercising rights related to data processed by our service providers, users should contact the respective providers directly.</p>
<h2>Security Measures:</h2>
<p>We implement industry-standard security measures to protect user data.</p>
<h2>Minors:</h2>
<p>Our site is not intended for minors. We do not knowingly collect or process data from minors.</p>
<h2>Policy Updates:</h2>
<p>Users can check this policy for updates by referring to the "Last updated" date.</p>
<h2>Contact Information:</h2>
<p>If you have any questions or concerns regarding this privacy policy, please contact _____.</p>
<p>By using Kiwi News, you consent to the practices described in this Privacy Policy.</p> 
                </td>
              </tr>
          </table>
          ${Footer}
        </center>
      </body>
    </html>
  `;
}
