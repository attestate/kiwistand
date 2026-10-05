//@format
import htm from "htm";
import vhtml from "vhtml";
import { sub } from "date-fns";

import Header from "./components/header.mjs";
import Sidebar from "./components/sidebar.mjs";
import Footer from "./components/footer.mjs";
import { custom } from "./components/head.mjs";
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
const BANNED_DOMAINS = ["imagedelivery.net"];
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
          domain: story.href.startsWith("data:") ? null : hostname(story.href),
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

const styles = `
  .nl-page { padding: 1.5rem 1rem 2rem 1rem; max-width: 640px; color: var(--text-primary); line-height: 1.55; }
  .nl-page h1 { font-size: 1.6rem; line-height: 1.25; margin: 0 0 0.5rem 0; }
  .nl-page h2 { font-size: 1.15rem; margin: 2rem 0 0.5rem 0; }
  .nl-page h3 { font-size: 1rem; margin: 1rem 0 0.25rem 0; }
  .nl-page p, .nl-page li { font-size: 1rem; }
  .nl-lede { color: var(--text-tertiary); margin: 0 0 1.25rem 0; }
  .nl-form { display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 0.5rem 0 0.25rem 0; }
  .nl-form input[type="email"] { flex: 1 1 220px; min-width: 0; font-size: 1rem; padding: 0.55rem 0.7rem; border: var(--border-thick); border-radius: 2px; background: var(--bg-white); color: var(--text-primary); font-family: var(--font-family); }
  .nl-form input[type="email"]:focus { outline: 2px solid var(--accent-primary-focus); outline-offset: 0; }
  .nl-form button { font-size: 1rem; padding: 0.55rem 1.1rem; border: none; border-radius: 2px; background: var(--button-primary-bg); color: var(--button-primary-text); cursor: pointer; font-family: var(--font-family); font-weight: 600; }
  .nl-form button:hover { background: var(--button-primary-bg-hover); }
  .nl-fineprint { font-size: 0.85rem; color: var(--text-secondary); margin: 0.25rem 0 0 0; }
  .nl-status { padding: 0.6rem 0.8rem; border-radius: 2px; margin: 0 0 1rem 0; border: var(--border-thick); }
  .nl-status-ok { background: var(--accent-primary-light); }
  .nl-status-error { background: var(--color-warning-bg); color: var(--color-warning-text); }
  .nl-picks { padding-left: 1.4rem; }
  .nl-picks li { margin-bottom: 0.5rem; }
  .nl-picks a { color: var(--text-primary); }
  .nl-meta { color: var(--text-secondary); font-size: 0.85rem; }
  .nl-page a.nl-link { text-decoration: underline; }
`;

function SignupForm(id) {
  return html`
    <form
      class="nl-form"
      method="post"
      action="/api/v1/newsletter/subscribe"
      aria-labelledby="${id}"
    >
      <input type="hidden" name="redirect" value="/newsletter" />
      <input
        type="email"
        name="email"
        required
        autocomplete="email"
        inputmode="email"
        placeholder="you@example.com"
        aria-label="Email address"
      />
      <button type="submit">Subscribe</button>
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

export default async function (theme, { status = null, picks = null } = {}) {
  const weeklyPicks = picks || (await getWeeklyPicks());

  return (
    "<!DOCTYPE html>" +
    html`
      <html lang="en" op="news">
        <head>
          ${custom(
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
          ></script>
          <style dangerouslySetInnerHTML=${{ __html: styles }}></style>
        </head>
        <body>
          <div class="container">
            ${Sidebar()}
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
                    <main class="nl-page">
                      <h1>Kiwi News Weekly: the Ethereum and web3 links builders actually read</h1>
                      <p class="nl-lede">
                        Every Sunday, the five stories the Kiwi News community
                        upvoted most that week. Free, one email, unsubscribe
                        anytime.
                      </p>
                      ${Status(status)}
                      <h2 id="subscribe">Get it in your inbox</h2>
                      ${SignupForm("subscribe")}
                      <p class="nl-fineprint">
                        Sent via Buttondown. We only use your address to send
                        the newsletter. <a class="nl-link" href="/privacy-policy">Privacy policy</a>.
                      </p>

                      <h2>What is Kiwi News Weekly?</h2>
                      <p>
                        <a class="nl-link" href="/">Kiwi News</a> is a
                        community-curated link aggregator for Ethereum and web3,
                        similar to Hacker News. Links are submitted and upvoted
                        by Kiwi Pass holders: developers, researchers, founders
                        and people who spend their days onchain. Every
                        submission and upvote is a signed, public message.
                      </p>
                      <p>
                        Kiwi News Weekly is the short version. Each Sunday we
                        take the stories that got the most upvotes, comments and
                        clicks over the past seven days and send you the top
                        five. No algorithmic feed, no paid placements, no
                        price talk for its own sake.
                      </p>

                      <h2>Who it's for</h2>
                      <ul>
                        <li>Ethereum and web3 developers who want to know which new tools, EIPs and repos are worth their time</li>
                        <li>Researchers following protocol design, cryptography, MEV and scaling</li>
                        <li>Founders and product people who need to keep up without living on X or Farcaster</li>
                        <li>Anyone who prefers a few good links over an endless timeline</li>
                      </ul>

                      <h2>What's in an issue</h2>
                      <ul>
                        <li><strong>The week's top five links</strong>, with a preview, the source and who submitted it. Expect new tools and releases, research, deep dives and the occasional essay</li>
                        <li><strong>Notable discussions</strong>: upvote and comment counts, and a link to each story's Kiwi comment thread where builders discuss it</li>
                        <li><strong>Posts from X, Farcaster and Bluesky</strong> shown inline when one made the list, so you can read them without an account</li>
                        <li>
                          <strong>Kiwi News updates</strong>, such as the native
                          iOS app, currently in${" "}
                          <a class="nl-link" href="${TESTFLIGHT_URL}" target="_blank" rel="noopener">public beta on TestFlight</a>
                        </li>
                      </ul>

                      <h2>This week's picks</h2>
                      <p>
                        A live preview: these are the stories leading this
                        week's issue right now, based on the past seven days of
                        community votes.
                      </p>
                      ${weeklyPicks.length
                        ? html`<ol class="nl-picks">
                            ${weeklyPicks.map(
                              (pick) => html`
                                <li>
                                  <a href="/stories/${getSlug(pick.title)}?index=0x${pick.index}">${pick.title}</a>
                                  <br />
                                  <span class="nl-meta">
                                    ${pick.domain ? `${pick.domain} · ` : ""}${pick.upvotes} ${pick.upvotes === 1 ? "upvote" : "upvotes"}${pick.comments ? ` · ${pick.comments} ${pick.comments === 1 ? "comment" : "comments"}` : ""}
                                  </span>
                                </li>
                              `,
                            )}
                          </ol>`
                        : html`<p>
                            See the${" "}
                            <a class="nl-link" href="/best?period=week">top stories of the week</a>.
                          </p>`}
                      <h3>Recent issues</h3>
                      <p>
                        <a class="nl-link" href="${ARCHIVE_URL}" target="_blank" rel="noopener">Read past issues of Kiwi News Weekly</a>${" "}in the archive.
                      </p>

                      <h2>Frequently asked questions</h2>
                      ${FAQ.map(
                        ({ q, a }) => html`
                          <h3>${q}</h3>
                          <p>${a}</p>
                        `,
                      )}

                      <h2 id="subscribe-bottom">Subscribe to Kiwi News Weekly</h2>
                      ${SignupForm("subscribe-bottom")}
                      <p class="nl-fineprint">Free. Every Sunday. Unsubscribe anytime.</p>
                    </main>
                  </td>
                </tr>
              </table>
              ${Footer(theme)}
            </div>
          </div>
        </body>
      </html>
    `
  );
}
