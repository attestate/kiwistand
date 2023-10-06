import htm from "htm";
import vhtml from "vhtml";
import { formatDistanceToNowStrict } from "date-fns";
import { URL } from "url";

import FCIcon from "./farcastericon.mjs";

const html = htm.bind(vhtml);

export function extractDomain(link) {
  const parsedUrl = new URL(link);
  const parts = parsedUrl.hostname.split(".");
  const tld = parts.slice(-2).join(".");
  return tld;
}

const row = (
  start = 0,
  style = "padding: 10px 5px 0 10px;",
  interactive,
  hideCast,
) => {
  const size = 12;
  return (story, i) => html`
    <tr>
      <td>
        <div style="${style}">
          <div style="display: flex; align-items: stretch;">
            <div
              style="display: flex; align-items: center; justify-content: center; min-width: 40px; margin-right: 6px;"
            >
              <a href="#" style="min-height: 40px; display:block;">
                <div
                  class="${interactive ? "" : "votearrowcontainer"}"
                  data-title="${story.title}"
                  data-href="${story.href}"
                  data-upvoters="${JSON.stringify(story.upvoters)}"
                >
                  <div>
                    <div
                      class="votearrow pulsate"
                      style="color: rgb(130, 130, 130); cursor: pointer;"
                      title="upvote"
                    >
                      ▲
                    </div>
                    <div style="font-size: 8pt; text-align: center;">...</div>
                  </div>
                </div>
              </a>
            </div>
            <div
              style="display:flex; justify-content: center; flex-direction: column; flex-grow: 1;"
            >
              <span>
                <a
                  href="${interactive ? "" : story.href}"
                  target="_blank"
                  class="story-link"
                  style="line-height: 13pt; font-size: 13pt;"
                >
                  ${story.title}
                </a>
                <span> </span>
                <span class="story-domain" style="white-space: nowrap;"
                  >(${extractDomain(story.href)})</span
                >
              </span>
              <div style="margin-top: auto; font-size: 10pt;">
                <span>
                  ${story.avatars.length > 1 &&
                  html`
                    <span>
                      <div
                        style="margin-left: ${size /
                        2}; top: 2px; display: inline-block; position:relative;"
                      >
                        ${story.avatars.slice(0, 5).map(
                          (avatar, index) => html`
                            <img
                              src="${avatar}"
                              alt="avatar"
                              style="z-index: ${index}; width: ${size}px; height:
 ${size}px; border: 1px solid #828282; border-radius: 50%; margin-left: -${size /
                              2}px;"
                            />
                          `,
                        )}
                      </div>
                      <span> • </span>
                    </span>
                  `}
                  ${formatDistanceToNowStrict(new Date(story.timestamp * 1000))}
                  <span> ago by </span>
                  <a
                    href="${interactive
                      ? ""
                      : story.submitter && story.submitter.ens
                      ? `/${story.submitter.ens}`
                      : `/upvotes?address=${story.identity}`}"
                    class="meta-link"
                  >
                    ${story.displayName}
                  </a>
                  ${interactive || hideCast
                    ? null
                    : html`
                        <span> • </span>
                        <a
                          target="_blank"
                          href="https://warpcast.com/~/compose?embeds[]=${encodeURIComponent(
                            story.href,
                          )}&text=${encodeURIComponent(
                            `Found on Kiwi News: "${story.title}"`,
                          )}&embeds[]=https://news.kiwistand.com"
                          class="caster-link"
                        >
                          ${FCIcon("height: 10px; width: 10px;")}
                          <span> </span>
                          Cast
                        </a>
                      `}
                </span>
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  `;
};
export default row;
