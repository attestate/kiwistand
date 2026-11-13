import React, { useState, useEffect, useRef } from "react";
import { EMAIL_RE, SUBSCRIBED_KEY, subscribe } from "./newsletter.mjs";
import { capture } from "./analytics.mjs";

// NOTE: Keep in sync with src/views/components/newsletter-card.mjs, which
// renders the same card on the server (same markup, so no layout shift).
const HEADLINE = "The week's 5 most-upvoted stories, every Sunday";
const COPY =
  "Picked by the Kiwi community's upvotes. No spam, unsubscribe anytime.";
const DISMISSED_KEY = "newsletter-card-dismissed";

function readFlag(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    return null;
  }
}

function writeFlag(key) {
  try {
    localStorage.setItem(key, "true");
  } catch (err) {}
}

export function shouldHideCard() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("newsletter") === "test") {
      localStorage.removeItem(SUBSCRIBED_KEY);
      localStorage.removeItem(DISMISSED_KEY);
    }
  } catch (err) {}
  return !!readFlag(SUBSCRIBED_KEY) || !!readFlag(DISMISSED_KEY);
}

// data-sample on <newsletter-card>: last week's top stories as JSON
// ([{ title, href }]), or nothing.
export function parseSample(value) {
  if (!value) return null;
  try {
    const sample = JSON.parse(value);
    if (!Array.isArray(sample)) return null;
    const valid = sample.filter(
      (item) =>
        item &&
        typeof item.title === "string" &&
        typeof item.href === "string" &&
        item.href.startsWith("/"),
    );
    return valid.length ? valid : null;
  } catch (err) {
    return null;
  }
}

const NewsletterFeedCard = ({ source = "feed_card", copy, sample }) => {
  const [hidden, setHidden] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | success
  const [error, setError] = useState("");
  const cardRef = useRef(null);

  useEffect(() => {
    if (hidden) return;
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          capture("newsletter_card_shown", { source });
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hidden]);

  if (hidden) return null;

  const handleDismiss = () => {
    writeFlag(DISMISSED_KEY);
    capture("newsletter_card_dismissed", { source });
    setHidden(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status === "sending") return;

    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError("Please enter a valid email address.");
      return;
    }

    setError("");
    setStatus("sending");
    try {
      await subscribe(value, source);
      setStatus("success");
    } catch (err) {
      console.error("Newsletter card subscription error:", err);
      setError("Something went wrong. Please try again.");
      setStatus("idle");
    }
  };

  const sending = status === "sending";

  return (
    <div className="newsletter-card" ref={cardRef}>
      {status !== "success" && (
        <button
          type="button"
          className="newsletter-card-dismiss"
          aria-label="Dismiss newsletter sign-up"
          onClick={handleDismiss}
        >
          ×
        </button>
      )}
      <div className="newsletter-card-top">
        <img
          className="newsletter-card-mascot"
          src="/kiwi-glasses.webp"
          alt=""
          width="52"
          height="52"
          loading="lazy"
        />
        <div className="newsletter-card-eyebrow">Kiwi weekly</div>
      </div>
      <div className="newsletter-card-title">{HEADLINE}</div>
      {status === "success" ? (
        <p className="newsletter-card-copy newsletter-card-success">
          You're in. See you Sunday.
        </p>
      ) : (
        <>
          {sample ? (
            <>
              <p className="newsletter-card-copy">{copy}</p>
              <ol className="newsletter-card-sample">
                {sample.map(({ title, href }) => (
                  <li key={href}>
                    <a href={href}>{title}</a>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="newsletter-card-copy">
              {copy || COPY}{" "}
              <a className="newsletter-card-more" href="/newsletter">
                What's in it?
              </a>
            </p>
          )}
          <form
            className="newsletter-card-form"
            method="post"
            action="/api/v1/newsletter/subscribe"
            onSubmit={handleSubmit}
            noValidate
          >
            <input
              className="newsletter-card-input"
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@email.com"
              aria-label="Email address"
              value={email}
              disabled={sending}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
            />
            <button
              className="newsletter-card-button"
              type="submit"
              disabled={sending}
            >
              {sending ? "Subscribing..." : "Subscribe"}
            </button>
          </form>
          {error && (
            <p className="newsletter-card-error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default NewsletterFeedCard;
