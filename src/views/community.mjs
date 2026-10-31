//@format
// /c/<owner>/<key>: a community's page, where its invite links land
// (https://news.kiwistand.com/c/<owner>/<key>) for people without the app.
// Kept minimal until there are desktop designs: the community, who created
// it, its stories as the feed's rows (its Hot, see views/feed.mjs index())
// and a link to the app. The universal links (AASA in http.mjs) open the app
// on these URLs where it's installed.
import htm from "htm";
import vhtml from "vhtml";

import { custom } from "./components/head.mjs";
import { Page, BackBar, EmptyState, Section } from "./components/n2.mjs";
import { paths as iconPaths, ms } from "./components/icons.mjs";
import Row from "./components/row.mjs";
import { robotsMeta } from "../indexable.mjs";
import { COMMUNITY_COLOR_PATTERN } from "../constants.mjs";
import { findCommunity } from "../communities-api.mjs";
import log from "../logger.mjs";

const html = htm.bind(vhtml);

export const TESTFLIGHT = "https://testflight.apple.com/join/6jyvYECH";
const colorPattern = new RegExp(COMMUNITY_COLOR_PATTERN);

export function communityPath(id) {
  return `/c/${id}`;
}

// The community's Phosphor icon where the site has it (components/icons.mjs
// inlines a few), else the name's first letter, on the community's colour.
function Badge(community) {
  const color = colorPattern.test(community.color) ? community.color : "#6E56CF";
  return html`<span
    class="n2-community-badge"
    style="background: ${color};"
    title="${community.icon}"
    aria-hidden="true"
    >${iconPaths[community.icon]
      ? ms(community.icon, 26)
      : community.name.slice(0, 1).toUpperCase()}</span
  >`;
}

function stories(count) {
  return count === 1 ? "1 story" : `${count} stories`;
}

export function render(theme, community, rows) {
  const path = communityPath(community.id);
  const canonical = `https://news.kiwistand.com${path}`;
  const creator = community.ownerName || `${community.owner.slice(0, 6)}...${community.owner.slice(-4)}`;
  const description =
    community.about || `${community.name}, a community on Kiwi News.`;
  const row = Row(0, path, "margin-bottom: 20px;", null, null, null);

  return Page({
    theme,
    path,
    backbar: BackBar(community.name, "/"),
    bodyClass: "n2-community-page",
    head: html`${custom(
        undefined,
        `${community.name} on Kiwi News`,
        description,
        "summary",
        [],
        canonical,
      )}${robotsMeta({ indexable: false })}`,
    body: html`<div class="n2-community">
      <header class="n2-page-head n2-community-head">
        <div class="n2-community-name">
          ${Badge(community)}
          <h1 class="n2-title">${community.name}</h1>
        </div>
        <p class="n2-sub">
          Created by${" "}
          <a href="/upvotes?address=${community.owner}">${creator}</a>
          ${" "}· ${stories(community.stories)}
        </p>
        ${community.about
          ? html`<p class="n2-profile-bio">${community.about}</p>`
          : null}
      </header>
      ${community.rules.length > 0
        ? Section(
            "Rules",
            html`<ol class="n2-community-rules">
              ${community.rules.map((rule) => html`<li>${rule}</li>`)}
            </ol>`,
          )
        : null}
      <p class="n2-community-app">
        <a
          class="n2-btn"
          data-no-instant
          href="${TESTFLIGHT}"
          target="_blank"
          rel="noopener"
          >Get the Kiwi News app</a
        >
        <span class="n2-sub">Join ${community.name} and post to it in the app.</span>
      </p>
      ${rows.length > 0
        ? html`<table
            class="n2-search-results"
            border="0"
            cellpadding="0"
            cellspacing="0"
          >
            ${rows.map((story, i) => row(story, i))}
          </table>`
        : EmptyState({ icon: "sparkle", text: "No stories yet." })}
    </div>`,
  });
}

// GET /c/:owner/:key. `getStories(id)` gives the stories to show (the
// community's Hot, see http.mjs); `deps` go to findCommunity.
export function handler({ getStories, ...deps }) {
  return async (request, reply) => {
    const { owner, key } = request.params;
    let community;
    try {
      community = await findCommunity(owner, key, deps);
    } catch (err) {
      log(`/c/${owner}/${key}: ${err.stack}`);
      return reply.status(500).type("text/plain").send("Internal Server Error");
    }
    if (!community) {
      reply.header("Cache-Control", "public, s-maxage=60, max-age=0");
      return reply.status(404).type("text/plain").send("Community not found");
    }

    let rows = [];
    try {
      rows = await getStories(community.id);
    } catch (err) {
      log(`/c/${owner}/${key}: Couldn't get the stories: ${err.stack}`);
    }
    reply.header(
      "Cache-Control",
      "public, s-maxage=60, max-age=0, stale-while-revalidate=86400",
    );
    return reply
      .status(200)
      .type("text/html")
      .send(render(reply.locals?.theme, community, rows));
  };
}
