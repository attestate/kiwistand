import htm from "htm";
import vhtml from "vhtml";
import DOMPurify from "isomorphic-dompurify";

import { ms } from "./icons.mjs";

const html = htm.bind(vhtml);

const style = "width: 1rem; position: relative; top: 0.15rem;";

export const broadcastFullSVG = html`<svg
  style="${style}"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 256 256"
>
  <rect width="256" height="256" fill="none" />
  <path
    d="M168,128a40,40,0,1,1-40-40A40,40,0,0,1,168,128Zm40,0a79.74,79.74,0,0,0-20.37-53.33,8,8,0,1,0-11.92,10.67,64,64,0,0,1,0,85.33,8,8,0,0,0,11.92,10.67A79.79,79.79,0,0,0,208,128ZM80.29,85.34A8,8,0,1,0,68.37,74.67a79.94,79.94,0,0,0,0,106.67,8,8,0,0,0,11.92-10.67,63.95,63.95,0,0,1,0-85.33Zm158.28-4A119.48,119.48,0,0,0,213.71,44a8,8,0,1,0-11.42,11.2,103.9,103.9,0,0,1,0,145.56A8,8,0,1,0,213.71,212,120.12,120.12,0,0,0,238.57,81.29ZM32.17,168.48A103.9,103.9,0,0,1,53.71,55.22,8,8,0,1,0,42.29,44a119.87,119.87,0,0,0,0,168,8,8,0,1,0,11.42-11.2A103.61,103.61,0,0,1,32.17,168.48Z"
    fill="currentColor"
  />
</svg>`;

export const broadcastSVG = (style) => html`
  <svg
    style="${style}"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <circle
      cx="128"
      cy="128"
      r="32"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M181.67,80a71.94,71.94,0,0,1,0,96"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M74.33,176a71.94,71.94,0,0,1,0-96"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M208,49.62a111.88,111.88,0,0,1,0,156.76"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M48,206.38A111.88,111.88,0,0,1,48,49.62"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;

export const trophyFullSVG = html`<svg
  style="${style}"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 256 256"
>
  <rect width="256" height="256" fill="none" />
  <path
    d="M232,64H208V48a8,8,0,0,0-8-8H56a8,8,0,0,0-8,8V64H24A16,16,0,0,0,8,80V96a40,40,0,0,0,40,40h3.65A80.13,80.13,0,0,0,120,191.61V216H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16H136V191.58c31.94-3.23,58.44-25.64,68.08-55.58H208a40,40,0,0,0,40-40V80A16,16,0,0,0,232,64ZM48,120A24,24,0,0,1,24,96V80H48v32q0,4,.39,8ZM232,96a24,24,0,0,1-24,24h-.5a81.81,81.81,0,0,0,.5-8.9V80h24Z"
    fill="currentColor"
  />
</svg>`;

export const trophySVG = html`
  <svg
    style="${style}"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <line
      x1="96"
      y1="224"
      x2="160"
      y2="224"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <line
      x1="128"
      y1="184"
      x2="128"
      y2="224"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M58,128H48A32,32,0,0,1,16,96V80a8,8,0,0,1,8-8H56"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M198,128h10a32,32,0,0,0,32-32V80a8,8,0,0,0-8-8H200"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M64,48H192a8,8,0,0,1,8,8v55.1c0,39.7-31.75,72.6-71.45,72.9A72,72,0,0,1,56,112V56A8,8,0,0,1,64,48Z"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;

export const fireFullSVG = html`<svg
  style="${style}"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 256 256"
>
  <rect width="256" height="256" fill="none" />
  <path
    d="M143.38,17.85a8,8,0,0,0-12.63,3.41l-22,60.41L84.59,58.26a8,8,0,0,0-11.93.89C51,87.53,40,116.08,40,144a88,88,0,0,0,176,0C216,84.55,165.21,36,143.38,17.85Zm40.51,135.49a57.6,57.6,0,0,1-46.56,46.55A7.65,7.65,0,0,1,136,200a8,8,0,0,1-1.32-15.89c16.57-2.79,30.63-16.85,33.44-33.45a8,8,0,0,1,15.78,2.68Z"
    fill="currentColor"
  />
</svg>`;

export const fireSVG = html`
  <svg
    style="${style}"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <path
      d="M136,192c20-3.37,36.61-20,40-40"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M112,96l26.27-72C159.86,41.92,208,88.15,208,144a80,80,0,0,1-160,0c0-30.57,14.42-58.26,31-80Z"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;

const spinner =
  "if(!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button !== 1) {var el=document.getElementById('spinner-overlay'); if(el) el.style.display='block';}";

const periods = [
  ["all", "All", "All time"],
  ["year", "Year", "This year"],
  ["month", "Month", "This month"],
  ["week", "Week", "This week"],
  ["day", "Day", "Today"],
];

const months = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const days = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

// "6-12 OCT" for the past seven days, in UTC like the feeds.
export function weekRange(now = new Date()) {
  const start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  const end = `${now.getUTCDate()} ${months[now.getUTCMonth()]}`;
  const from =
    start.getUTCMonth() === now.getUTCMonth()
      ? `${start.getUTCDate()}`
      : `${start.getUTCDate()} ${months[start.getUTCMonth()]}`;
  return `${from}\u2013${end}`.toUpperCase();
}

export function today(now = new Date()) {
  return `${days[now.getUTCDay()]}, ${now.getUTCDate()} ${
    months[now.getUTCMonth()]
  }`.toUpperCase();
}

// The desktop page header above a feed (NEU 2 "Page header").
function pageHead(site, period) {
  let eyebrow, headline, sub, meta;
  if (site === "top") {
    eyebrow = `${today()} \u00b7 HOT`;
    headline = "Good stories. Curious people.";
    sub = "The best of crypto, tech and the open web. Curated by humans.";
    meta = "RANKED BY UPVOTES AND AGE";
  } else if (site === "new") {
    eyebrow = `${today()} \u00b7 NEW`;
    headline = "Fresh from the community.";
    sub = "Every story as it is submitted, newest first.";
    meta = "NEWEST FIRST";
  } else if (site === "best") {
    const label = {
      all: ["BEST \u00b7 ALL TIME", "The best of all time.", "since Kiwi News began"],
      year: ["BEST \u00b7 PAST YEAR", "The best of the year.", "over the past year"],
      month: ["BEST \u00b7 PAST MONTH", "The best of the month.", "over the past month"],
      week: [`BEST \u00b7 ${weekRange()}`, "The best of the week.", "over the past seven days"],
      day: [`BEST \u00b7 ${today()}`, "The best of the day.", "over the past day"],
    }[period] || ["BEST", "The best of Kiwi News.", "of all time"];
    eyebrow = label[0];
    headline = label[1];
    sub = `The stories the Kiwi community upvoted most ${label[2]}.`;
    meta = "RANKED BY UPVOTES";
  } else {
    return null;
  }
  return { eyebrow, headline, sub, meta };
}

// Hot / New / Best above the feeds, plus Best's time frames: buttons next
// to the tabs on desktop, a dropdown below them on phones (like the iOS app).
const secondheader = (theme, site, period, domain, query) => {
  period = DOMPurify.sanitize(period);
  domain = DOMPurify.sanitize(domain);
  const isFeed =
    site === "search" || site === "top" || site === "new" || site === "best";
  if (!isFeed) return html`<td></td>`;
  const head = pageHead(site, period);
  const tab = (href, label, active) => html`
    <a
      data-no-instant
      href="${href}"
      class="kn-seg feed-button${active ? " kn-seg-active active" : ""}"
      aria-current="${active ? "page" : "false"}"
      onclick="${spinner}"
      >${label}</a
    >
  `;
  const periodHref = (key) =>
    `/best?period=${key}${domain ? `&domain=${domain}` : ""}`;
  const current = periods.find(([key]) => key === period) || periods[3];
  return html`
    <td class="kn-feedhead">
      ${head
        ? html`<div class="kn-pagehead kn-only-desktop">
            <div class="kn-eyebrow">${head.eyebrow}</div>
            <h2 class="kn-headline">${head.headline}</h2>
            <p class="kn-sub">${head.sub}</p>
          </div>`
        : null}
      <div class="kn-toolbar">
        <div class="kn-toolbar-left">
          <nav class="kn-segmented" aria-label="Feeds">
            ${tab("/", "Hot", site === "top")}
            ${tab("/new?cached=true", "New", site === "new")}
            ${tab("/best", "Best", site === "best")}
          </nav>
          ${site === "best"
            ? html`<span class="kn-divider kn-only-desktop"></span>
                <nav class="kn-periods kn-only-desktop" aria-label="Time frame">
                  ${periods.map(
                    ([key, label]) => html`<a
                      data-no-instant
                      href="${periodHref(key)}"
                      class="kn-period${key === period ? " kn-period-active" : ""}"
                      aria-current="${key === period ? "page" : "false"}"
                      onclick="${spinner}"
                      >${label}</a
                    >`,
                  )}
                </nav>`
            : null}
        </div>
        ${head
          ? html`<span class="kn-toolbar-meta kn-only-desktop"
              >${head.meta}</span
            >`
          : null}
      </div>
      ${site === "best"
        ? html`<details class="kn-dropdown kn-only-mobile">
            <summary class="kn-dropdown-summary">
              <span>${current[2]}</span>
              ${ms("caret-down", 18)}
            </summary>
            <div class="kn-dropdown-menu">
              ${periods.map(
                ([key, , long]) => html`<a
                  data-no-instant
                  href="${periodHref(key)}"
                  class="kn-dropdown-item${key === current[0]
                    ? " kn-dropdown-item-active"
                    : ""}"
                  onclick="${spinner}"
                  >${long}${key === current[0] ? ms("check", 18) : null}</a
                >`,
              )}
            </div>
          </details>`
        : null}
      ${site === "best" && domain
        ? html`<div class="kn-filter">
            <span>${domain}</span>
            <a href="/best?period=${period}">Clear filter</a>
          </div>`
        : null}
    </td>
  `;
};

export default secondheader;
