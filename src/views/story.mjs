//@format
import { env } from "process";
import { URL } from "url";

import htm from "htm";
import vhtml from "vhtml";
import normalizeUrl from "normalize-url";
import { sub, differenceInMinutes, isBefore } from "date-fns";

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
import { parse } from "../parser.mjs";

const html = htm.bind(vhtml);

export default async function (trie, theme, index, value, identity) {
  const writers = await moderation.getWriters();
  const path = "/";

  let preview;
  try {
    preview = await parse(value.href);
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
  let avatars = [];
  for await (let upvoter of story.upvoters) {
    const profile = await ens.resolve(upvoter);
    if (profile.safeAvatar) {
      avatars.push(profile.safeAvatar);
    }
  }
  story.avatars = avatars;

  const start = 0;
  const style = "padding: 1rem 5px 0.75rem 10px;";
  const ogImage = `https://news.kiwistand.com/previews/${index}.svg`;
  return html`
    <html lang="en" op="news">
      <head>
        ${head.custom(ogImage)}
        <meta
          name="description"
          content="Kiwi News is the prime feed for hacker engineers building a decentralized future. All our content is handpicked and curated by crypto veterans."
        />
      </head>
      <body>
        <div class="container">
          ${Sidebar(path)}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${await Header(theme, identity)}
              </tr>
              ${Row(start, style)(story)}
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
