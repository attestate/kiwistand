import htm from "htm";
import vhtml from "vhtml";

const html = htm.bind(vhtml);

export const headline = "Get the best of Kiwi News weekly";
export const copy =
  "Five stories the community upvoted most, every Sunday. No spam, unsubscribe anytime.";

// Inline newsletter sign-up card for the hot feed. The markup inside
// <newsletter-card> is the no-JS fallback: a plain form post to the subscribe
// endpoint. When the web bundle loads, NewsletterFeedCard.jsx replaces it with
// the same card, submitted via fetch and with a dismiss button, or removes it
// for readers who already subscribed or dismissed it.
export default function NewsletterCard() {
  return html`
    <tr class="newsletter-card-row">
      <td>
        <newsletter-card>
          <div class="newsletter-card">
            <div class="newsletter-card-title">${headline}</div>
            <p class="newsletter-card-copy">${copy}</p>
            <form
              class="newsletter-card-form"
              method="post"
              action="/api/v1/newsletter/subscribe"
            >
              <input type="hidden" name="source" value="feed_card" />
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
      </td>
    </tr>
  `;
}
