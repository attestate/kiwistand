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

export default async function (theme) {
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
      </head>
      <body>
        <div class="container">
          ${Sidebar()}
          <div id="hnmain" class="scaled-hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                <td style="padding: 1rem;">
                  <h1>Privacy Policy for Kiwi News</h1>
                  <p>Last updated: 2025-03-31</p>

                  <h2>1. Introduction</h2>
                  <p>
                    This Privacy Policy outlines how Kiwi News collects, uses,
                    and protects your information when you use our service. We
                    are committed to protecting your privacy in compliance with
                    applicable data protection laws, including the General Data
                    Protection Regulation (GDPR).
                  </p>

                  <h2>2. Data Controller</h2>
                  <p>
                    Kiwi News is operated by Tim Daubenschütz, who serves as the
                    Data Controller for your personal data.
                  </p>
                  <p>Contact: tim@daubenschuetz.de</p>

                  <h2>3. Information We Collect</h2>

                  <h3>3.1. Analytics Data</h3>
                  <p>We use the following analytics services:</p>
                  <ul>
                    <li>
                      <strong>Google Analytics:</strong> We collect data such as
                      browsing patterns, device information, and location data
                      to analyze usage and improve our service. For details, see
                      <a href="https://policies.google.com/privacy"
                        >Google's privacy policy</a
                      >.
                    </li>
                    <li>
                      <strong>PostHog:</strong> We use PostHog to track user
                      interactions with our platform. For details, see
                      <a href="https://posthog.com/privacy"
                        >PostHog's privacy policy</a
                      >.
                    </li>
                  </ul>

                  <h3>3.2. Blockchain and Web3 Data</h3>
                  <ul>
                    <li>
                      <strong>Ethereum Addresses:</strong> We process wallet
                      addresses to enable blockchain-related features and
                      provide access to certain content.
                    </li>
                    <li>
                      <strong>ENS Data:</strong> We retrieve and cache Ethereum
                      Name Service (ENS) data including names, avatars, and
                      profile information.
                    </li>
                    <li>
                      <strong>Farcaster Data:</strong> We fetch Farcaster
                      profile information through ENS data integration to
                      enhance user profiles.
                    </li>
                    <li>
                      <strong>Lens Protocol Data:</strong> We retrieve Lens
                      Protocol profile data to display in our user interface.
                    </li>
                    <li>
                      <strong>NFT Data:</strong> We record NFT minting
                      information through our built-in minting functionality to
                      grant access to features.
                    </li>
                  </ul>

                  <h3>3.3. Technical Data</h3>
                  <ul>
                    <li>
                      <strong>Cookies:</strong> We use cookies to store user
                      identity and track update timestamps. These are necessary
                      for the proper functioning of our service.
                    </li>
                    <li>
                      <strong>Local Storage Data:</strong> We store
                      authentication information and user preferences in your
                      browser's local storage.
                    </li>
                    <li>
                      <strong>WebAuthn/Passkeys:</strong> We support secure
                      authentication using WebAuthn, which may store credential
                      data on your device.
                    </li>
                    <li>
                      <strong>Usage Fingerprinting:</strong> We use a
                      privacy-preserving method to count unique interactions
                      with content (such as clicks and impressions). This helps
                      us measure content performance and prevent manipulation of
                      rankings. This method is designed to maintain anonymity—we
                      cannot identify which specific user interacted with which
                      content, and we only store anonymized aggregate
                      statistics.
                    </li>
                  </ul>

                  <h3>3.4. Communication Data</h3>
                  <ul>
                    <li>
                      <strong>Transactional Emails:</strong> We use Postmark to
                      send transactional emails, such as notifications and
                      account-related messages. Postmark retains email content
                      and metadata for 45 days, after which it is removed from
                      their system. For more information, see
                      <a href="https://postmarkapp.com/privacy-policy"
                        >Postmark's privacy policy</a
                      >.
                    </li>
                    <li>
                      <strong>Marketing Emails:</strong> If you subscribe to
                      email notifications, we collect your email address. We use
                      Paragraph for managing certain communications. See their
                      <a href="https://paragraph.xyz/privacy">privacy policy</a>
                      for details.
                    </li>
                    <li>
                      <strong>Push Notifications:</strong> We store subscription
                      information to send web push notifications if you opt in.
                    </li>
                    <li>
                      <strong>Telegram Integration:</strong> If you choose to
                      connect with Telegram, we process authentication data to
                      generate invitation links.
                    </li>
                  </ul>

                  <h3>3.5. Image Data</h3>
                  <p>
                    We use Cloudflare Images for image uploads and storage. When
                    you upload images to our platform, they are stored on
                    Cloudflare's infrastructure. See Cloudflare's
                    <a href="https://www.cloudflare.com/privacypolicy/"
                      >privacy policy</a
                    >
                    for details.
                  </p>

                  <h3>3.6. Mobile App Data</h3>
                  <p>
                    Our iOS app may collect additional device information
                    required for app functionality. Apple's App Store and
                    TestFlight may collect usage data according to
                    <a href="https://www.apple.com/legal/privacy/en-ww/"
                      >Apple's privacy policy</a
                    >.
                  </p>

                  <h2>4. Peer-to-Peer Network and Content Distribution</h2>
                  <p>
                    Content submitted to our platform is distributed through a
                    peer-to-peer network as cryptographically signed messages.
                    Please be aware that:
                  </p>
                  <ul>
                    <li>Content posted on the platform is public by design</li>
                    <li>
                      Messages are cryptographically signed with your wallet
                    </li>
                    <li>Content is distributed across a network of nodes</li>
                    <li>
                      Due to the decentralized nature of the system, complete
                      deletion of this content may not be technically possible
                    </li>
                  </ul>

                  <h2>5. Legal Basis for Processing</h2>
                  <p>
                    We process your data based on the following legal grounds:
                  </p>
                  <ul>
                    <li>
                      <strong>Contract Performance:</strong> Processing
                      necessary to provide you with our service.
                    </li>
                    <li>
                      <strong>Consent:</strong> Where you have given explicit
                      consent, such as for analytics or newsletters.
                    </li>
                    <li>
                      <strong>Legitimate Interest:</strong> Where we have a
                      legitimate interest in processing data to operate, improve
                      and secure our service.
                    </li>
                  </ul>

                  <h2>6. Data Retention</h2>
                  <p>
                    We retain different types of data for different periods:
                  </p>
                  <ul>
                    <li>
                      <strong>P2P Network Content:</strong> Messages in our p2p
                      network are potentially available indefinitely due to the
                      distributed nature of the system.
                    </li>
                    <li>
                      <strong>Cached Profile Data:</strong> ENS, Farcaster, and
                      Lens profile data is cached temporarily to improve
                      performance.
                    </li>
                    <li>
                      <strong>Email Data:</strong> Transactional emails sent
                      through Postmark are retained for 45 days, after which
                      content and metadata are removed from their system.
                    </li>
                    <li>
                      <strong>Analytics Data:</strong> Retained according to our
                      analytics providers' retention policies.
                    </li>
                    <li>
                      <strong>Local Device Data:</strong> Stored until you clear
                      your browser storage or uninstall our mobile app.
                    </li>
                  </ul>

                  <h2>7. Data Sharing</h2>
                  <p>
                    We use the following service providers who may have access
                    to parts of your data:
                  </p>
                  <ul>
                    <li>
                      <strong>Hetzner:</strong> Our hosting provider for server
                      infrastructure.
                    </li>
                    <li>
                      <strong>Google Analytics and PostHog:</strong> For
                      analytics processing.
                    </li>
                    <li>
                      <strong>Cloudflare:</strong> For content delivery network
                      (CDN) services and image hosting.
                    </li>
                    <li>
                      <strong>Postmark:</strong> For sending transactional
                      emails.
                    </li>
                    <li>
                      <strong>Paragraph:</strong> For certain email
                      communications.
                    </li>
                    <li>
                      <strong>Apple:</strong> For iOS app distribution and
                      TestFlight beta testing.
                    </li>
                  </ul>

                  <h2>8. International Data Transfers</h2>
                  <p>
                    Some of our service providers may process your data outside
                    the European Economic Area (EEA). When you use our service,
                    you acknowledge that your information may be transferred to
                    and processed in countries where data protection laws may
                    differ from those in your country of residence.
                  </p>

                  <h2>9. Your Rights Under GDPR</h2>
                  <p>Under the GDPR, you have rights including:</p>
                  <ul>
                    <li>The right to access your personal data</li>
                    <li>The right to rectification of inaccurate data</li>
                    <li>
                      The right to erasure (with limitations regarding content
                      in the p2p network)
                    </li>
                    <li>The right to restrict processing</li>
                    <li>The right to data portability</li>
                    <li>
                      The right to object to processing based on legitimate
                      interest
                    </li>
                    <li>
                      The right to withdraw consent where processing is based on
                      consent
                    </li>
                  </ul>
                  <p>
                    To exercise these rights, please contact us at
                    tim@daubenschuetz.de. We will respond to your request within
                    one month as required by GDPR.
                  </p>
                  <p>
                    Please note that for content published through our p2p
                    network, complete deletion may not be technically possible
                    due to the decentralized nature of the system.
                  </p>

                  <h2>10. Data Security</h2>
                  <p>
                    We implement appropriate technical and organizational
                    measures to protect your data, including:
                  </p>
                  <ul>
                    <li>Secure hosting infrastructure</li>
                    <li>Encryption of sensitive data in transit and at rest</li>
                    <li>Regular security reviews and updates</li>
                    <li>Access controls and authentication systems</li>
                    <li>Secure development practices</li>
                  </ul>

                  <h2>11. Children's Privacy</h2>
                  <p>
                    Our service is not intended for individuals under 16 years
                    of age, and we do not knowingly collect personal data from
                    children.
                  </p>

                  <h2>12. Changes to This Policy</h2>
                  <p>
                    We may update this Privacy Policy periodically. We will
                    notify you of significant changes by posting the new policy
                    on this page with an updated revision date.
                  </p>

                  <h2>13. Complaints</h2>
                  <p>
                    If you have concerns about our data practices, please
                    contact us first. You also have the right to lodge a
                    complaint with your local data protection authority.
                  </p>

                  <h2>14. Contact Information</h2>
                  <p>
                    For questions or concerns regarding this privacy policy,
                    please contact:<br />
                    Tim Daubenschütz<br />
                    Email: tim@daubenschuetz.de
                  </p>
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
