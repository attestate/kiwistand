import htm from "htm";
import vhtml from "vhtml";
import DOMPurify from "isomorphic-dompurify";
import { env } from "process";

import PwaLinks from "./pwaLinks.mjs";

const html = htm.bind(vhtml);

// Determine domain dynamically
let domain = "https://news.kiwistand.com";
if (env.CUSTOM_PROTOCOL && env.CUSTOM_HOST_NAME) {
  const [hostname] = env.CUSTOM_HOST_NAME.split(":");
  domain = `${env.CUSTOM_PROTOCOL}${hostname}`;
}

export function custom(
  ogImage = `${domain}/preview.jpeg`,
  ogTitle = "Kiwi News - handpicked web3 alpha",
  ogDescription = "",
  twitterCard = "summary_large_image",
  prefetch = [],
  canonicalUrl = null,
  frameImage = null,
  variant = null,
) {
  const embedMetaContent = JSON.stringify({
    version: "next",
    imageUrl: frameImage || ogImage,
    button: {
      title: "Open Kiwi News",
      action: {
        name: "Kiwi News",
        type: "launch_frame",
        url: canonicalUrl || `${domain}/?miniapp=true`,
      },
    },
  });
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
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="preconnect" href="https://www.googletagmanager.com" />
    <link rel="preconnect" href="https://api.ensdata.net/" />
    <link
      rel="preload"
      as="style"
      href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=optional"
    />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=optional"
    />
    <style>
      /* Critical CSS to prevent layout shift */
      :root {
        --font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
      
      /* Predefine font metrics to prevent shifts */
      body {
        font-family: var(--font-family);
        font-synthesis: none;
        text-rendering: optimizeLegibility;
      }
      
      /* Set minimum heights for table rows to prevent vertical shifts */
      tr {
        min-height: 91px;
      }
      
      .title {
        min-height: 36px;
        line-height: 1.4;
      }
      
      .subtext {
        min-height: 20px;
        line-height: 1.4;
      }
      
      /* Ensure consistent table layout */
      table {
        table-layout: fixed;
      }
      
      /* Remove custom @font-face to avoid double-loading Inter; use Google CSS above */
    </style>
    <script src="event-queue.js"></script>
    <meta charset="utf-8" />
    <meta name="referrer" content="origin" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1,
 user-scalable=0 viewport-fit=cover"
    />
    <meta name="fc:frame" content="${embedMetaContent}" />
    ${variant ? html`<meta name="kiwi-variant" content="${variant}" />` : ''}
    ${ogImage ? html`<meta property="og:image" content="${ogImage}" />` : null}
    ${ogImage
      ? html`<meta property="twitter:image" content="${ogImage}" />`
      : null}
    <meta property="twitter:card" content="${twitterCard}" />
    <meta property="og:title" content="${ogTitle}" />
    ${ogDescription
      ? html`<meta property="og:description" content="${ogDescription}" />`
      : ""}
    <link rel="preload" href="news.css" as="style" />
    <link rel="stylesheet" href="news.css" />
    <link rel="shortcut icon" href="favicon.ico" type="image/x-icon" />
    ${PwaLinks()}
    <title>${ogTitle}</title>
    ${canonicalUrl
      ? html`<link rel="canonical" href="${canonicalUrl}" />`
      : null}
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
