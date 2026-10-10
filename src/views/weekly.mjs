//@format
// /weekly (the archive index) and /weekly/<YYYY>-W<ww> (a week's top stories).
import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import RightColumn from "./components/right-column.mjs";
import { NewsletterCardElement } from "./components/newsletter-card.mjs";
import { custom } from "./components/head.mjs";
import * as isoweek from "../isoweek.mjs";
import { autoIntro, hostname } from "../weekly.mjs";
import { getSlug } from "../utils.mjs";

const html = htm.bind(vhtml);

const BASE_URL = "https://news.kiwistand.com";
const INDEX_URL = `${BASE_URL}/weekly`;
const OG_IMAGE = `${BASE_URL}/kiwi_top_feed_page.png`;

const styles = `
  .wk-page { padding: 1.5rem 1rem 2rem 1rem; max-width: 640px; color: var(--text-primary); line-height: 1.5; }
  .wk-page h1 { font-size: 1.5rem; line-height: 1.25; margin: 0 0 0.25rem 0; }
  .wk-page h2 { font-size: 1.15rem; margin: 1.75rem 0 0.25rem 0; }
  .wk-page h3 { font-size: 1rem; margin: 1rem 0 0.25rem 0; }
  .wk-page a { color: var(--text-primary); }
  .wk-dates { color: var(--text-tertiary); margin: 0 0 1rem 0; }
  .wk-intro p { font-size: 1rem; margin: 0 0 0.75rem 0; }
  .wk-list { padding-left: 1.6rem; margin: 1rem 0; }
  .wk-list > li { margin-bottom: 1.1rem; }
  .wk-list > li::marker { color: var(--text-secondary); }
  .wk-title { font-size: 1.05rem; font-weight: 600; }
  .wk-domain, .wk-meta { color: var(--text-secondary); font-size: 0.85rem; }
  .wk-meta a { color: var(--text-secondary); }
  .wk-summary { margin: 0.3rem 0 0 0; font-size: 0.9rem; line-height: 1.45; color: var(--text-primary); overflow-wrap: break-word; }
  .wk-note { margin: 0; font-size: 9pt; color: var(--text-tertiary); }
  .wk-nav { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin: 1.5rem 0; font-size: 0.95rem; }
  .wk-weeks { list-style: none; padding: 0; margin: 0; }
  .wk-weeks li { margin: 0 0 0.3rem 0; }
  .wk-page newsletter-card .newsletter-card { margin: 1.5rem 0 0 0; }
`;

function storyPath(story) {
  return `/stories/${getSlug(story.title)}?index=0x${story.index}`;
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

// "Top crypto stories, week 41 2026 (Oct 5–11)"
export function weekTitle(week) {
  return `Top crypto stories, week ${week.week} ${week.year} (${isoweek.shortRange(week)})`;
}

export function weekDescription(week, stories) {
  const lead = `The ${stories.length === 1 ? "top story" : `${stories.length} top stories`} on Kiwi News in week ${week.week} of ${week.year} (${isoweek.shortRange(week)}), picked by the community: `;
  let text = lead;
  for (const [i, story] of stories.entries()) {
    const next = `${i === 0 ? "" : "; "}${story.title}`;
    if ((text + next).length > 155) break;
    text += next;
  }
  return text === lead ? `${lead}${stories[0].title}` : text;
}

export function weekJsonLd(week, stories, description) {
  const url = `${BASE_URL}${isoweek.path(week)}`;
  const { start } = isoweek.range(week);
  const data = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": url,
    url,
    name: weekTitle(week),
    description,
    inLanguage: "en",
    datePublished: new Date(start * 1000).toISOString(),
    isPartOf: {
      "@type": "CollectionPage",
      name: "Kiwi News weekly archive",
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
      numberOfItems: stories.length,
      itemListElement: stories.map((story, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${BASE_URL}${storyPath(story)}`,
        name: story.title,
      })),
    },
  };
  // NOTE: Escape "<" so no string can close the script element.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

// custom() links news.css, scripts and icons with relative paths. The
// <base href="/"> keeps them from resolving under /weekly/ (404, unstyled
// page), like on story pages.
async function Page(
  { title, documentTitle, description, canonical, jsonLd, body },
  theme,
) {
  return (
    "<!DOCTYPE html>" +
    html`
      <html lang="en" op="news">
        <head>
          <base href="/" />
          ${custom(
            OG_IMAGE,
            title,
            description,
            "summary_large_image",
            [],
            canonical,
            null,
            null,
            { documentTitle, ogType: "website" },
          )}
          ${jsonLd
            ? html`<script
                type="application/ld+json"
                dangerouslySetInnerHTML=${{ __html: jsonLd }}
              ></script>`
            : null}
          <style dangerouslySetInnerHTML=${{ __html: styles }}></style>
        </head>
        <body>
          <div class="container">
            ${Sidebar("/weekly")} ${RightColumn()}
            <div id="hnmain" class="scaled-hnmain">
              <table
                border="0"
                cellpadding="0"
                cellspacing="0"
                bgcolor="var(--background-color0)"
              >
                <tr>
                  ${await Header(theme)}
                </tr>
                <tr>
                  <td>
                    <main class="wk-page">${body}</main>
                  </td>
                </tr>
              </table>
              ${Footer(theme, "/weekly")}
            </div>
          </div>
        </body>
      </html>
    `
  );
}

function Story(story) {
  const domain = hostname(story.href);
  return html`<li>
    <a class="wk-title" href="${storyPath(story)}">${story.title}</a>
    ${domain ? html` <span class="wk-domain">(${domain})</span>` : null}
    <div class="wk-meta">
      ${plural(story.upvotes, "upvote")} ·${" "}
      <a href="${storyPath(story)}">${plural(story.comments, "comment")}</a>
      ${" "}· by${" "}
      <a href="/upvotes?address=${story.identity}">${story.displayName}</a>
    </div>
    ${story.summary
      ? html`<p class="wk-summary">${story.summary}</p>`
      : null}
  </li>`;
}

function WeekNav(data) {
  const { previous, next } = data;
  return html`<nav class="wk-nav" aria-label="Weeks">
    <span>
      ${previous
        ? html`<a rel="prev" href="${isoweek.path(previous)}"
            >← Week ${previous.week}, ${previous.year}</a
          >`
        : null}
    </span>
    <a href="/weekly">All weeks</a>
    <span>
      ${next
        ? html`<a rel="next" href="${isoweek.path(next)}"
            >Week ${next.week}, ${next.year} →</a
          >`
        : null}
    </span>
  </nav>`;
}

// `data` comes from getWeek() in src/weekly.mjs.
export async function weekPage(theme, data) {
  const { week, stories, intro, isCurrent } = data;
  const description = weekDescription(week, stories);
  const paragraphs = intro || [autoIntro(week, stories, isCurrent)];
  const hasSummaries = stories.some((story) => story.summary);
  const title = weekTitle(week);

  const body = html`
    <h1>Top crypto stories of week ${week.week}, ${week.year}</h1>
    <p class="wk-dates">
      ${isoweek.longRange(week)}${isCurrent ? " · this week, updated as votes come in" : ""}
    </p>
    <div class="wk-intro">${paragraphs.map((p) => html`<p>${p}</p>`)}</div>
    ${hasSummaries
      ? html`<p class="wk-note">
          Text under a title is an AI summary of the linked article.
        </p>`
      : null}
    <ol class="wk-list">
      ${stories.map(Story)}
    </ol>
    ${WeekNav(data)}
    ${NewsletterCardElement("weekly")}
  `;

  return Page(
    {
      title,
      documentTitle: `${title} | Kiwi News`,
      description,
      canonical: `${BASE_URL}${isoweek.path(week)}`,
      jsonLd: weekJsonLd(week, stories, description),
      body,
    },
    theme,
  );
}

// Groups weeks (newest first) by the year and month of their Thursday, which
// keeps each ISO week under its own year.
export function groupWeeks(weeks) {
  const years = [];
  for (const { week } of weeks) {
    const thursday = new Date((isoweek.range(week).start + 3 * 86400) * 1000);
    const month = thursday.getUTCMonth();
    let year = years[years.length - 1];
    if (!year || year.year !== week.year) {
      year = { year: week.year, months: [] };
      years.push(year);
    }
    let group = year.months[year.months.length - 1];
    if (!group || group.month !== month) {
      group = { month, weeks: [] };
      year.months.push(group);
    }
    group.weeks.push(week);
  }
  return years;
}

// `weeks` comes from getWeeks() in src/weekly.mjs.
export async function indexPage(theme, weeks, now = Date.now()) {
  const current = isoweek.current(now);
  const oldest = weeks[weeks.length - 1]?.week;
  const since = oldest
    ? ` since ${isoweek.monthName(
        new Date(isoweek.range(oldest).start * 1000).getUTCMonth(),
      )} ${new Date(isoweek.range(oldest).start * 1000).getUTCFullYear()}`
    : "";
  const title = "Weekly archive: top crypto and Ethereum stories by week";
  const description = `The top crypto and Ethereum stories on Kiwi News, week by week${since}. ${weeks.length} weeks of links picked by the community.`;

  const body = html`
    <h1>Kiwi News weekly archive</h1>
    <p class="wk-dates">The top crypto and Ethereum stories of every week</p>
    <div class="wk-intro">
      <p>
        Each week's page lists up to 20 stories the Kiwi News community
        upvoted, discussed and clicked most that week, with a short summary
        of the linked article where one exists. The${" "}<a href="/newsletter"
          >Kiwi News Weekly</a
        >${" "}newsletter sends the top five every Sunday.
      </p>
    </div>
    ${groupWeeks(weeks).map(
      ({ year, months }) => html`
        <h2>${year}</h2>
        ${months.map(
          ({ month, weeks: monthWeeks }) => html`
            <h3>${isoweek.monthName(month)} ${year}</h3>
            <ul class="wk-weeks">
              ${monthWeeks.map(
                (week) => html`<li>
                  <a href="${isoweek.path(week)}"
                    >Week ${week.week}: ${isoweek.shortRange(week)}</a
                  >${isoweek.compare(week, current) === 0
                    ? html` <span class="wk-meta">(this week)</span>`
                    : null}
                </li>`,
              )}
            </ul>
          `,
        )}
      `,
    )}
    ${NewsletterCardElement("weekly")}
  `;

  return Page(
    {
      title,
      documentTitle: `${title} | Kiwi News`,
      description,
      canonical: INDEX_URL,
      jsonLd: null,
      body,
    },
    theme,
  );
}
