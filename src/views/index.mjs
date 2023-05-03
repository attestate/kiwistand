//@format
import { env } from "process";
import htm from "htm";
import vhtml from "vhtml";
import url from "url";

import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import * as store from "../store.mjs";
import * as id from "../id.mjs";
import { count } from "./feed.mjs";

const html = htm.bind(vhtml);

function extractDomain(link) {
  const parsedUrl = new url.URL(link);
  return parsedUrl.hostname;
}

// NOTE: I've not added this function to the code base at store.editorPicks as
// I think this is a function that belongs in the client frontend and not into
// the node code base.
function editorPicks(leaves) {
  return leaves
    .map((leaf) => ({
      address: id.ecrecover(leaf),
      ...leaf,
    }))
    .filter(
      ({ address }) =>
        address.toLowerCase() === env.TODAYS_EDITOR_ADDRESS.toLowerCase()
    );
}

const totalStories = parseInt(env.TODAYS_EDITOR_STORY_COUNT, 10);
export default async function index(trie, theme) {
  const leaves = editorPicks(await store.leaves(trie));
  const stories = count(leaves)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, totalStories)
    .reverse();
  return html`
    <html lang="en" op="news">
      <head>
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-21BKTD0NKN"
        ></script>
        <script src="ga.js"></script>
        <meta charset="utf-8" />
        <meta name="referrer" content="origin" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link
          rel="apple-touch-icon"
          sizes="152x152"
          href="apple-touch-icon.png"
        />
        <link rel="stylesheet" type="text/css" href="news.css" />
        <link rel="shortcut icon" href="favicon.ico" />
        <title>Kiwi News</title>
      </head>
      <body>
        <center>
          <table
            id="hnmain"
            border="0"
            cellpadding="0"
            cellspacing="0"
            width="85%"
            bgcolor="#f6f6ef"
          >
            <tr>
              ${Header(theme)}
            </tr>
            ${stories.map(
              (story, i) => html`
                <tr>
                  <td>
                    <table
                      style="padding: 5px;"
                      border="0"
                      cellpadding="0"
                      cellspacing="0"
                    >
                      <tr class="athing" id="35233479">
                        <td align="right" valign="top" class="title">
                          <span style="padding-right: 5px" class="rank"
                            >${i + 1}.
                          </span>
                        </td>
                        <td valign="top" class="votelinks">
                          <center>
                            <a id="up_35233479" class="clicky" href="#">
                              <div
                                style="display: none;"
                                class="votearrow"
                                title="upvote"
                              ></div>
                            </a>
                          </center>
                        </td>
                        <td class="title">
                          <span class="titleline">
                            <a href="${story.href}">${story.title}</a>
                            <span style="padding-left: 5px">
                              (${extractDomain(story.href)})
                            </span>
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2"></td>
                        <td class="subtext">
                          <span class="subline">
                            <span
                              style="display: inline-block; height: 10px;"
                              class="score"
                              id="score_35233479"
                            ></span>
                          </span>
                        </td>
                      </tr>
                      <tr class="spacer" style="height:5px"></tr>
                    </table>
                  </td>
                </tr>
              `
            )}
          </table>
          <span
            >Three great stories about crypto a day (Mon-Fr), check back
            tomorrow for more!
          </span>
          <span> Or </span>
          <a style="color: black;" href="/subscribe">subscribe</a>
          <span> to our newsletter.</span>
          <br />
          <span>Today's Editor Picks are curated by </span>
          <a style="color:black;" href="${env.TODAYS_EDITOR_URL}">
            ${env.TODAYS_EDITOR_NAME}</a
          >! (submitted by @macbudkowski) ${Footer}
        </center>
      </body>
    </html>
  `;
}
