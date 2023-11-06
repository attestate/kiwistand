//@format
import { env } from "process";
import { URL } from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import { sub, differenceInMinutes } from "date-fns";

import * as ens from "../ens.mjs";
import Header from "./components/header.mjs";
import SecondHeader from "./components/secondheader.mjs";
import ThirdHeader from "./components/thirdheader.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import Head from "./components/head.mjs";
import * as store from "../store.mjs";
import * as id from "../id.mjs";
import * as moderation from "./moderation.mjs";
import * as registry from "../chainstate/registry.mjs";
import log from "../logger.mjs";
import { EIP712_MESSAGE } from "../constants.mjs";
import Row from "./components/row.mjs";

const html = htm.bind(vhtml);

function extractDomain(link) {
  const parsedUrl = new URL(link);
  return parsedUrl.hostname;
}

const itemAge = (timestamp) => {
  const now = new Date();
  const ageInMinutes = differenceInMinutes(now, new Date(timestamp * 1000));
  return ageInMinutes;
};

export function count(leaves) {
  const stories = {};

  leaves = leaves.sort((a, b) => a.timestamp - b.timestamp);
  for (const leaf of leaves) {
    const key = `${normalizeUrl(leaf.href)}`;
    let story = stories[key];

    if (!story) {
      story = {
        title: leaf.title,
        timestamp: leaf.timestamp,
        href: leaf.href,
        identity: leaf.identity,
        displayName: leaf.displayName,
        upvotes: 1,
        upvoters: [leaf.identity],
        index: leaf.index,
      };
      stories[key] = story;
    } else {
      if (leaf.type === "amplify") {
        story.upvotes += 1;
        story.upvoters.push(leaf.identity);
        if (!story.title && leaf.title) story.title = leaf.title;
      }
    }
  }
  return Object.values(stories);
}

async function topstories(leaves) {
  return count(leaves).sort((a, b) => b.upvotes - a.upvotes);
}

export default async function index(trie, theme, identity, canon) {
  const from = null;
  const amount = null;
  const parser = JSON.parse;
  const allowlist = await registry.allowlist();
  const delegations = await registry.delegations();

  let startDatetime = null;
  let tolerance = null;

  let leaves = await store.posts(
    trie,
    from,
    amount,
    parser,
    tolerance,
    allowlist,
    delegations,
  );
  const links = canon.links.map(normalizeUrl);
  leaves = leaves.filter(({ href }) => links.includes(normalizeUrl(href)));
  const policy = await moderation.getLists();
  leaves = moderation.moderate(leaves, policy);

  const totalStories = parseInt(env.TOTAL_STORIES, 10);
  const storyPromises = (await topstories(leaves)).filter(
    (story) => story.timestamp >= startDatetime,
  );
  const writers = await moderation.getWriters();

  let stories = [];
  for await (let story of storyPromises) {
    const ensData = await ens.resolve(story.identity);
    let avatars = [];
    for await (let upvoter of story.upvoters) {
      const profile = await ens.resolve(upvoter);
      if (profile.safeAvatar) {
        avatars.push(profile.safeAvatar);
      }
    }
    const isOriginal = Object.keys(writers).some(
      (domain) =>
        normalizeUrl(story.href).startsWith(domain) &&
        writers[domain] === story.identity,
    );
    stories.push({
      ...story,
      displayName: ensData.displayName,
      avatars: avatars,
      isOriginal,
    });
  }

  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
        <meta
          name="description"
          content="Explore the latest news in the decentralized world on Kiwi News. Stay updated with fresh content handpicked by crypto veterans."
        />
      </head>
      <body>
        <div class="container">
          ${Sidebar()}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme, identity)}
              </tr>
              <tr>
                <td>
                  <p
                    style="margin-bottom: 0; color: black; padding: 10px 10px 0 10px; font-size: 12pt; font-weight: bold;"
                  >
                    <span>${canon.displayName} </span>
                  </p>
                  <p
                    style="margin-top: 0; color: black; padding: 0 10px 0 10px; font-size: 8pt; font-weight: normal;"
                  >
                    <span
                      ><i
                        >by <a href="/${canon.curator}">${canon.curator}</a></i
                      ></span
                    >
                  </p>
                  <p
                    style="margin: 5px 0 0 0; color: black; padding: 0 10px 0 10px; font-size: 10pt; font-weight: normal;"
                  >
                    <span>${canon.description} </span>
                  </p>
                  <hr
                    style="border: 1px solid rgba(0,0,0,0.2); margin: 15px 10px 0 10px;"
                  />
                </td>
              </tr>
              ${stories.map(Row())}
              <tr class="spacer" style="height:15px"></tr>
              <tr
                style="display: block; padding: 10px; background-color: ${theme.color}"
              >
                <td></td>
              </tr>
            </table>
          </div>
        </div>
        ${Footer(theme, "/best")}
      </body>
    </html>
  `;
}
