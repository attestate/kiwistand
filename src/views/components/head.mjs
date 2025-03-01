import htm from "htm";
import vhtml from "vhtml";
import DOMPurify from "isomorphic-dompurify";

import PwaLinks from "./pwaLinks.mjs";

const html = htm.bind(vhtml);

export function custom(
  ogImage = "https://news.kiwistand.com/preview.jpeg",
  ogTitle = "Kiwi News - handpicked web3 alpha",
  ogDescription = "",
  twitterCard = "summary_large_image",
  prefetch = [],
) {
  if (process.env.NODE_ENV === "production") {
    prefetch = [
      ...prefetch,
      "https://news.kiwistand.com:8443/api/v1/allowlist?cached=true",
      "https://news.kiwistand.com:8443/api/v1/delegations?cached=true",
    ];
  }
  ogImage = DOMPurify.sanitize(ogImage);
  ogTitle = DOMPurify.sanitize(ogTitle);
  ogDescription = DOMPurify.sanitize(ogDescription);
  return html`
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://www.googletagmanager.com">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" media="print" onload="this.media='all'">
    <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"></noscript>
    <script src="event-queue.js"></script>
    <meta charset="utf-8" />
    <meta name="referrer" content="origin" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1,
 user-scalable=0 viewport-fit=cover"
    />
    ${ogImage ? html`<meta property="og:image" content="${ogImage}" />` : null}
    ${ogImage
      ? html`<meta property="twitter:image" content="${ogImage}" />`
      : null}
    <meta property="twitter:card" content="${twitterCard}" />
    <meta property="og:title" content="${ogTitle}" />
    ${ogDescription
      ? html`<meta property="og:description" content="${ogDescription}" />`
      : ""}
    <link rel="preload" href="news.css" as="style">
    <link rel="stylesheet" href="news.css">
    <link rel="shortcut icon" href="favicon.ico" type="image/x-icon" />
    ${PwaLinks()}
    <title>${ogTitle}</title>
    ${prefetch.map(
      (url) => html`
        <link rel="prefetch" href="${url}" as="document" fetchpriority="high" />
      `,
    )}
  `;
}
const regular = custom();

export const prefetchHead = (prefetch) =>
  custom(undefined, undefined, undefined, undefined, prefetch);

export default regular;
