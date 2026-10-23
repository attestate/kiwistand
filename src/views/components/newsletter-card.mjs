import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);

// NOTE: One headline for every sign-up card (feed, right column, story page,
// /weekly). Keep it in sync with HEADLINE in src/web/src/NewsletterFeedCard.jsx.
export const headline = "The week's 5 most-upvoted stories, every Sunday";
export const copy =
  "Picked by the Kiwi community's upvotes. No spam, unsubscribe anytime.";
// With a sample (last week's top stories, see lastWeekPitch in
// src/weekly.mjs), the copy introduces the list.
export const sampleCopy = "Free, no spam. Last week's top 3:";

// The sample list, also rendered by NewsletterFeedCard.jsx with the same
// markup so the client card replaces this one without a layout shift. Each
// title is one line (CSS ellipsis), so the card's height doesn't depend on
// the titles.
export function SampleList(sample) {
  return html`
    <ol class="newsletter-card-sample">
      ${sample.map(
        ({ title, href }) =>
          html`<li><a href=${href}>${title}</a></li>`,
      )}
    </ol>
  `;
}

// Inline newsletter sign-up card for the hot feed. The markup inside
// <newsletter-card> is the no-JS fallback: a plain form post to the subscribe
// endpoint. When the web bundle loads, NewsletterFeedCard.jsx replaces each
// one with the same card, submitted via fetch and with a dismiss button, or removes it
// for readers who already subscribed or dismissed it.
// The card itself. `source` tells the sign-ups apart in analytics:
// "feed_card" in the hot feed, "sidebar" in the desktop right column, "story"
// below a story's summary, "story_sidebar" in the story page's right column.
// `text` overrides the copy and `sample` ([{ title, href }]) adds a list of
// example stories (also passed to the client card through data-copy and
// data-sample).
export function NewsletterCardElement(source = "feed_card", text, sample) {
  const hasSample = Array.isArray(sample) && sample.length > 0;
  return html`
    <newsletter-card
      data-source=${source}
      data-copy=${hasSample ? sampleCopy : text}
      data-sample=${hasSample ? JSON.stringify(sample) : undefined}
    >
      <div class="newsletter-card">
        <div class="newsletter-card-eyebrow">Kiwi weekly</div>
        <div class="newsletter-card-title">${headline}</div>
        ${hasSample
          ? html`<p class="newsletter-card-copy">${sampleCopy}</p>
              ${SampleList(sample)}`
          : html`<p class="newsletter-card-copy">
              ${text || copy}${" "}<a
                class="newsletter-card-more"
                href="/newsletter"
                >What's in it?</a
              >
            </p>`}
        <form
          class="newsletter-card-form"
          method="post"
          action="/api/v1/newsletter/subscribe"
        >
          <input type="hidden" name="source" value=${source} />
          <input
            class="newsletter-card-input"
            type="email"
            name="email"
            required
            autocomplete="email"
            placeholder="you@email.com"
            aria-label="Email address"
          />
          <button class="newsletter-card-button" type="submit">
            Subscribe
          </button>
        </form>
      </div>
    </newsletter-card>
  `;
}

export const storyCopy = "Free, no spam, unsubscribe anytime.";

// The story page's row, right below the summary. Shown on mobile and desktop.
// `sample` is last week's top stories (null falls back to the generic copy).
export function StoryNewsletterCard(sample) {
  return html`
    <tr class="newsletter-story-row">
      <td style="padding: 0 0 8px 0;">
        ${NewsletterCardElement("story", storyCopy, sample)}
      </td>
    </tr>
  `;
}

// The hot feed's row. On desktop (where the right column shows) it is
// hidden by CSS, and the card sits below the QR code instead.
export default function NewsletterCard() {
  return html`
    <tr class="newsletter-card-row">
      <td>${NewsletterCardElement("feed_card")}</td>
    </tr>
  `;
}
