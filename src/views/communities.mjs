//@format
// /communities: the communities you joined (Communities.jsx lists them from
// this browser) and all of them to discover, most active first, with a
// search (the read API's `q`). /communities/new: start one, or edit yours
// (?edit=<name key>); NewCommunity.jsx draws the form and its preview.
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import RightColumn from "./components/right-column.mjs";
import { custom, expectTopbar } from "./components/head.mjs";
import { PagesCSS } from "./components/n2.mjs";
import { Icon, Tile, communityPath } from "./components/communities.mjs";
import { communityData, creatorName } from "./community.mjs";
import { robotsMeta } from "../indexable.mjs";
import { listCommunities } from "../communities-api.mjs";
import { memberCount } from "../web/src/communities.mjs";
import log from "../logger.mjs";

const html = htm.bind(vhtml);

function storyCount(count) {
  return count === 1 ? "1 story" : `${count} stories`;
}

function Page({ theme, path, title, description, right, body, cls = "" }) {
  return (
    "<!DOCTYPE html>" +
    html`<html lang="en" op="news">
      <head>
        ${expectTopbar}
        <base href="/" />
        ${custom(
          undefined,
          `${title} | Kiwi News`,
          description,
          "summary",
          [],
          `https://news.kiwistand.com${path}`,
        )}${robotsMeta({ indexable: false })}${PagesCSS()}
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
            <table
              border="0"
              cellpadding="0"
              cellspacing="0"
              bgcolor="var(--background-color0)"
            >
              <tr>
                ${Header(theme, path)}
              </tr>
              <tr>
                <td class="cm-head-cell">${body}</td>
              </tr>
            </table>
            ${Footer(theme, path)}
          </main>
        </div>
      </body>
    </html>`
  );
}

// A community in the lists. Communities.jsx draws the same card for the
// Joined tab.
export function Card(community) {
  const href = communityPath(community.id);
  return html`<article class="cm-item">
    <div class="cm-item-head">
      <a href="${href}" tabindex="-1" aria-hidden="true"
        >${Tile(community, 44, 26)}</a
      >
      <div class="cm-item-text">
        <a class="cm-item-name" href="${href}">${community.name}</a>
        <span class="cm-item-by">created by ${creatorName(community)}</span>
        <span class="cm-item-count"
          >${`${memberCount(community.members)} · ${storyCount(
            community.stories,
          )}`}</span
        >
      </div>
      <div
        class="cm-join"
        data-cm="join"
        data-community="${communityData(community)}"
      >
        <span class="cm-btn cm-btn-dark cm-btn-sm"
          >${Icon("plus-bold", 14)}Join</span
        >
      </div>
    </div>
    ${community.about
      ? html`<p class="cm-item-about">${community.about}</p>`
      : null}
  </article>`;
}

const HowItWorks = () => html`<div class="kn-side-box cm-side">
  <span class="kn-eyebrow">How communities work</span>
  <div class="cm-how">
    ${Icon("users", 16)}
    <div>
      <strong>Anyone can start one</strong>
      <span>Pick a topic, icon, colour and house rules.</span>
    </div>
  </div>
  <div class="cm-how">
    ${Icon("newspaper", 16)}
    <div>
      <strong>Also on Kiwi News</strong>
      <span>Posts show in their community and in Kiwi News’ feeds.</span>
    </div>
  </div>
  <div class="cm-how">
    ${Icon("shield-check", 16)}
    <div>
      <strong>Kiwi’s guidelines apply</strong>
      <span>Each community can add its own rules on top.</span>
    </div>
  </div>
</div>`;

function Tabs(tab) {
  const link = (href, label, active) => html`<a
    class="cm-tab${active ? " cm-tab-active" : ""}"
    href="${href}"
    aria-current="${active ? "page" : "false"}"
    >${label}</a
  >`;
  return html`<nav class="cm-tabs cm-tabs-browse" aria-label="Communities">
    ${link("/communities?tab=joined", "Joined", tab === "joined")}
    ${link("/communities", "Discover", tab === "discover")}
  </nav>`;
}

function Empty({ icon, title, text, action = null }) {
  return html`<div class="cm-empty">
    <span class="cm-empty-icon">${Icon(icon, 24)}</span>
    <h2>${title}</h2>
    <p>${text}</p>
    ${action}
  </div>`;
}

export function renderBrowse(theme, { tab, query, communities }) {
  const path = "/communities";
  const count =
    `${communities.length} ${communities.length === 1 ? "community" : "communities"}` +
    (query ? ` for “${query}”` : "");
  const discover = html`
    <form class="cm-toolbar" action="/communities" method="get" role="search">
      <label class="cm-search">
        ${Icon("magnifying-glass-bold", 15)}
        <input
          type="search"
          name="q"
          value="${query}"
          placeholder="Search all communities"
          aria-label="Search all communities"
          autocomplete="off"
        />
      </label>
      <span class="cm-sort">Most active</span>
    </form>
    <p class="cm-count">${count}</p>
    ${communities.length > 0
      ? html`<div class="cm-grid">${communities.map(Card)}</div>`
      : Empty({
          icon: "magnifying-glass-bold",
          title: "No communities found",
          text: query
            ? "Try a different word, or start a community for it yourself."
            : "Be the first to start one.",
        })}
  `;
  const joined = html`<div class="cm-joined" data-cm="joined">
    ${Empty({
      icon: "users-three",
      title: "No communities yet",
      text: "Join a community and it shows here and in your Home tabs.",
      action: html`<a class="cm-btn cm-btn-dark" href="/communities"
        >Discover communities</a
      >`,
    })}
  </div>`;
  return Page({
    theme,
    path,
    title: "Communities",
    description: "Smaller feeds on Kiwi News, each with its own topic and rules.",
    right: RightColumn({ newsletter: false, children: HowItWorks() }),
    body: html`<header class="cm-page-head">
        <span class="cm-eyebrow">Smaller feeds · own topic · own rules</span>
        <div class="cm-title-row">
          <h1 class="cm-title">Communities</h1>
          <a
            class="cm-btn cm-btn-accent"
            href="/communities/new"
            data-no-instant
            >${Icon("plus-bold", 14)}Start a community</a
          >
        </div>
        <p class="cm-sub">Join a community to add it to your Home tabs.</p>
      </header>
      ${Tabs(tab)} ${tab === "joined" ? joined : discover}`,
  });
}

export function renderNew(theme, { edit }) {
  const path = "/communities/new";
  return Page({
    theme,
    path,
    cls: "cm-new-page",
    title: edit ? "Edit your community" : "Start a community",
    description: "Start a community on Kiwi News: a smaller feed for one topic.",
    right: html`<aside class="right-column kn-right cm-preview-col">
      <div id="cm-new-preview"></div>
    </aside>`,
    body: html`<header class="cm-page-head">
        <nav class="cm-crumbs" aria-label="Breadcrumbs">
          <a href="/communities">Communities</a><span aria-hidden="true">/</span
          ><span aria-current="page">${edit ? "Edit" : "New"}</span>
        </nav>
        <h1 class="cm-title cm-title-sm">
          ${edit ? "Edit your community" : "Start a community"}
        </h1>
        <p class="cm-sub">
          ${edit
            ? "Changes show everywhere right away."
            : "A smaller feed for one topic. Anyone on Kiwi can join and post."}
        </p>
      </header>
      <div id="cm-new" class="cm-new" data-edit="${edit || ""}"></div>`,
  });
}

// GET /communities
export function browseHandler(deps = {}) {
  return async (request, reply) => {
    const tab = request.query.tab === "joined" ? "joined" : "discover";
    const query =
      typeof request.query.q === "string" ? request.query.q.trim() : "";
    let communities = [];
    if (tab === "discover") {
      try {
        communities = await listCommunities(
          { q: query || undefined, limit: "200" },
          deps,
        );
      } catch (err) {
        log(`/communities: ${err.stack}`);
        return reply.status(500).type("text/plain").send("Internal Server Error");
      }
    }
    reply.header(
      "Cache-Control",
      "public, s-maxage=30, max-age=0, stale-while-revalidate=300",
    );
    return reply
      .status(200)
      .type("text/html")
      .send(renderBrowse(reply.locals?.theme, { tab, query, communities }));
  };
}

const KEY = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// GET /communities/new
export function newHandler() {
  return async (request, reply) => {
    const edit = KEY.test(request.query.edit || "") ? request.query.edit : "";
    reply.header(
      "Cache-Control",
      "public, s-maxage=3600, max-age=0, stale-while-revalidate=86400",
    );
    return reply
      .status(200)
      .type("text/html")
      .send(renderNew(reply.locals?.theme, { edit }));
  };
}
