import htm from "htm";
import vhtml from "vhtml";
import DOMPurify from "isomorphic-dompurify";
import * as ens from "../ens.mjs";
import { custom } from "./components/head.mjs";
import { Page, EmptyState, Icon } from "./components/n2.mjs";
import Row from "./components/row.mjs";
import { getSubmission } from "../cache.mjs";
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

// NOTE: The apps' search sheet on mobile ("Cancel", "Search", the field) and
// a page with the field on desktop. The results are the feed's story rows.
function SearchForm(query) {
  return html`<form class="n2-search" action="/search" method="get" role="search">
    ${Icon("search")}
    <input
      type="search"
      name="q"
      value="${query}"
      placeholder="Search..."
      aria-label="Search stories"
      autocomplete="off"
      enterkeyhint="search"
    />
    ${query
      ? html`<a class="n2-search-clear" href="/search" aria-label="Clear"
          >${Icon("cancel")}</a
        >`
      : null}
  </form>`;
}

export default async function (theme, query) {
  const sanitizedQuery = DOMPurify.sanitize(query);
  let results = [];
  // NOTE: /search without a query is the empty search sheet; it doesn't
  // need to ask the search API.
  if (sanitizedQuery) {
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
    if (data && Array.isArray(data.data)) {
      results = data.data.slice(0, 10);
    }
  }
  const rows = results.length > 0 ? await processSearchResults(results) : [];

  const ogImage = "https://news.kiwistand.com/kiwi_search_page.png";
  const prefetch = ["/", "/new", "/submit", "/best"];
  const path = "/search";
  return Page({
    theme,
    path,
    bodyClass: "n2-search-page n2-backbar-page",
    head: custom(
      ogImage,
      sanitizedQuery
        ? `Search: ${sanitizedQuery} | Kiwi News`
        : "Search | Kiwi News",
      sanitizedQuery
        ? `Search results for ${sanitizedQuery} on Kiwi News`
        : "Search stories on Kiwi News",
      "",
      prefetch,
    ),
    body: html`<div class="n2-search-sheet">
      <nav class="n2-sheetbar n2-m" aria-label="Search">
        <a class="n2-sheet-cancel" href="/">Cancel</a>
        <span class="n2-backbar-title">Search</span>
        <span class="n2-sheet-spacer"></span>
      </nav>
      <header class="n2-page-head n2-d">
        <h1 class="n2-title">Search</h1>
      </header>
      ${SearchForm(sanitizedQuery)}
      ${!sanitizedQuery
        ? null
        : rows.length > 0
        ? html`<p class="n2-eyebrow n2-search-count n2-d">
              Results for “${sanitizedQuery}”
            </p>
            <table
              class="n2-search-results"
              border="0"
              cellpadding="0"
              cellspacing="0"
            >
              ${rows}
            </table>`
        : EmptyState({
            icon: "search",
            text: `No results found for "${sanitizedQuery}"`,
          })}
    </div>`,
  });
}
