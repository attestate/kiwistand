import React, { useState, useRef } from "react";
import { EMAIL_RE, SUBSCRIBED_KEY, subscribe } from "./newsletter.mjs";

const SOURCE = "upvote";
const SHOWN_KEY = "newsletter-upvote-prompt-shown";
const TOAST_ID = "newsletter-upvote-prompt";
// Readers who subscribed, or said no to the card or the scroll modal, aren't
// asked again.
const SKIP_KEYS = [
  SUBSCRIBED_KEY,
  SHOWN_KEY,
  "newsletter-card-dismissed",
  "newsletter-modal-dismissed",
];

const Prompt = ({ toast, t }) => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | success
  const [hint, setHint] = useState("");
  const inputRef = useRef(null);

  const close = () => toast.dismiss(t.id);

  const handleDismiss = () => {
    window.posthog?.capture?.("newsletter_prompt_dismissed", {
      source: SOURCE,
    });
    close();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status === "sending") return;
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setHint("Please enter a valid email address.");
      inputRef.current?.focus();
      return;
    }
    setHint("");
    setStatus("sending");
    try {
      await subscribe(value, SOURCE);
      setStatus("success");
      setTimeout(close, 2500);
    } catch (err) {
      console.error("Upvote newsletter prompt error:", err);
      setHint("Something went wrong. Please try again.");
      setStatus("idle");
    }
  };

  const sending = status === "sending";

  return (
    <div
      className="newsletter-card"
      style={{
        margin: 0,
        width: "min(360px, calc(100vw - 32px))",
        backgroundColor: "var(--bg-white)",
        border: "var(--border)",
        boxShadow: "var(--shadow-default)",
      }}
    >
      <button
        type="button"
        className="newsletter-card-dismiss"
        aria-label="Dismiss newsletter sign-up"
        onClick={handleDismiss}
      >
        ×
      </button>
      <div className="newsletter-card-title">
        Get the week's top 5 stories every Sunday?
      </div>
      {status === "success" ? (
        <p className="newsletter-card-copy newsletter-card-success">
          You're in. See you Sunday.
        </p>
      ) : (
        <>
          <form
            className="newsletter-card-form"
            style={{ marginTop: "10px" }}
            onSubmit={handleSubmit}
            noValidate
          >
            <input
              ref={inputRef}
              className="newsletter-card-input"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@email.com"
              aria-label="Email address"
              value={email}
              disabled={sending}
              onChange={(e) => {
                setEmail(e.target.value);
                if (hint) setHint("");
              }}
            />
            <button
              className="newsletter-card-button"
              type="submit"
              disabled={sending}
            >
              {sending ? "..." : "Subscribe"}
            </button>
          </form>
          {hint && (
            <p className="newsletter-card-error" role="alert">
              {hint}
            </p>
          )}
        </>
      )}
    </div>
  );
};

// Called after a successful upvote. Shows the prompt once per browser, as a
// non-blocking toast below the "Thanks for your like" one.
export function maybeShowUpvoteNewsletterPrompt(toast) {
  try {
    if (localStorage.getItem("anon-mode") === "true") return;
    if (SKIP_KEYS.some((key) => localStorage.getItem(key))) return;
    localStorage.setItem(SHOWN_KEY, "true");
  } catch (err) {
    // No storage means we can't remember having asked: don't ask at all.
    return;
  }
  if (typeof toast?.custom !== "function") return;

  setTimeout(() => {
    toast.custom((t) => <Prompt toast={toast} t={t} />, {
      id: TOAST_ID,
      duration: 45000,
    });
    window.posthog?.capture?.("newsletter_prompt_shown", { source: SOURCE });
  }, 1500);
}
