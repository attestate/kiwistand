//@format
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);
const footer = html`
  <span
    >Three great stories about crypto a day, check back tomorrow for more!</span
  >
  <br />
  <span>Today's stories were curated by </span>
  <a style="color:black;" href="https://twitter.com/mptherealmvp">
    @mptherealmvp</a
  >
  <span> and </span>
  <a style="color:black;" href="https://warpcast.com/chrsmaral">@chrsmaral</a>
  <div id="privacy-notice" style="width: 85%; padding: 5px; font-size: 10px;">
    <h2 style="font-size: 12px; margin: 0 0 3px; color: #f0f0f0;">
      Privacy Notice & Cookie Policy
    </h2>
    <p style="margin: 0 0 3px; color: #e0e0e0;">
      We use Google Analytics, a web analysis service provided by Google Inc.,
      on our website. Google Analytics uses cookies to analyze your use of the
      website, generate reports on website activity, and provide other services
      related to website usage and internet usage.
    </p>
    <p style="margin: 0 0 3px; color: #e0e0e0;">
      Google may transfer this information to third parties if required by law
      or if third parties process this data on behalf of Google. Google will not
      associate your IP address with any other data held by Google.
    </p>
    <p style="margin: 0; color: #e0e0e0;">
      By using this website, you consent to the processing of data about you by
      Google in the manner and for the purposes set out above. For more
      information, please review our
      <a
        href="/privacy-policy"
        style="color: #ffffff; text-decoration: underline;"
        >Privacy Policy</a
      >.
    </p>
  </div>
  <script src="bundle.js"></script>
`;
export default footer;
