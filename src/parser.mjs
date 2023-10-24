import ogs from "open-graph-scraper";
import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);

function safeExtractDomain(link) {
  let parsedUrl;
  try {
    parsedUrl = new URL(link);
  } catch (err) {
    return "";
  }

  const parts = parsedUrl.hostname.split(".");
  const tld = parts.slice(-2).join(".");
  return tld;
}

const filtered = [
  "kiwistand.com",
  "kiwinews.xyz",
  "kiwinews.io",
  "instagram.com",
  "warpcast.com",
  "twitter.com",
  "x.com",
];
const empty = html``;

export const parse = async (url) => {
  let response;
  try {
    response = await ogs({ url });
  } catch (err) {
    return empty;
  }

  const { result } = response;
  const domain = safeExtractDomain(url);
  if (filtered.includes(domain) || (result && !result.success)) return empty;

  let image;
  if (result.ogImage && result.ogImage.length >= 1) {
    image = result.ogImage[0].url;
  }
  if (result.twitterImage && result.twitterImage.length >= 1) {
    image = result.twitterImage[0].url;
  }
  const { ogTitle } = result;
  let { ogDescription } = result;

  if (
    !ogTitle ||
    (!ogDescription && !image) ||
    (image && !image.startsWith("https://"))
  )
    return empty;
  if (ogDescription) {
    ogDescription = `${ogDescription.substring(0, 150)}...`;
  }

  return html`
    <div
      onclick="navigator.clipboard.writeText('${ogTitle}')"
      style="cursor:pointer; display: flex; flex-direction: column; border: 1px solid #ccc;
  border-radius: 3px; overflow: hidden;"
    >
      <div style="background-color: #e6e6df; padding: 1rem; color: #777;">
        <div style="font-size: 0.7rem; margin-bottom: 0.5rem;">${domain}</div>
        <div style="font-size: 0.9rem; color: #000; margin-bottom: 0.5rem;">
          ${ogTitle}
        </div>
        <div style="font-size: 0.7rem;">${ogDescription}</div>
      </div>
      ${image
        ? html`<div
            style="width: 100%; height: 0; padding-bottom: 50%; position: relative;"
          >
            <img
              src="${image}"
              style="width: 100%; height: 100%; position: absolute; object-fit:
 cover;"
            />
          </div>`
        : null}
    </div>
  `;
};
