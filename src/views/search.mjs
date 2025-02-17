import htm from "htm";
import vhtml from "vhtml";
import DOMPurify from "isomorphic-dompurify";
import * as ens from "../ens.mjs";
import Sidebar from "./components/sidebar.mjs";
import Header from "./components/header.mjs";
import SecondHeader from "./components/secondheader.mjs";
import Footer from "./components/footer.mjs";
import { custom } from "./components/head.mjs";
import Row from "./components/row.mjs";
import cache, { getSubmission } from "../cache.mjs";
const html = htm.bind(vhtml);

async function processSearchResults(results) {
  const processedResults = await Promise.allSettled(
    results.map(async (result, i) => {
      let story;
      try {
        story = getSubmission(`0x${result.index}`);
      } catch (err) {
        console.log(err);
        return null;
      }
      if (story) {
        const ensData = await ens.resolve(story.identity);
        story.displayName = ensData.displayName;
        story.submitter = ensData;

        let avatars = [];
        for await (let upvoter of story.upvoters.slice(0, 5)) {
          const profile = await ens.resolve(upvoter.identity);
          if (profile.safeAvatar) {
            avatars.push(profile.safeAvatar);
          }
        }
        story.avatars = avatars;

        const row = Row(0, "/search", "margin-bottom: 20px;", null, null, null);
        return row(story, i);
      } else {
        return null;
      }
    }),
  );

  return processedResults
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
}

export default async function (theme, query) {
  const sanitizedQuery = DOMPurify.sanitize(query);
  // Call the external search API endpoint.
  const apiUrl = "https://knsearch.x4901.xyz/api/v1/search";
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-API-Key": process.env.KN_SEARCH_API_KEY,
    },
    body: JSON.stringify({ query: sanitizedQuery, sort: "popularity" }),
  });
  if (!response.ok) {
    throw new Error("Search API error: " + response.statusText);
  }
  const data = await response.json();
  let results = [];
  if (data && Array.isArray(data.data)) {
    results = data.data.slice(0, 10);
  }

  // Build the search page using our standard Kiwi News feed layout.
  const ogImage = "https://news.kiwistand.com/kiwi_search_page.png";
  const prefetch = ["/", "/new", "/submit", "/best"];
  const path = "/search";
  return html`
    <html lang="en" op="news">
      <head>
        ${custom(ogImage, "Search", "", "", prefetch)}
        <title>Search Results for "${sanitizedQuery}"</title>
        <meta
          name="description"
          content="Search results for ${sanitizedQuery} on Kiwi News"
        />
      </head>
      <body
        data-instant-allow-query-string
        data-instant-allow-external-links
        ontouchstart=""
      >
        <div class="container">
          ${Sidebar(path)}
          <div id="hnmain" class="scaled-hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f8f8f7">
              <tr>
                ${await Header(theme)}
              </tr>
              <tr>
                ${SecondHeader(theme, "search", null, null, sanitizedQuery)}
              </tr>
              ${results.length > 0
                ? html` <tr>
                    <td
                      style="padding: 10px 0 15px 11px; text-align: left; color: #666;"
                    >
                      Search results for "${sanitizedQuery}"
                    </td>
                  </tr>`
                : null}
              ${results.length > 0
                ? await processSearchResults(results)
                : html`<tr>
                    <td
                      style="padding: 20px; text-align: center; font-size: 14pt;"
                    >
                      No results found for "${sanitizedQuery}"
                    </td>
                  </tr>`}
            </table>
            ${Footer(theme, path)}
          </div>
        </div>
      </body>
    </html>
  `;
}
