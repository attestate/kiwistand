//@format
import htm from "htm";
import vhtml from "vhtml";
import { sub } from "date-fns";

import { custom } from "./components/head.mjs";
import { Page, Icon } from "./components/n2.mjs";
import * as moderation from "./moderation.mjs";
import { getBest, countOutbounds, countComments } from "../cache.mjs";
import { getSlug } from "../utils.mjs";
import log from "../logger.mjs";

const html = htm.bind(vhtml);

const BASE_URL = "https://news.kiwistand.com";
const CANONICAL = `${BASE_URL}/newsletter`;
const ARCHIVE_URL = "https://buttondown.com/kiwi-news-weekly/archive/";
const TESTFLIGHT_URL = "https://testflight.apple.com/join/6jyvYECH";
const OG_IMAGE = `${BASE_URL}/banner-email.jpg`;

export const TITLE =
  "Kiwi News Weekly — the best Ethereum & web3 links for builders, every Sunday";
export const DESCRIPTION =
  "A free weekly email with the five Ethereum and web3 stories Kiwi News builders upvoted most. Every Sunday, signal over noise, unsubscribe anytime.";

const FAQ = [
  {
    q: "How often is Kiwi News Weekly sent?",
    a: "Once a week, every Sunday. One email, five stories, nothing in between.",
  },
  {
    q: "How much does it cost?",
    a: "Nothing. The newsletter is free and has no paid tier.",
  },
  {
    q: "What topics does it cover?",
    a: "Ethereum, web3 and the tech around it: protocol research, developer tools, DeFi, security, privacy, open source and the occasional essay builders are talking about. The stories are whatever the Kiwi News community upvoted most that week.",
  },
  {
    q: "How do I unsubscribe?",
    a: "Every issue has an unsubscribe link at the bottom. One click and you are off the list.",
  },
];

// NOTE: Mirrors how src/digest.mjs picks the Sunday issue (top stories of the
// past week by upvotes, comments and clicks), but only uses the SQLite cache
// so rendering the page stays cheap. Results are memoized for a few minutes.
const PICKS_TTL_MS = 10 * 60 * 1000;
// Uploaded pictures (imagedelivery.net) are in the issue too now.
const BANNED_DOMAINS = [];
let picksCache = { at: 0, picks: [] };

function hostname(href) {
  try {
    return new URL(href).hostname.replace(/^www\./, "").toLowerCase();
  } catch (err) {
    return null;
  }
}

export async function getWeeklyPicks(amount = 5) {
  if (Date.now() - picksCache.at < PICKS_TTL_MS) return picksCache.picks;
  try {
    const since = Math.floor(sub(new Date(), { weeks: 1 }).getTime() / 1000);
    let stories = getBest(25, 0, null, "", since);
    const policy = await moderation.getLists();
    stories = moderation.moderate(stories, policy, "/best");

    const picks = stories
      .filter((story) => {
        const domain = hostname(story.href);
        return !BANNED_DOMAINS.some(
          (banned) => domain === banned || domain?.endsWith(`.${banned}`),
        );
      })
      .map((story) => {
        const comments = countComments(`kiwi:0x${story.index}`);
        const clicks = countOutbounds(story.href);
        const score = (story.upvotes || 0) * 3 + comments * 2 + clicks;
        return {
          title: story.title,
          index: story.index,
          domain: story.href.startsWith("data:")
            ? null
            : hostname(story.href) === "imagedelivery.net"
              ? "image"
              : hostname(story.href),
          upvotes: story.upvotes || 0,
          comments,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, amount);

    picksCache = { at: Date.now(), picks };
    return picks;
  } catch (err) {
    log(`newsletter: couldn't compute weekly picks: ${err.toString()}`);
    return picksCache.picks;
  }
}

function jsonLd() {
  const publisher = {
    "@type": "Organization",
    "@id": `${BASE_URL}/#organization`,
    name: "Kiwi News",
    url: `${BASE_URL}/`,
    logo: `${BASE_URL}/pwa_icon.png`,
    sameAs: ["https://x.com/KiwiNewsHQ", "https://github.com/attestate/kiwistand"],
  };
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": CANONICAL,
      url: CANONICAL,
      name: TITLE,
      description: DESCRIPTION,
      inLanguage: "en",
      image: OG_IMAGE,
      isPartOf: { "@type": "WebSite", name: "Kiwi News", url: `${BASE_URL}/` },
      publisher,
      mainEntity: { "@id": `${CANONICAL}#series` },
    },
    {
      "@context": "https://schema.org",
      "@type": ["CreativeWorkSeries", "Periodical"],
      "@id": `${CANONICAL}#series`,
      name: "Kiwi News Weekly",
      description: DESCRIPTION,
      url: CANONICAL,
      sameAs: ARCHIVE_URL,
      inLanguage: "en",
      genre: "Technology news",
      about: ["Ethereum", "Web3", "Blockchain", "Software development"],
      audience: {
        "@type": "Audience",
        audienceType: "Ethereum and web3 builders, researchers and founders",
      },
      isAccessibleForFree: true,
      publisher,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ];
  // NOTE: Escape "<" so no string can close the script element.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function SignupForm(id) {
  return html`
    <form
      class="nl-form"
      method="post"
      action="/api/v1/newsletter/subscribe"
      aria-labelledby="${id}"
    >
      <input type="hidden" name="redirect" value="/newsletter" />
      <input type="hidden" name="source" value="landing" />
      <input
        class="n2-input"
        type="email"
        name="email"
        required
        autocomplete="email"
        inputmode="email"
        placeholder="you@example.com"
        aria-label="Email address"
      />
      <button type="submit" class="n2-btn">Subscribe</button>
    </form>
  `;
}

function Status(status) {
  if (status === "subscribed") {
    return html`<p class="nl-status nl-status-ok" role="status">
      You're subscribed. The next issue arrives on Sunday. If you're new, check
      your inbox for a confirmation email.
    </p>`;
  }
  if (status === "error") {
    return html`<p class="nl-status nl-status-error" role="alert">
      Something went wrong and we couldn't subscribe that address. Please check
      it and try again.
    </p>`;
  }
  return null;
}

const Bullets = (items) => html`<ul class="nl-bullets">
  ${items.map(
    ([bold, text]) => html`<li>
      ${bold ? html`<strong>${bold}</strong>` : null}
      ${text ? html`<span>${text}</span>` : null}
    </li>`,
  )}
</ul>`;

export default async function (theme, { status = null, picks = null } = {}) {
  const weeklyPicks = picks || (await getWeeklyPicks());
  const pad = (n) => String(n).padStart(2, "0");

  return Page({
    theme,
    path: "/newsletter",
    head: html`${custom(
        OG_IMAGE,
        "Kiwi News Weekly: the best Ethereum & web3 links for builders",
        DESCRIPTION,
        "summary_large_image",
        [],
        CANONICAL,
        null,
        null,
        { documentTitle: TITLE, ogType: "website" },
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML=${{ __html: jsonLd() }}
      ></script>`,
    body: html`<div class="nl-page">
      <header class="nl-hero">
        <p class="n2-eyebrow">Kiwi News Weekly · Every Sunday</p>
        <h1 class="nl-title">
          <span class="visually-hidden">Kiwi News Weekly: </span>The Ethereum
          and web3 links builders actually read
        </h1>
        <p class="nl-lede">
          Every Sunday, the five stories the Kiwi News community upvoted most
          that week. Free, one email, unsubscribe anytime.
        </p>
        ${Status(status)}
        <h2 id="subscribe" class="visually-hidden">Get it in your inbox</h2>
        ${SignupForm("subscribe")}
        <p class="nl-fineprint">
          Sent via Buttondown. We only use your address to send the
          newsletter.${" "}<a class="nl-link" href="/privacy-policy"
            >Privacy policy</a
          >.
        </p>
      </header>

      <section class="nl-section">
        <h2>What is Kiwi News Weekly?</h2>
        <p>
          <a class="nl-link" href="/">Kiwi News</a> is a community-curated link
          aggregator for Ethereum and web3, similar to Hacker News. Links are
          submitted and upvoted by Kiwi Pass holders: developers, researchers,
          founders and people who spend their days onchain. Every submission
          and upvote is a signed, public message.
        </p>
        <p>
          Kiwi News Weekly is the short version. Each Sunday we take the
          stories that got the most upvotes, comments and clicks over the past
          seven days and send you the top five. No algorithmic feed, no paid
          placements, no price talk for its own sake.
        </p>
      </section>

      <section class="nl-section nl-columns">
        <div>
          <h2>Who it's for</h2>
          ${Bullets([
            [null, "Ethereum and web3 developers who want to know which new tools, EIPs and repos are worth their time"],
            [null, "Researchers following protocol design, cryptography, MEV and scaling"],
            [null, "Founders and product people who need to keep up without living on X or Farcaster"],
            [null, "Anyone who prefers a few good links over an endless timeline"],
          ])}
        </div>
        <div>
          <h2>What's in an issue</h2>
          ${Bullets([
            ["The week's top five links", "With a preview, the source and who submitted it. Expect new tools and releases, research, deep dives and the occasional essay."],
            ["Notable discussions", "Upvote and comment counts, and a link to each story's Kiwi comment thread where builders discuss it."],
            ["Posts from X, Farcaster and Bluesky", "Shown inline when one made the list, so you can read them without an account."],
            ["Kiwi News updates", html`Such as the native iOS app, currently in${" "}<a class="nl-link" href="${TESTFLIGHT_URL}" target="_blank" rel="noopener">public beta on TestFlight</a>.`],
          ])}
        </div>
      </section>

      <section class="nl-section">
        <h2>This week's picks</h2>
        <p class="nl-sub">
          A live preview: these are the stories leading this week's issue right
          now, based on the past seven days of community votes.
        </p>
        ${weeklyPicks.length
          ? html`<ol class="nl-picks">
              ${weeklyPicks.map(
                (pick, i) => html`
                  <li>
                    <span class="nl-rank" aria-hidden="true">${pad(i + 1)}</span>
                    <span class="nl-pick">
                      <a href="/stories/${getSlug(pick.title)}?index=0x${pick.index}">${pick.title}</a>
                      <span class="nl-meta">
                        ${pick.domain ? `${pick.domain} · ` : ""}${pick.upvotes} ${pick.upvotes === 1 ? "upvote" : "upvotes"}${pick.comments ? ` · ${pick.comments} ${pick.comments === 1 ? "comment" : "comments"}` : ""}
                      </span>
                    </span>
                  </li>
                `,
              )}
            </ol>`
          : html`<p>
              See the${" "}
              <a class="nl-link" href="/best?period=week">top stories of the week</a>.
            </p>`}
      </section>

      <section class="nl-section">
        <h2>Recent issues</h2>
        <p class="nl-links">
          <a class="n2-arrow-link" href="${ARCHIVE_URL}" target="_blank" rel="noopener"
            >Read past issues in the archive${Icon("arrow")}</a
          >
          <a class="n2-arrow-link" href="/weekly"
            >Top stories of every week${Icon("arrow")}</a
          >
        </p>
      </section>

      <section class="nl-section">
        <h2>Frequently asked questions</h2>
        <dl class="nl-faq">
          ${FAQ.map(
            ({ q, a }) => html`<div>
              <dt>${q}</dt>
              <dd>${a}</dd>
            </div>`,
          )}
        </dl>
      </section>

      <section class="nl-cta">
        <h2 id="subscribe-bottom">Subscribe to Kiwi News Weekly</h2>
        ${SignupForm("subscribe-bottom")}
        <p class="nl-fineprint">Free. Every Sunday. Unsubscribe anytime.</p>
      </section>
    </div>`,
  });
}
