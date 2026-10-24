//@format

import htm from "htm";
import vhtml from "vhtml";

import { custom } from "./components/head.mjs";
import { Page, BackBar } from "./components/n2.mjs";
import { MIN_INDEXABLE } from "../writers.mjs";

const html = htm.bind(vhtml);

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
        : html`<ol style="padding-left: 1.6em;">
            ${entries.map(
              (entry) => html`<li id="${entry.anchor}" style="margin-bottom: 14px;">
                <a href="${entry.url}" rel="nofollow noopener" target="_blank"
                  ><strong>${entry.label}</strong></a
                >${" "}<span style="color: var(--text-secondary);"
                  >${entry.upvotes} upvotes · ${entry.count}
                  ${entry.count === 1 ? "story" : "stories"}</span
                >
                <ul style="margin: 4px 0 0 0;">
                  ${entry.stories.map(
                    (story) => html`<li>
                      <a href="${story.path}">${story.title}</a>${" "}<span
                        style="color: var(--text-secondary);"
                        >(${story.upvotes})</span
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
