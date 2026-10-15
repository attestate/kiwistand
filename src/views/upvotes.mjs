//@format
import htm from "htm";
import vhtml from "vhtml";
import { formatDistanceToNow } from "date-fns";
import { utils } from "ethers";
import DOMPurify from "isomorphic-dompurify";

import { custom } from "./components/head.mjs";
import {
  Page,
  BackBar,
  EmptyState,
  Icon,
} from "./components/n2.mjs";
import { getSlug } from "../utils.mjs";
import * as ens from "../ens.mjs";
import * as karma from "../karma.mjs";
import { getSubmissions, getSubmissionCount } from "../cache.mjs";

const html = htm.bind(vhtml);

// NOTE: The submissions list is user content and keeps main's markup and
// box sizes (public/pages.css only changes its colours and fonts).

// NOTE: The data the profile page is rendered from. Also served as JSON via
// /upvotes?address=…&format=json, e.g. for the iOS app.
export async function data(identity, tab = "submissions") {
  // NOTE: Submissions and karma are stored under checksummed addresses and
  // matched exactly, so a lowercase address in the URL showed an empty
  // profile.
  identity = utils.getAddress(identity);
  const profile = await ens.resolve(identity);
  const points = karma.resolve(identity);
  const limit = 30;
  const offset = 0;
  const orderBy = tab === "top" ? "votes" : "new";
  const submissions = getSubmissions(identity, limit, offset, orderBy);
  const totalSubmissions = getSubmissionCount(identity);
  const rank =
    karma
      .ranking()
      .findIndex((k) => k.identity.toLowerCase() === identity.toLowerCase()) +
    1;
  return { profile, karma: points, rank, submissions, totalSubmissions };
}

export default async function (trie, theme, identity, tab = "submissions") {
  if (!utils.isAddress(identity)) {
    return html`Not a valid address`;
  }
  const {
    profile: ensData,
    karma: points,
    rank,
    submissions,
    totalSubmissions,
  } = await data(identity, tab);

  let ogImage = ensData.safeAvatar;

  const description = ensData.kiwiProfile?.bio
    ? ensData.kiwiProfile.bio
    : ensData.description
    ? ensData.description
    : ensData.farcaster
    ? ensData.farcaster.bio
    : "";
  const twitterCard = "summary";
  const path = "/upvotes";
  const name = ensData.displayName;

  // NOTE: Like the apps: Website, X, GitHub, Telegram, Farcaster (and Lens,
  // Discord, which only the website shows); missing ones are skipped.
  const social = [
    ensData.url && ensData.url.startsWith("https://")
      ? ["Website", ensData.url]
      : null,
    ensData.twitter ? ["X", `https://x.com/${ensData.twitter}`] : null,
    ensData.github ? ["GitHub", `https://github.com/${ensData.github}`] : null,
    ensData.telegram ? ["Telegram", `https://t.me/${ensData.telegram}`] : null,
    ensData.discord
      ? ["Discord", `https://discordapp.com/users/${ensData.discord}`]
      : null,
    ensData.farcaster && ensData.farcaster.username
      ? ["Farcaster", `https://farcaster.xyz/${ensData.farcaster.username}`]
      : null,
    ensData.lens && ensData.lens.id
      ? ["Lens", `https://hey.xyz/profile/${ensData.lens.id}`]
      : null,
  ].filter(Boolean);

  const tabLink = (id, label) =>
    html`<a
      href="?address=${identity}&tab=${id}"
      class="n2-seg-item${tab === id ? " is-active" : ""}"
      aria-current="${tab === id ? "page" : "false"}"
      >${label}</a
    >`;
  const stat = (label, value) =>
    html`<div class="n2-stat">
      <span class="n2-stat-label">${label}</span>
      <span class="n2-stat-value">${value}</span>
    </div>`;
  const number = (n) => Number(n).toLocaleString("en-US");

  // NOTE: The settings gear, "Edit profile" and "Saved stories" are only for
  // your own profile. The page is the same for everyone (it's cached), so
  // theme-init.js marks your own profile (html[data-own-profile]) before
  // the first paint and public/pages.css shows them then; EditProfile.jsx
  // replaces the "Edit profile" stand-in below with the real button.
  const gear = html`<a
    class="n2-glass n2-own-only"
    href="/settings"
    aria-label="Settings"
    >${Icon("settings")}</a
  >`;

  return Page({
    theme,
    path,
    backbar: BackBar(name, "/", gear),
    bodyClass: "n2-profile-page",
    head: custom(
      ogImage,
      `${name} (${points.toString()} 🥝) on Kiwi News`,
      description,
      twitterCard,
      [], // prefetch
      `https://news.kiwistand.com/upvotes?address=${identity}`, // canonical URL
    ),
    body: html`<div class="n2-profile">
      <h1 class="visually-hidden">${name} on Kiwi News</h1>
      <div class="n2-profile-head">
        <div class="n2-profile-name">
          ${ensData.safeAvatar
            ? html`<a
                href="${ensData.safeAvatar}"
                target="_blank"
                rel="noopener"
                class="n2-profile-avatar"
                ><img src="${ensData.safeAvatar}" alt="" loading="lazy"
              /></a>`
            : html`<span class="n2-profile-avatar">${Icon("person")}</span>`}
          <a
            class="n2-profile-title"
            target="_blank"
            rel="noopener"
            href="https://etherscan.io/address/${ensData.address}"
          >
            ${name}
          </a>
        </div>
        <div class="n2-stats">
          ${rank > 0 ? stat("Rank", `#${rank}`) : null}
          ${stat("Karma", number(points))}
          ${stat("Submissions", number(totalSubmissions))}
        </div>
        ${description
          ? html`<p class="n2-profile-bio">${DOMPurify.sanitize(description)}</p>`
          : null}
        ${social.length > 0
          ? html`<div class="n2-chips">
              ${social.map(
                ([label, href]) =>
                  html`<a class="n2-chip" href="${href}" target="_blank" rel="noopener"
                    >${label}</a
                  >`,
              )}
            </div>`
          : null}
      </div>
      <div class="n2-own">
        <kiwi-edit-profile data-address="${identity}" data-variant="row"
          ><span class="n2-own-row n2-own-ssr"
            >${Icon("edit")}<span>Edit profile</span></span
          ></kiwi-edit-profile
        >
        <a class="n2-own-row n2-own-only" href="/saved"
          >${Icon("bookmark")}<span>Saved stories</span></a
        >
      </div>
      <nav class="n2-seg" aria-label="Sort">
        ${tabLink("submissions", "Submissions")} ${tabLink("top", "Top")}
      </nav>
      ${submissions.length === 0
        ? EmptyState({ text: "No submissions yet." })
        : html`<div class="profile-content">
            <div class="submissions-list">
              ${submissions.map((story, i) => html`
                <div class="submission-row">
                  <div class="submission-title">
                    ${i + 1}. <a href="${story.href}" target="_blank">${story.title}</a> <span class="domain">(${new URL(story.href).hostname})</span>
                  </div>
                  <div class="submission-meta">
                    ${story.upvotes} points | <a href="/stories/${getSlug(story.title)}?index=0x${story.index}">comments</a> | ${formatDistanceToNow(new Date(story.timestamp * 1000))} ago
                  </div>
                </div>
              `)}
            </div>
          </div>`}
    </div>`,
  });
}
