import htm from "htm";
import vhtml from "vhtml";
import { formatDistanceToNowStrict } from "date-fns";
import { URL } from "url";

import ShareIcon from "./shareicon.mjs";
import FCIcon from "./farcastericon.mjs";

const html = htm.bind(vhtml);

export function extractDomain(link) {
  const parsedUrl = new URL(link);
  const parts = parsedUrl.hostname.split(".");
  const tld = parts.slice(-2).join(".");
  return tld;
}

export function addOrUpdateReferrer(link, address) {
  const url = new URL(link);
  if (url.hostname.endsWith("mirror.xyz")) {
    url.searchParams.set("referrerAddress", address);
  } else if (
    url.hostname.endsWith("paragraph.xyz") ||
    url.hostname.endsWith("zora.co") ||
    url.hostname.endsWith("manifold.xyz")
  ) {
    url.searchParams.set("referrer", address);
  } else if (url.hostname.endsWith("foundation.app")) {
    url.searchParams.set("ref", address);
  }
  return url.toString();
}

const truncateLongWords = (text, maxLength = 20) => {
  const words = text.split(" ");
  const truncatedWords = words.map((word) =>
    word.length > maxLength ? `${word.substring(0, maxLength)}...` : word,
  );
  return truncatedWords.join(" ");
};

const row = (
  start = 0,
  path,
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
              style="display: flex; align-items: ${story.image
                ? "start"
                : "center"}; justify-content: center; min-width: 40px; margin-right: 6px;"
            >
              <div style="min-height: 40px; display:block;">
                <div
                  class="${interactive ? "" : "votearrowcontainer"}"
                  data-title="${story.title}"
                  data-href="${story.href}"
                  data-upvoters="${JSON.stringify(story.upvoters)}"
                >
                  <div>
                    <div
                      class="${interactive ? "votearrow" : "votearrow pulsate"}"
                      style="color: rgb(130, 130, 130); cursor: pointer;"
                      title="upvote"
                    >
                      ▲
                    </div>
                    <div style="font-size: 8pt; text-align: center;">
                      ${story.upvotes ? story.upvotes : "..."}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              style="display:flex; justify-content: center; flex-direction: column; flex-grow: 1;"
            >
              <span>
                <a
                  href="${interactive || story.image
                    ? ""
                    : addOrUpdateReferrer(story.href, story.identity)}"
                  target="_blank"
                  class="story-link"
                  style="line-height: 13pt; ${story.image
                    ? "font-size: 14pt; font-weight: bold;"
                    : "font-size: 13pt;"}"
                >
                  ${story.isOriginal
                    ? html`<mark
                        style="background-color: rgba(255,255,0, 0.05); padding: 0px 2px;"
                        >${truncateLongWords(story.title)}</mark
                      >`
                    : truncateLongWords(story.title)}
                  <span> </span>
                </a>
                ${story.image
                  ? html`<br /><a target="_blank" href="${story.href}"
                        ><img
                          style="max-width: 80vw; padding: 0.75rem 1rem 0 0; max-height: 30vh"
                          src="${story.image}"
                      /></a>`
                  : ""}
                <span> </span>
                ${story.image
                  ? ""
                  : html` <span
                      class="story-domain"
                      style="white-space: nowrap;"
                      >(${!interactive && (path === "/" || path === "/best")
                        ? html`<a
                            href="${path}?period=month&domain=${extractDomain(
                              story.href,
                            )}"
                            >${extractDomain(story.href)}</a
                          >`
                        : extractDomain(story.href)})</span
                    >`}
              </span>
              <div style="margin-top: auto; font-size: 10pt;">
                <span>
                  ${path !== "/stories" &&
                  story.avatars.length > 1 &&
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
                  ${story.index
                    ? html`
                        <a
                          class="meta-link"
                          href="/stories?index=0x${story.index}"
                        >
                          ${formatDistanceToNowStrict(
                            new Date(story.timestamp * 1000),
                          )}
                          <span> ago</span>
                        </a>
                      `
                    : html`
                        ${formatDistanceToNowStrict(
                          new Date(story.timestamp * 1000),
                        )}
                        <span> ago</span>
                      `}
                  <span> by </span>
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
                            `https://news.kiwistand.com/stories?index=0x${story.index}`,
                          )}"
                          class="caster-link"
                        >
                          ${FCIcon("height: 10px; width: 10px;")}
                          <span> </span>
                          Cast
                        </a>
                      `}
                  ${interactive || hideCast
                    ? null
                    : html`
                        <span class="share-container">
                          <span> • </span>
                          <a
                            href="#"
                            class="caster-link share-link"
                            title="Share"
                            onclick="event.preventDefault(); navigator.share({url: 'https://news.kiwistand.com/stories?index=0x${story.index}' });"
                          >
                            ${ShareIcon(
                              "padding: 0 3px 1px 0; vertical-align: bottom; height: 13px; width: 13px;",
                            )}
                            Share
                          </a>
                        </span>
                      `}
                  ${interactive
                    ? null
                    : html`
                        <span>
                          ${story.tipValue
                            ? html` <span> • </span>
                                $${parseFloat(story.tipValue).toFixed(2)}
                                <span> </span>
                                received`
                            : ""}
                          <span
                            class="tipsbuttoncontainer"
                            data-address="${story.identity}"
                            data-index="${story.index}"
                            data-title="${story.title}"
                            data-tip="${story.tipValue}"
                          >
                          </span>
                        </span>
                      `}
                </span>
              </div>
            </div>
          </div>
        </div>
        ${story.image
          ? html`<hr
              style="border-top: 1px solid rgba(0,0,0,0.2); border-bottom: none; margin: 5px 0 0 0;"
            />`
          : ""}
      </td>
    </tr>
  `;
};
export default row;
