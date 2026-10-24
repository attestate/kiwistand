//@format

import htm from "htm";
import vhtml from "vhtml";

import { custom } from "./components/head.mjs";
import { Page, BackBar } from "./components/n2.mjs";
import { MIN_INDEXABLE } from "../writers.mjs";

const html = htm.bind(vhtml);

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

// "12 upvotes · 5 stories"
export function writerMeta(entry) {
  return `${plural(entry.upvotes, "upvote")} · ${
    entry.count === 1 ? "1 story" : `${entry.count} stories`
  }`;
}

// The monthly writer leaderboard (src/writers.mjs). Server-rendered only.
export default function writersPage(theme, { range, entries, previous }) {
  const canonical = `https://news.kiwistand.com/writers?month=${range.id}`;
  const description = `The writers and sites whose links got the most upvotes on Kiwi News in ${range.label}.`;
  const indexable = entries.length >= MIN_INDEXABLE;
  return Page({
    theme,
    path: "/writers",
    backbar: BackBar("", "/"),
    head: html`${custom(
        undefined,
        `Top writers of ${range.label} | Kiwi News`,
        description,
        undefined,
        [],
        canonical,
      )}${indexable
        ? null
        : html`<meta name="robots" content="noindex, follow" />`}`,
    body: html`<article class="n2-doc">
      <h1 class="n2-doc-title">Top writers of ${range.label}</h1>
      <p>${description}</p>
      ${entries.length === 0
        ? html`<p>No stories yet this month.</p>`
        : html`<ol class="n2-writers">
            ${entries.map(
              (entry) => html`<li id="${entry.anchor}">
                <a
                  class="n2-writers-name"
                  href="${entry.url}"
                  rel="nofollow noopener"
                  target="_blank"
                  >${entry.label}</a
                >${" "}<span class="n2-writers-meta">${writerMeta(entry)}</span>
                <ul class="n2-writers-stories">
                  ${entry.stories.map(
                    (story) => html`<li>
                      <a href="${story.path}">${story.title}</a>${" "}<span
                        class="n2-writers-meta"
                        >${plural(story.upvotes, "upvote")}</span
                      >
                    </li>`,
                  )}
                </ul>
              </li>`,
            )}
          </ol>`}
      ${previous
        ? html`<p class="n2-doc-note">
            <a href="/writers?month=${previous.id}">${previous.label}</a>
          </p>`
        : null}
    </article>`,
  });
}
