import React, { useState, useEffect, useRef } from "react";

const HEADLINE = "Get the best of Kiwi News weekly";
const COPY =
  "Five stories the community upvoted most, every Sunday. No spam, unsubscribe anytime.";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SUBSCRIBED_KEY = "newsletter-subscribed"; // shared with NewsletterScrollModal
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
  return (
    readFlag("anon-mode") === "true" ||
    !!readFlag(SUBSCRIBED_KEY) ||
    !!readFlag(DISMISSED_KEY)
  );
}

const NewsletterFeedCard = () => {
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
          window.posthog?.capture?.("newsletter_card_shown");
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
    window.posthog?.capture?.("newsletter_card_dismissed");
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
      const response = await fetch("/api/v1/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      if (!response.ok) throw new Error(`Status ${response.status}`);
      writeFlag(SUBSCRIBED_KEY);
      window.posthog?.capture?.("newsletter_subscribed", {
        source: "feed_card",
      });
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
      <div className="newsletter-card-title">{HEADLINE}</div>
      {status === "success" ? (
        <p className="newsletter-card-copy newsletter-card-success">
          You're in. See you Sunday.
        </p>
      ) : (
        <>
          <p className="newsletter-card-copy">{COPY}</p>
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
