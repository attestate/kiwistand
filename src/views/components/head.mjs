import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);

export default html`
  <meta charset="utf-8" />
  <meta name="referrer" content="origin" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta property="og:image" content="preview.jpeg" />
  <meta property="twitter:image" content="preview.jpeg" />
  <meta property="twitter:card" content="summary_large_image">
  <meta property="og:title" content="Kiwi News - handpicked web3 alpha">
  <link rel="apple-touch-icon" sizes="152x152" href="apple-touch-icon.png" />
  <link rel="stylesheet" type="text/css" href="news.css" />
  <link rel="shortcut icon" href="favicon.ico" type="image/x-icon" />
  <script
    defer
    src="https://unpkg.com/@zoralabs/zorb@^0.0/dist/zorb-web-component.umd.js"
  ></script>
  <title>Kiwi News</title>
`;
