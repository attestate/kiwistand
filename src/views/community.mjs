//@format
// A community's pages: /c/<owner>/<key> (its Hot), /c/<owner>/<key>/new and
// /c/<owner>/<key>/best. They're Kiwi News' feeds (views/feed.mjs, new.mjs,
// best.mjs) with only the community's stories, under its header card, with
// its house rules on the side. With ?via=<address>, the page an invite link
// opens: "<name> invited you" and the community, to join it.
//
// NOTE: The pages are cached for everyone, so what depends on the reader
// (Join or Joined, the owner's "Invite people") is drawn by Communities.jsx
// from this browser's joined list and identity; theme-init.js marks it
// before the first paint so the right button shows right away.
import { env } from "process";

import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import SecondHeader from "./components/secondheader.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import RightColumn from "./components/right-column.mjs";
import { custom, expectTopbar } from "./components/head.mjs";
import { PagesCSS } from "./components/n2.mjs";
import Row from "./components/row.mjs";
import {
  Icon,
  communityPath,
  iconPath,
} from "./components/communities.mjs";
import { robotsMeta } from "../indexable.mjs";
import * as ens from "../ens.mjs";
import { findCommunity } from "../communities-api.mjs";
import { hasName } from "../hotnames.mjs";
import {
  colorStyle,
  isAddress,
  memberCount,
  shortAddress,
  shortName,
} from "../web/src/communities.mjs";
import log from "../logger.mjs";

const html = htm.bind(vhtml);

export { communityPath };

export const FEEDS = ["hot", "new", "best"];
const PERIODS = ["all", "year", "month", "week", "day"];

// NOTE: A community's feeds are cached exactly like Kiwi News' own /, /new
// and /best (src/http.mjs), so a new post shows up in its New right away.
export const CACHE_CONTROL = {
  hot: "public, s-maxage=20, max-age=0, stale-while-revalidate=86400",
  new: "no-cache",
  best: "public, s-maxage=3600, max-age=0, stale-while-revalidate=2592000",
};

function storyCount(count) {
  return count === 1 ? "1 story" : `${count} stories`;
}

// NOTE: Names may have 24 characters, and many wide ones ("WWWW…") don't
// fit the cards' 36px on a phone: long names get a smaller size.
function nameClass(community) {
  return community.name.length > 14 ? "cm-name cm-name-long" : "cm-name";
}

export function creatorName(community) {
  return community.ownerName || shortAddress(community.owner);
}

// What Communities.jsx needs to draw and remember a community, the icon's
// path included (the client doesn't have Phosphor's 1,512 icons).
export function communityData(community) {
  const {
    id,
    name,
    about,
    rules,
    icon,
    color,
    owner,
    ownerName,
    created,
    timestamp,
    members,
    stories,
  } = community;
  return JSON.stringify({
    id,
    name,
    about,
    rules,
    icon,
    path: iconPath(icon),
    color,
    owner,
    ownerName,
    created,
    timestamp,
    members,
    stories,
  });
}

const plus = () => Icon("plus-bold", 15);

// Before Communities.jsx mounts: the button this reader will see
// (theme-init.js sets data-cm-member and data-cm-owner, pages.css picks).
function Actions(community) {
  return html`<div
    class="cm-actions"
    data-cm="actions"
    data-community="${communityData(community)}"
  >
    <span class="cm-btn cm-btn-dark cm-ph-join">${plus()}Join</span>
    <span class="cm-btn cm-btn-outline cm-ph-member"
      >${Icon("check-bold", 15)}Joined</span
    >
    <span class="cm-ph-owner">
      <span class="cm-btn cm-btn-outline">Edit</span>
      <span class="cm-btn cm-btn-dark"
        >${Icon("user-plus", 16)}Invite people</span
      >
    </span>
  </div>`;
}

function Crumbs(community) {
  return html`<nav class="cm-crumbs" aria-label="Breadcrumbs">
    <a href="/">Kiwi News</a><span aria-hidden="true">/</span
    ><a href="/communities">Communities</a><span aria-hidden="true">/</span
    ><span aria-current="page">${community.name}</span>
  </nav>`;
}

function HeaderCard(community) {
  return html`<section
    class="cm-c cm-card"
    style="${colorStyle(community.color)}"
  >
    <div class="cm-card-top">
      <span class="cm-mark">${Icon(community.icon, 40)}</span>
      <h1 class="${nameClass(community)}">${community.name}</h1>
      ${community.about
        ? html`<span class="cm-divider" aria-hidden="true"></span>
            <p class="cm-about">${community.about}</p>`
        : null}
    </div>
    <div class="cm-card-bottom">
      <span class="cm-meta"
        >${memberCount(community.members)} · created by${" "}<a
          href="/upvotes?address=${community.owner}"
          >${creatorName(community)}</a
        >${" "}· ${storyCount(community.stories)}</span
      >
      ${Actions(community)}
    </div>
  </section>`;
}

function Rules(community, cls = "") {
  if (community.rules.length === 0) return null;
  return html`<div class="cm-rules ${cls}">
    <span class="kn-eyebrow">House rules</span>
    <ul>
      ${community.rules.map((rule) => html`<li>${rule}</li>`)}
    </ul>
    <span class="cm-note">Kiwi’s guidelines apply on top.</span>
  </div>`;
}

// The side boxes: who can post and the house rules. On narrower screens,
// without the right column, the rules show under the header card.
function SideBoxes(community) {
  return html`<div class="kn-side-box cm-side">
      <span class="kn-eyebrow">Who can post</span>
      <span class="cm-side-line"
        >${Icon("users", 16)}Anyone on Kiwi can post</span
      >
    </div>
    ${community.rules.length > 0
      ? html`<div class="kn-side-box cm-side">${Rules(community)}</div>`
      : null}`;
}

function Empty({ icon, title, text, action }) {
  return html`<tr>
    <td>
      <div class="cm-empty">
        <span class="cm-empty-icon">${Icon(icon, 24)}</span>
        <h2>${title}</h2>
        <p>${text}</p>
        ${action}
      </div>
    </td>
  </tr>`;
}

function EmptyFeed(community, feed) {
  const base = communityPath(community.id);
  if (community.stories === 0) {
    return Empty({
      icon: "link-simple-bold",
      title: "No stories yet",
      text: "Post the first link, then invite people who’d enjoy it.",
      action: html`<a
        class="cm-btn cm-btn-accent"
        href="/submit?community=${community.id}"
        data-no-instant
        >${Icon("pencil-simple-line", 14)}Post the first story</a
      >`,
    });
  }
  if (feed === "hot") {
    return Empty({
      icon: "fire",
      title: "Nothing hot right now",
      text: "Stories show here once people upvote them. The newest are in New.",
      action: html`<a class="cm-btn cm-btn-outline" href="${base}/new"
        >See what’s new</a
      >`,
    });
  }
  return Empty({
    icon: "trophy",
    title: "No stories in this time frame",
    text: "Pick a longer one, or see what’s new.",
    action: html`<a class="cm-btn cm-btn-outline" href="${base}/best?period=all"
      >Best of all time</a
    >`,
  });
}

function Rows(feed, stories, { start, period, page }) {
  if (feed === "hot") {
    return stories.map((story, i) =>
      Row(
        start,
        "/",
        "margin-bottom: 20px;",
        null,
        null,
        null,
        false,
        "",
        false, // debugMode
        i < 2, // isAboveFold
      )(story, i),
    );
  }
  if (feed === "new") {
    return stories.map((story, i) =>
      Row(
        null,
        "/new",
        "margin-bottom: 20px;",
        null,
        null,
        null,
        false,
        "",
        false, // debugMode
        i < 3, // isAboveFold
      )(story, i),
    );
  }
  return stories.map((story, i) =>
    Row(
      page * parseInt(env.TOTAL_STORIES, 10),
      "/best",
      "margin-bottom: 20px;",
      false,
      false,
      period,
      false, // invert
      "", // query
      false, // debugMode
      i < 3, // isAboveFold
    )(story, i),
  );
}

// NOTE: <base href="/"> makes the relative paths custom() and the footer
// use resolve from the root, not from under /c/<owner>/ (see weekly.mjs).
function Head(community, path, description) {
  const canonical = `https://news.kiwistand.com${path}`;
  return html`${expectTopbar}<base href="/" />${custom(
      undefined,
      `${community.name} | Kiwi News`,
      description,
      "summary",
      [],
      canonical,
    )}${robotsMeta({ indexable: false })}${PagesCSS()}`;
}

function Page({ theme, path, head, title, right, body, cls = "" }) {
  return (
    "<!DOCTYPE html>" +
    html`<html lang="en" op="news">
      <head>
        ${head}
      </head>
      <body
        class="cm-page ${cls}"
        data-instant-allow-query-string
        data-instant-allow-external-links
        ontouchstart=""
      >
        <div class="container">
          ${Sidebar(path)} ${right}
          <main id="hnmain" class="scaled-hnmain" role="main">
            ${title ? html`<h1 class="visually-hidden">${title}</h1>` : null}
            <table
              border="0"
              cellpadding="0"
              cellspacing="0"
              bgcolor="var(--background-color0)"
            >
              <tr>
                ${Header(theme, path)}
              </tr>
              ${body}
            </table>
            ${Footer(theme, path)}
          </main>
        </div>
      </body>
    </html>`
  );
}

// A community's Hot, New or Best.
export function render(theme, community, feed, stories, options = {}) {
  const { start = 0, period = "week", page = 0 } = options;
  const base = communityPath(community.id);
  const path = feed === "hot" ? base : `${base}/${feed}`;
  const site = { hot: "top", new: "new", best: "best" }[feed];
  const description =
    community.about || `${community.name}, a community on Kiwi News.`;
  const more =
    feed === "best" && stories.length > 0
      ? html`<tr>
          <td class="cm-more">
            <a href="${base}/best?period=${period}&page=${page + 1}">More</a>
          </td>
        </tr>`
      : null;
  return Page({
    theme,
    path,
    head: Head(community, path, description),
    right: RightColumn({ newsletter: false, children: SideBoxes(community) }),
    body: html`
      <tr>
        <td class="cm-head-cell">
          ${Crumbs(community)} ${HeaderCard(community)}
          ${Rules(community, "cm-rules-inline")}
        </td>
      </tr>
      <tr>
        ${SecondHeader(theme, site, period, "", "", {
          id: community.id,
          name: community.name,
          stories: community.stories,
        })}
      </tr>
      ${stories.length > 0
        ? Rows(feed, stories, { start, period, page })
        : EmptyFeed(community, feed)}
      ${more}
      ${feed !== "best" && stories.length > 0
        ? html`<tr>
            <td style="text-align: center; padding: 20px 0;">
              <div id="feed-sentinel"></div>
            </td>
          </tr>`
        : null}
    `,
  });
}

// The page an invite link opens (?via=<address>).
export function renderInvite(theme, community, inviter) {
  const path = communityPath(community.id);
  return Page({
    theme,
    path,
    cls: "cm-invite-page",
    head: Head(
      community,
      path,
      `${inviter.name} invited you to ${community.name} on Kiwi News.`,
    ),
    right: null,
    body: html`<tr>
      <td>
        <div class="cm-invite">
          <p class="cm-invited">
            ${inviter.avatar
              ? html`<img
                  class="cm-avatar"
                  src="${inviter.avatar}"
                  alt=""
                  width="28"
                  height="28"
                />`
              : html`<span class="cm-avatar">${Icon("user", 14)}</span>`}
            <span>${inviter.name} invited you</span>
          </p>
          <section
            class="cm-c cm-card cm-card-center"
            style="${colorStyle(community.color)}"
          >
            <span class="cm-mark cm-mark-lg">${Icon(community.icon, 42)}</span>
            <h1 class="${nameClass(community)}">${community.name}</h1>
            ${community.about
              ? html`<p class="cm-about">${community.about}</p>`
              : null}
            <span class="cm-meta"
              >${memberCount(community.members)} · created by${" "}${creatorName(
                community,
              )}${" "}·${" "}${storyCount(
                community.stories,
              )}</span
            >
          </section>
          ${Rules(community, "cm-rules-invite")}
          <div
            class="cm-invite-actions"
            data-cm="invite"
            data-community="${communityData(community)}"
          >
            <span class="cm-btn cm-btn-dark cm-btn-lg cm-ph-join"
              >${Icon("plus-bold", 16)}<span class="cm-btn-label"
                >Join ${shortName(community.name)}</span
              ></span
            >
            <span class="cm-btn cm-btn-dark cm-btn-lg cm-ph-open"
              ><span class="cm-btn-label"
                >Open ${shortName(community.name)}</span
              ></span
            >
            <a
              class="cm-btn cm-btn-quiet cm-btn-lg cm-ph-notnow"
              href="${path}"
              >Not now</a
            >
          </div>
        </div>
      </td>
    </tr>`,
  });
}

export function renderNotFound(theme, path) {
  return Page({
    theme,
    path,
    head: html`${expectTopbar}<base href="/" />${custom(
        undefined,
        "Community not found | Kiwi News",
        "This community doesn't exist on Kiwi News.",
      )}${robotsMeta({ indexable: false })}${PagesCSS()}`,
    right: null,
    body: Empty({
      icon: "magnifying-glass-bold",
      title: "Community not found",
      text: "It may be new and still on its way to this node, or the link is wrong.",
      action: html`<a class="cm-btn cm-btn-dark" href="/communities"
        >Browse communities</a
      >`,
    }),
  });
}

// "sam.eth", or the short address, and the avatar of who shared the link.
async function inviterOf(address, resolve) {
  let profile;
  try {
    profile = await resolve(address);
  } catch (err) {
    profile = null;
  }
  return {
    name: hasName(profile) ? profile.displayName : shortAddress(address),
    avatar: hasName(profile) ? profile.safeAvatar : null,
  };
}

// GET /c/:owner/:key and /c/:owner/:key/:feed (new, best).
// `getStories(feed, id, { page, period })` gives the feed's stories
// (http.mjs, like Kiwi News' feeds) as { stories, start }; `deps` go to
// findCommunity.
export function handler({ getStories, ...deps }) {
  return async (request, reply) => {
    const { owner, key } = request.params;
    const feed = request.params.feed || "hot";
    const path = request.path;
    const query = request.query || {};
    if (!FEEDS.includes(feed) || request.params.feed === "hot") {
      return reply
        .status(404)
        .type("text/html")
        .send(renderNotFound(reply.locals?.theme, path));
    }

    let community;
    try {
      community = await findCommunity(owner, key, deps);
    } catch (err) {
      log(`/c/${owner}/${key}: ${err.stack}`);
      return reply.status(500).type("text/plain").send("Internal Server Error");
    }
    if (!community) {
      reply.header("Cache-Control", "public, s-maxage=60, max-age=0");
      return reply
        .status(404)
        .type("text/html")
        .send(renderNotFound(reply.locals?.theme, path));
    }

    reply.header("Cache-Control", CACHE_CONTROL[feed]);
    const { via } = query;
    if (feed === "hot" && isAddress(via)) {
      const resolve = deps.resolve || ((address) => ens.resolve(address));
      const inviter = await inviterOf(via, resolve);
      return reply
        .status(200)
        .type("text/html")
        .send(renderInvite(reply.locals?.theme, community, inviter));
    }

    let page = parseInt(query.page, 10);
    if (isNaN(page) || page < 0) page = 0;
    let { period } = query;
    if (!PERIODS.includes(period)) period = "week";

    let result = { stories: [], start: 0 };
    try {
      result = await getStories(feed, community.id, { page, period });
    } catch (err) {
      log(`/c/${owner}/${key}: Couldn't get the stories: ${err.stack}`);
    }
    return reply
      .status(200)
      .type("text/html")
      .send(
        render(reply.locals?.theme, community, feed, result.stories, {
          start: result.start,
          period,
          page,
        }),
      );
  };
}
