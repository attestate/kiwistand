//@format
// /source/<key> ("Best of <source> on Kiwi News") and /sources (the index).
// Data comes from src/sources.mjs; the layout is the weekly pages'.
import htm from "htm";
import vhtml from "vhtml";

import { Page } from "./weekly.mjs";
import { sourcePath, sourceName, describe } from "../sourcekey.mjs";
import { autoIntro, date, MIN_INDEXABLE_STORIES } from "../sources.mjs";
import { hostname } from "../weekly.mjs";
import { getSlug } from "../utils.mjs";
import { cutWords, DESC_MAX } from "../seo.mjs";

const html = htm.bind(vhtml);

const BASE_URL = "https://news.kiwistand.com";
const INDEX_URL = `${BASE_URL}/sources`;

const NOINDEX = html`<meta name="robots" content="noindex, follow" />`;

function storyPath(story) {
  return `/stories/${getSlug(story.title)}?index=0x${story.index}`;
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function stories(count) {
  return count === 1 ? "1 story" : `${count} stories`;
}

function year(timestamp) {
  return new Date(timestamp * 1000).getUTCFullYear();
}

export function sourceTitle(key) {
  return `Best of ${key} on Kiwi News`;
}

// "23 stories from vitalik.eth.limo shared on Kiwi News (2023–2026), ranked
// by upvotes: ..."
// followed by as many top titles as fit in 155 characters.
export function sourceDescription(source) {
  const span =
    year(source.first) === year(source.latest)
      ? `${year(source.first)}`
      : `${year(source.first)}–${year(source.latest)}`;
  const from = describe(source.key).author
    ? `by ${sourceName(source.key)}`
    : `from ${source.key}`;
  const lead = `${stories(source.stories)} ${from} shared on Kiwi News (${span}), ranked by upvotes: `;
  let text = lead;
  for (const [i, story] of source.top.entries()) {
    const next = `${i === 0 ? "" : "; "}${story.title}`;
    if ((text + next).length > DESC_MAX) break;
    text += next;
  }
  return text === lead
    ? cutWords(`${lead}${source.top[0].title}`, DESC_MAX)
    : text;
}

// NOTE: Escape "<" so no string can close the script element.
function ld(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function sourceJsonLd(source, description) {
  const url = `${BASE_URL}${sourcePath(source.key)}`;
  return ld({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": url,
    url,
    name: sourceTitle(source.key),
    description,
    inLanguage: "en",
    dateModified: new Date(source.lastmod * 1000).toISOString(),
    isPartOf: {
      "@type": "CollectionPage",
      name: "Sources on Kiwi News",
      url: INDEX_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "Kiwi News",
      url: `${BASE_URL}/`,
    },
    mainEntity: {
      "@type": "ItemList",
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      numberOfItems: source.top.length,
      itemListElement: source.top.map((story, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${BASE_URL}${storyPath(story)}`,
        name: story.title,
      })),
    },
  });
}

export function indexJsonLd(sources, description) {
  return ld({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": INDEX_URL,
    url: INDEX_URL,
    name: "Sources on Kiwi News",
    description,
    inLanguage: "en",
    publisher: {
      "@type": "Organization",
      name: "Kiwi News",
      url: `${BASE_URL}/`,
    },
    mainEntity: {
      "@type": "ItemList",
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      numberOfItems: sources.length,
      itemListElement: sources.map((source, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${BASE_URL}${sourcePath(source.key)}`,
        name: sourceTitle(source.key),
      })),
    },
  });
}

function Story(story) {
  const domain = hostname(story.href);
  return html`<li>
    <a class="wk-title" href="${storyPath(story)}">${story.title}</a>
    <div class="wk-meta">
      ${plural(story.upvotes, "upvote")} ·${" "}
      <a href="${storyPath(story)}">${plural(story.comments, "comment")}</a>
      ${" "}·${" "}
      <time datetime="${new Date(story.timestamp * 1000).toISOString()}"
        >${date(story.timestamp)}</time
      >
      ${domain
        ? html`${" "}·${" "}
            <a href="${story.href}" rel="ugc noopener" target="_blank"
              >original on ${domain}</a
            >`
        : null}
    </div>
    ${story.summary
      ? html`<p class="wk-summary">${story.summary}</p>`
      : null}
  </li>`;
}

function Discussed(story) {
  return html`<li>
    <a href="${storyPath(story)}">${story.title}</a>
    <span class="wk-meta"> · ${plural(story.comments, "comment")}</span>
  </li>`;
}

// `data` comes from getSourcePage() in src/sources.mjs. Thin sources (fewer
// than MIN_INDEXABLE_STORIES indexable stories) render noindex, follow.
export async function sourcePage(theme, data) {
  const description = sourceDescription(data);
  const title = sourceTitle(data.key);
  const canonical = `${BASE_URL}${sourcePath(data.key)}`;
  const { author } = describe(data.key);
  const hasSummaries = data.top.some((story) => story.summary);

  const body = html`
    <h1>Best of ${data.key} on Kiwi News</h1>
    <p class="wk-dates">
      ${author ? `${sourceName(data.key)} · ` : ""}Most upvoted by Kiwi News
      readers
    </p>
    <div class="wk-intro"><p>${autoIntro(data)}</p></div>
    ${hasSummaries
      ? html`<p class="wk-note">
          Text under a title is an AI summary of the linked article.
        </p>`
      : null}
    <ol class="wk-list">
      ${data.top.map(Story)}
    </ol>
    ${data.discussed.length > 0
      ? html`<h2>Most discussed</h2>
          <ol class="wk-list">
            ${data.discussed.map(Discussed)}
          </ol>`
      : null}
    <nav class="wk-nav" aria-label="Sources">
      <a href="/sources">All sources</a>
      <a href="/weekly">Weekly archive</a>
    </nav>
  `;

  return Page(
    {
      title,
      documentTitle: title,
      description,
      canonical,
      jsonLd: sourceJsonLd(data, description),
      alternate: `${canonical}/context`,
      alternateTitle: "LLM-friendly list of this source's stories",
      robots: data.indexable ? null : NOINDEX,
      path: "/sources",
      body,
    },
    theme,
  );
}

// `sources` comes from listedSources() in src/sources.mjs.
export async function indexPage(theme, sources) {
  const title = "Sources: the most upvoted writers and publications";
  const description = `The writers, blogs and publications whose posts Kiwi News readers upvoted most, from Ethereum research to crypto newsletters. ${plural(
    sources.length,
    "source",
  )}.`;

  const body = html`
    <h1>Sources on Kiwi News</h1>
    <p class="wk-dates">The writers and publications readers upvote most</p>
    <div class="wk-intro">
      <p>
        Each source's page lists the most upvoted Kiwi News stories that link
        to it, with comments and a short summary of each article. Sources are
        listed when at least ${MIN_INDEXABLE_STORIES} of their stories got
        upvotes or comments from readers.
      </p>
    </div>
    <ol class="wk-list">
      ${sources.map(
        (source) => html`<li>
          <a href="${sourcePath(source.key)}">${source.key}</a>
          <span class="wk-meta">
            · ${stories(source.stories)} ·${" "}
            ${plural(source.upvotes, "upvote")}</span
          >
        </li>`,
      )}
    </ol>
  `;

  return Page(
    {
      title,
      documentTitle: `${title} | Kiwi News`,
      description,
      canonical: INDEX_URL,
      jsonLd: indexJsonLd(sources, description),
      robots: sources.length > 0 ? null : NOINDEX,
      path: "/sources",
      body,
    },
    theme,
  );
}
