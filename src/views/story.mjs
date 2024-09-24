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

  let submission;
  try {
    submission = getSubmission(index);
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
    <ul style="padding: 0.3rem 0 0.65rem 56px; list-style: none; margin: 0;">
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
                >${profile.name} (${karma.resolve(profile.address).toString()})
                <span> upvoted</span></a
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

  const isOriginal = Object.keys(writers).some(
    (domain) =>
      normalizeUrl(value.href).startsWith(domain) &&
      writers[domain] === value.identity,
  );
  const story = {
    ...value,
    isOriginal,
  };

  let profiles = [];
  let avatars = [];
  for await (let { identity, timestamp } of story.upvoters) {
    const profile = await ens.resolve(identity);
    profiles.push({
      timestamp,
      name: profile.displayName,
      avatar: profile.safeAvatar ? profile.safeAvatar : "/pfp.png",
      address: profile.address,
    });
    if (profile.safeAvatar) {
      avatars.push(profile.safeAvatar);
    }
  }

  const policy = await moderation.getLists();
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
  const style = "padding: 1rem 10px 0 10px;";

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
        ${head.custom(ogImage, value.title, ogDescription)}
        ${frame.header(referral, link, ogImage)}
      </head>
      <body>
        <div class="container">
          ${Sidebar(path)}
          <div id="hnmain" class="scaled-hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              ${Row(
                start,
                "/stories",
                style,
                null,
                null,
                null,
                recentJoiners,
              )({ ...story, index })}
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
                              style="${comment.flagged
                                ? "opacity: 0.5"
                                : ""}; color: black; border: 1px solid rgba(0,0,0,0.1); background-color: #E6E6DF; padding: 0.55rem 0.75rem; border-radius: 2px;display: block; margin-bottom: 15px; white-space: pre-wrap; line-height: 1.3; word-break: break-word; overflow-wrap: break-word;"
                            >
                              <div
                                style="white-space: nowrap; gap: 3px; margin-bottom: 0.25rem; display: inline-flex; align-items: center;"
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
                                    dangerouslySetInnerHTML=${{
                                      __html: linkifyStr(
                                        DOMPurify.sanitize(comment.title),
                                        {
                                          className: "meta-link",
                                          target: "_blank",
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
