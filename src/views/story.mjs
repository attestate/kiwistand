//@format
import { env } from "process";
import { URL } from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import {
  formatDistanceToNowStrict,
  sub,
  differenceInMinutes,
  isBefore,
} from "date-fns";
import linkifyStr from "linkify-string";
import DOMPurify from "isomorphic-dompurify";

import * as curation from "./curation.mjs";
import * as ens from "../ens.mjs";
import Header from "./components/header.mjs";
import SecondHeader from "./components/secondheader.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import * as head from "./components/head.mjs";
import * as store from "../store.mjs";
import * as id from "../id.mjs";
import * as moderation from "./moderation.mjs";
import * as registry from "../chainstate/registry.mjs";
import log from "../logger.mjs";
import { EIP712_MESSAGE } from "../constants.mjs";
import Row, { extractDomain } from "./components/row.mjs";
import * as karma from "../karma.mjs";
import { truncateName } from "../utils.mjs";
import { identityClassifier } from "./feed.mjs";
import { metadata, render } from "../parser.mjs";
import { getSubmission } from "../cache.mjs";
import * as preview from "../preview.mjs";
import * as frame from "../frame.mjs";
import ShareIcon from "./components/shareicon.mjs";

const html = htm.bind(vhtml);

export async function generateStory(index) {
  const hexRegex = /^0x[a-fA-F0-9]{72}$/;

  if (!hexRegex.test(index)) {
    throw new Error("Index wasn't found");
  }

  const sheetName = "contest";
  let links;
  try {
    const result = await curation.getSheet(sheetName);
    links = result.links;
  } catch (err) {
    log(`Error getting contest submissions ${err.stack}`);
  }

  let submission;
  try {
    submission = getSubmission(index, null, identityClassifier, links);
  } catch (err) {
    log(
      `Requested index "${index}" but didn't find because of error "${err.toString()}"`,
    );
    throw new Error("Index wasn't found");
  }

  const ensData = await ens.resolve(submission.identity);
  const value = {
    ...submission,
    displayName: ensData.displayName,
    submitter: ensData,
  };
  const hexIndex = index.substring(2);
  try {
    const body = preview.story(
      value.title,
      value.submitter.displayName,
      value.submitter.safeAvatar,
    );
    await preview.generate(hexIndex, body);
  } catch (err) {
    const body = preview.story(value.title, value.submitter.displayName);
    await preview.generate(hexIndex, body);
  }

  return submission;
}

export function generateList(profiles, submitter) {
  profiles.shift();
  return html`
    <ul
      style="border: var(--border); border-radius: 2px; margin: 17px 1rem 0 1rem; background-color: var(--background-color0); padding: 0.3rem 0 0.65rem 0.65rem; list-style: none;"
    >
      <li style="position: relative;">
        <p
          style="display: flex; align-items: center; gap: 3px; flex: 1; margin: 0; padding: 2px 0; font-size: 14px; color: #6b7280;"
        >
          ${submitter.safeAvatar
            ? html`<img
                src="${submitter.safeAvatar}"
                alt="avatar"
                style="object-fit: contain; width: 15px; height: 15px; border: 1px solid #828282; border-radius: 2px;"
              />`
            : null}
          <span> </span>
          <a href="/upvotes?address=${submitter.address}"
            >${submitter.displayName}
            <span> (${karma.resolve(submitter.address).toString()})</span>
            <span> submitted</span></a
          >
        </p>
      </li>
      ${profiles.map(
        (profile, i) => html`
          <li style="position: relative;">
            <p
              style="display: flex; align-items: center; gap: 3px; flex: 1; margin: 0; padding: 2px 0; font-size: 14px; color: #6b7280;"
            >
              ${profile.avatar
                ? html`<img
                    src="${profile.avatar}"
                    alt="avatar"
                    style="object-fit: contain; width: 15px; height: 15px; border: 1px solid #828282; border-radius: 2px;"
                  />`
                : null}
              <span> </span>
              <a href="/upvotes?address=${profile.address}"
                >${profile.name} (${karma.resolve(profile.address).toString()}
                ${profile.isHolder
                  ? html`,
                      <span> </span>
                      <img
                        style="vertical-align: -1px; object-fit: contain; width: 13px; height: 13px;"
                        src="/purple.png"
                      /> `
                  : ""}
                ${profile.hasNeynarScore
                  ? html`,
                      <span> </span>
                      <svg
                        style="vertical-align: -5px; width: 19px; height: 19px; fill: black;"
                        viewBox="0 0 386 212"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          fill-rule="evenodd"
                          clip-rule="evenodd"
                          d="M296.117 105.956C296.117 124.397 291.406 141.738 283.122 156.84C251.315 153.193 214.882 146.231 176.708 136.002C157.462 130.845 139.014 125.19 121.687 119.217L121.684 119.211C121.608 119.186 121.532 119.162 121.457 119.137C120.735 118.888 120.015 118.638 119.296 118.388C99.509 111.09 86.699 94.1747 88.0967 77.4086L88.3406 77.474L88.1342 77.2676C100.644 32.6882 141.585 0 190.161 0C248.679 0 296.117 47.4383 296.117 105.956Z"
                          fill="#8465cb"
                        />
                        <path
                          fill-rule="evenodd"
                          clip-rule="evenodd"
                          d="M87.8174 133.487C96.3636 127.567 107.762 124.858 119.599 126.513C137.14 132.384 155.625 137.958 174.806 143.098C211.41 152.905 246.608 160.076 278.439 164.576C259.453 193.109 227.003 211.912 190.162 211.912C141.166 211.912 99.9383 178.657 87.8174 133.487Z"
                          fill="#8465cb"
                        />
                        <path
                          fill-rule="evenodd"
                          clip-rule="evenodd"
                          d="M332.519 103.755C321.364 97.7279 308.474 91.6405 294.18 85.6757C293.509 82.2142 292.669 78.813 291.67 75.4807C308.512 82.2947 323.635 89.32 336.549 96.2973C352.652 104.998 365.535 113.737 374.032 122.045C382.244 130.074 387.598 138.946 385.287 147.572C382.976 156.197 373.903 161.203 362.776 164.051C351.264 166.997 335.737 168.124 317.441 167.607C305.611 167.273 292.521 166.248 278.462 164.542C280.177 161.963 281.781 159.305 283.27 156.573C295.647 157.983 307.189 158.838 317.681 159.134C335.628 159.641 350.26 158.504 360.675 155.839C371.475 153.075 376.096 149.121 377.099 145.378C378.102 141.635 376.077 135.899 368.106 128.106C360.419 120.59 348.316 112.29 332.519 103.755ZM68.3867 24.4435C83.0172 24.8568 99.5732 26.3267 117.506 28.8333C114.956 31.2364 112.526 33.7646 110.224 36.408C94.9262 34.4396 80.7758 33.2734 68.1474 32.9166C50.1998 32.4096 35.5676 33.5463 25.1532 36.2117C14.3533 38.9758 9.73156 42.93 8.72861 46.6731C7.72565 50.4161 9.75111 56.1514 17.722 63.9451C25.4085 71.4606 37.5119 79.7612 53.3085 88.2959C53.5673 88.4357 53.8269 88.5755 54.0875 88.7153C52.801 89.4638 51.8999 90.4073 51.4199 91.5526C50.7592 93.1292 50.9306 95.0068 51.8566 97.1312C50.988 96.6718 50.1289 96.2125 49.2793 95.7535C33.1759 87.053 20.2927 78.3137 11.796 70.0059C3.5838 61.9763 -1.77034 53.1049 0.540919 44.4792C2.85218 35.8534 11.9247 30.8477 23.0515 27.9999C34.5637 25.0535 50.0906 23.9266 68.3867 24.4435Z"
                          fill="#8465cb"
                        />
                        <ellipse
                          cx="45.9011"
                          cy="88.9788"
                          rx="29.0149"
                          ry="4.44343"
                          transform="rotate(29.2824 45.9011 88.9788)"
                          fill="#8465cb"
                        />
                      </svg> `
                  : ""}
                ${profile.isKiwi ? ", 🥝" : ""})

                <span>
                  <span> </span>
                  upvoted
                </span></a
              >
            </p>
          </li>
        `,
      )}
    </ul>
  `;
}

export default async function (trie, theme, index, value, referral) {
  let writers = [];
  try {
    writers = await moderation.getWriters();
  } catch (err) {
    // noop
  }
  const path = "/stories";

  let data;
  try {
    data = await metadata(value.href);
  } catch (err) {}

  const policy = await moderation.getLists();
  const href = normalizeUrl(value.href, { stripWWW: false });
  if (href && policy?.images.includes(href) && data?.image) {
    delete data.image;
  }

  const isOriginal = Object.keys(writers).some(
    (domain) =>
      normalizeUrl(value.href).startsWith(domain) &&
      writers[domain] === value.identity,
  );
  const story = {
    ...value,
    metadata: data,
    isOriginal,
  };

  let profiles = [];
  let avatars = [];
  for await (let upvoter of story.upvoters) {
    const profile = await ens.resolve(upvoter.identity);
    profiles.push({
      ...upvoter,
      name: profile.displayName,
      avatar: profile.safeAvatar ? profile.safeAvatar : "/pfp.png",
      address: profile.address,
    });
    if (profile.safeAvatar) {
      avatars.push(profile.safeAvatar);
    }
  }

  story.comments = moderation.flag(story.comments, policy);

  for await (let comment of story.comments) {
    const profile = await ens.resolve(comment.identity);
    if (profile && profile.displayName) {
      comment.displayName = profile.displayName;
    } else {
      comment.displayName = comment.identity;
    }
    if (profile && profile.safeAvatar) {
      comment.avatar = profile.safeAvatar;
    }
  }
  const actions = profiles.sort((a, b) => a.timestamp - b.timestamp);
  story.avatars = avatars;
  // NOTE: store.post returns upvoters as objects of "identity" and "timestamp"
  // property so that we can zip them with tipping actions. But the row component
  // expects upvoters to be a string array of Ethereum addresses.
  story.upvoters = story.upvoters.map(({ identity }) => identity);

  const ensData = await ens.resolve(story.identity);
  story.submitter = ensData;
  story.displayName = ensData.displayName;

  const start = 0;
  const style = "";

  let ogImage = `https://news.kiwistand.com/previews/${index}.jpg`;
  const ogDescription =
    data && data.ogDescription
      ? data.ogDescription
      : "Kiwi News is the prime feed for hacker engineers building a decentralized future. All our content is handpicked and curated by crypto veterans.";
  const recentJoiners = await registry.recents();
  const link = `https://news.kiwistand.com/stories?index=0x${index}${
    referral ? `&referral=${referral}` : ""
  }`;
  return html`
    <html lang="en" op="news">
      <head>
        ${head.custom(ogImage, value.title, ogDescription, undefined, [
          "/",
          "/new?cached=true",
          "/submit",
        ])}
        ${frame.header(referral, link, ogImage)}
      </head>
      <body
        data-instant-allow-query-string
        data-instant-allow-external-links
        ontouchstart=""
      >
        <div class="container">
          ${Sidebar(path)}
          <div id="hnmain" class="scaled-hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <thead>
                <tr>
                  ${await Header(theme)}
                </tr>
              </thead>
              <thead
                style="background-color: #ebebe6; position: sticky; top: 0; z-index: 9;"
              >
                ${Row(
                  start,
                  "/stories",
                  style,
                  null,
                  null,
                  null,
                  recentJoiners,
                )({ ...story, index })}
              </thead>
              <tr>
                <td>
                  ${actions.length > 3
                    ? generateList(actions, story.submitter)
                    : ""}
                </td>
              </tr>
              ${story.comments.length > 0
                ? html`<tr>
                    <td>
                      <div style="padding: 1rem 1rem 0 1rem; font-size: 1rem;">
                        ${story.comments.map(
                          (comment) =>
                            html`<span
                              id="0x${comment.index}"
                              class="${story?.metadata?.image
                                ? "scroll-margin-with-image"
                                : "scroll-margin-base"}"
                              style="${comment.flagged
                                ? "opacity: 0.5"
                                : ""}; color: black; border: var(--border); background-color: var(--background-color0); padding: 0.55rem 0.75rem 0.75rem 0.55rem; border-radius: 2px;display: block; margin-bottom: 15px; white-space: pre-wrap; line-height: 1.2; word-break: break-word; overflow-wrap: break-word;"
                            >
                              <div
                                style="white-space: nowrap; gap: 3px; margin-bottom: 0.5rem; display: inline-flex; align-items: center;"
                              >
                                ${comment.avatar
                                  ? html`<img
                                      loading="lazy"
                                      src="${comment.avatar}"
                                      alt="avatar"
                                      style="margin-right: 5px; width: 12px; height:12px; border: 1px solid #828282; border-radius: 2px;"
                                    />`
                                  : null}
                                <b
                                  >${!comment.flagged
                                    ? html`<a
                                        style="color: black;"
                                        href="/upvotes?address=${comment.identity}"
                                        >${truncateName(comment.displayName)}</a
                                      >`
                                    : truncateName(comment.displayName)}</b
                                >
                                <span class="inverse-share-container">
                                  <span> • </span>
                                  <a
                                    class="meta-link"
                                    href="/stories?index=0x${index}#0x${comment.index}"
                                  >
                                    <span>
                                      ${formatDistanceToNowStrict(
                                        new Date(comment.timestamp * 1000),
                                      )}
                                    </span>
                                    <span> ago</span>
                                  </a>
                                </span>
                                <span class="share-container">
                                  <span> • </span>
                                  <a
                                    href="#"
                                    class="caster-link share-link"
                                    title="Share"
                                    style="white-space: nowrap;"
                                    onclick="event.preventDefault(); navigator.share({url: 'https://news.kiwistand.com/stories?index=0x${index}#0x${comment.index}'});"
                                  >
                                    ${ShareIcon(
                                      "padding: 0 3px 1px 0; vertical-align: middle; height: 13px; width: 13px;",
                                    )}
                                    <span>
                                      ${formatDistanceToNowStrict(
                                        new Date(comment.timestamp * 1000),
                                      )}
                                    </span>
                                    <span> ago</span>
                                  </a>
                                </span>
                              </div>
                              <br />
                              ${comment.flagged && comment.reason
                                ? html`<i
                                    >Moderated because: "${comment.reason}"</i
                                  >`
                                : html`<span
                                    class="comment-text"
                                    dangerouslySetInnerHTML=${{
                                      __html: linkifyStr(
                                        DOMPurify.sanitize(comment.title),
                                        {
                                          className:
                                            "meta-link selectable-link",
                                          target: (href) => {
                                            if (
                                              href.startsWith(
                                                "https://news.kiwistand.com",
                                              )
                                            ) {
                                              return "_self";
                                            } else {
                                              return "_blank";
                                            }
                                          },
                                          defaultProtocol: "https",
                                          validate: {
                                            url: (value) =>
                                              /^https:\/\/.*/.test(value),
                                            email: () => false,
                                          },
                                        },
                                      ),
                                    }}
                                  ></span>`}
                            </span>`,
                        )}
                      </div>
                    </td>
                  </tr>`
                : null}
              <tr>
                <td>
                  <nav-comment-input data-story-index="0x${index}">
                    <div style="margin: 0 1rem 1rem 1rem;">
                      <textarea
                        style="font-size: 1rem; border: 1px solid #828282; display:block;width:100%;"
                        rows="12"
                        cols="80"
                        disabled
                      ></textarea>
                      <br />
                      <br />
                      <button
                        style="width: auto;"
                        id="button-onboarding"
                        disabled
                      >
                        Loading...
                      </button>
                    </div>
                  </nav-comment-input>
                </td>
              </tr>
              <tr style="height: 20px;"></tr>
            </table>
            ${Footer(theme, path)}
          </div>
        </div>
      </body>
    </html>
  `;
}
