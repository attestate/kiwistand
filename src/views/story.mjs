//@format
import { env } from "process";
import { URL } from "url";
import { extname } from "path";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import { sub, differenceInMinutes, isBefore } from "date-fns";

import { getTips, getTipsValue, filterTips } from "../tips.mjs";
import * as ens from "../ens.mjs";
import Header from "./components/header.mjs";
import SecondHeader from "./components/secondheader.mjs";
import ThirdHeader from "./components/thirdheader.mjs";
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
import { metadata, render } from "../parser.mjs";

const html = htm.bind(vhtml);

export function generateList(profiles) {
  // NOTE: Remove submitter
  profiles.shift();
  return html`
    <ul style="padding: 0.3rem 0 0.65rem 56px; list-style: none; margin: 0;">
      ${profiles.map(
        (profile, i) => html`
          <li style="position: relative;">
            <p
              style="display: flex; align-items: center; gap: 3px; flex: 1; margin: 0; padding: 2px 0; font-size: 14px; color: #6b7280;"
            >
              <img
                src="${profile.avatar}"
                alt="avatar"
                style="width: 15px; height: 15px; border: 1px solid #828282; border-radius: 50%;"
              />
              <span> </span>
              <a href="/${profile.name}">${profile.name}</a>
              <span> </span>
              <span
                >${profile.usdAmount
                  ? html`<a href="${profile.blockExplorerUrl}" target="_blank"
                      >tipped $${profile.usdAmount.toFixed(2)}</a
                    >`
                  : "upvoted"}</span
              >
            </p>
          </li>
        `,
      )}
    </ul>
  `;
}

export default async function (trie, theme, index, value, identity) {
  let writers = [];
  try {
    writers = await moderation.getWriters();
  } catch (err) {
    // noop
  }
  const path = "/";

  let data;
  let preview = "";
  try {
    data = await metadata(value.href);
  } catch (err) {}
  if (data) {
    const { ogTitle, domain, ogDescription, image } = data;
    preview = render(ogTitle, domain, ogDescription, image);
  }
  const isOriginal = Object.keys(writers).some(
    (domain) =>
      normalizeUrl(value.href).startsWith(domain) &&
      writers[domain] === value.identity,
  );
  const story = {
    ...value,
    isOriginal,
  };
  const tips = await getTips();
  const tipValue = getTipsValue(tips, index);
  story.tipValue = tipValue;

  let tipActions = [];
  for await (let { blockExplorerUrl, usdAmount, from, timestamp } of filterTips(
    tips,
    index,
  )) {
    const profile = await ens.resolve(from);
    if (profile.safeAvatar && profile.displayName) {
      tipActions.push({
        blockExplorerUrl,
        timestamp: timestamp._seconds,
        name: profile.displayName,
        avatar: profile.safeAvatar,
        address: profile.address,
        usdAmount,
      });
    }
  }

  let profiles = [];
  let avatars = [];
  for await (let { identity, timestamp } of story.upvoters) {
    const profile = await ens.resolve(identity);
    if (profile.safeAvatar) {
      avatars.push(profile.safeAvatar);

      if (profile.displayName) {
        profiles.push({
          timestamp,
          name: profile.displayName,
          avatar: profile.safeAvatar,
          address: profile.address,
        });
      }
    }
  }
  for await (let comment of story.comments) {
    const profile = await ens.resolve(comment.identity);
    if (profile && profile.displayName) {
      comment.displayName = profile.displayName;
    } else {
      comment.displayName = comment.identity;
    }
  }
  const actions = [...profiles, ...tipActions].sort(
    (a, b) => a.timestamp - b.timestamp,
  );
  story.avatars = avatars;
  // NOTE: store.post returns upvoters as objects of "identity" and "timestamp"
  // property so that we can zip them with tipping actions. But the row component
  // expects upvoters to be a string array of Ethereum addresses.
  story.upvoters = story.upvoters.map(({ identity }) => identity);

  const ensData = await ens.resolve(story.identity);
  story.submitter = ensData;
  story.displayName = ensData.displayName;

  const start = 0;
  const style = "padding: 1rem 5px 0 10px;";

  let ogImage = `https://news.kiwistand.com/previews/${index}.jpg`;
  const extension = extname(story.href);
  if (
    (extractDomain(story.href) === "imgur.com" ||
      extractDomain(story.href) === "catbox.moe") &&
    (extension === ".gif" ||
      extension === ".png" ||
      extension === ".jpg" ||
      extension === ".jpeg")
  ) {
    ogImage = story.href;
    story.image = story.href;
  }
  const ogDescription =
    data && data.ogDescription
      ? data.ogDescription
      : "Kiwi News is the prime feed for hacker engineers building a decentralized future. All our content is handpicked and curated by crypto veterans.";
  return html`
    <html lang="en" op="news">
      <head>
        ${head.custom(ogImage, value.title)}
        <meta name="description" content="${ogDescription}" />
      </head>
      <body>
        <div class="container">
          ${Sidebar(path)}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme)}
              </tr>
              ${Row(start, "/stories", style)({ ...story, index })}
              <tr>
                <td>${generateList(actions)}</td>
              </tr>
              <tr>
                <td>
                  <div style="padding: 0 1rem 0 1rem; margin-bottom: 1rem;">
                    <b style="font-size: 1rem;">Comments:</b>
                    <br />
                    <br />
                    <div style="padding: 0 1rem 0 1rem;">
                      ${story.comments.map(
                        (comment) =>
                          html`<span
                              style="line-height: 1.4; word-break: break-word; overflow-wrap: break-word;"
                              ><b
                                ><a href="/upvotes?address=${comment.identity}"
                                  >${comment.displayName}</a
                                ><span>: </span>
                              </b>
                              ${comment.title} </span
                            ><br />`,
                      )}
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td>
                  <nav-comment-input style="padding-left: 2rem;" />
                </td>
              </tr>
              ${!identity
                ? html` <tr>
                    <td>
                      <p
                        style="margin: 0 15px 15px 15px; background-color: rgba(0,0,0,0.1); padding: 10px 15px 15px 15px; border-radius: 5px; color: black;"
                      >
                        <b
                          ><i>
                            Don't understand what this website is about?
                          </i></b
                        >
                        <br />
                        <br />
                        🥝 Kiwi News is handpicked, noise-free content for
                        crypto builders. You can become part of our community by
                        minting our NFT.
                        <br />
                        <a
                          href="/welcome?referral=0xdD52f911eFC02b57cE4f1eB26b65e4CFA1D30C1E"
                        >
                          <button
                            style="margin-top: 1rem; font-size: 0.8rem; padding: 7px 10px; width: auto;"
                            id="button-onboarding"
                          >
                            Learn more
                          </button>
                        </a>
                      </p>
                    </td>
                  </tr>`
                : ""}
              ${preview
                ? html`
                    <tr>
                      <td>
                        <a
                          target="_blank"
                          href="${story.href}"
                          style="display: block; margin: 0 15px 15px 15px;"
                        >
                          ${preview}
                        </a>
                      </td>
                    </tr>
                  `
                : ""}
            </table>
          </div>
        </div>
        ${Footer(theme, path)}
      </body>
    </html>
  `;
}
