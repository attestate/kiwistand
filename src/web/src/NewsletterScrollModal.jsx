import React, { useState, useEffect, useRef } from "react";
import Modal from "react-modal";
import { EMAIL_RE, subscribe } from "./newsletter.mjs";

const SOURCE = "scroll_modal";

if (typeof document !== "undefined") {
  Modal.setAppElement("body");
}

const modalStyles = {
  overlay: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 120,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    position: "relative",
    inset: "unset",
    width: "90%",
    maxWidth: "500px",
    backgroundColor: "var(--background-color0)",
    borderRadius: 0,
    padding: "26px 24px 32px 24px",
    boxShadow: "var(--shadow-default)",
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    border: "none",
  },
};

const NewsletterScrollModal = ({ toast }) => {
  const [email, setEmail] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hint, setHint] = useState("");
  const inputRef = useRef(null);
  const [shouldShow, setShouldShow] = useState(false);
  const dismissed = useRef(false);
  const triggerRef = useRef(null);
  const hasTrackedShownRef = useRef(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('newsletter') === 'test') {
      localStorage.removeItem("newsletter-modal-dismissed");
      localStorage.removeItem("newsletter-subscribed");
    }

    const dismissed = localStorage.getItem("newsletter-modal-dismissed");
    const subscribed = localStorage.getItem("newsletter-subscribed");

    if (!dismissed && !subscribed) {
      setShouldShow(true);
    }
  }, []);

  useEffect(() => {
    if (!shouldShow || isOpen) return;

    const handleScroll = () => {
      if (dismissed.current) return;

      // Only trigger if user has genuinely scrolled down (not pull-to-refresh)
      if (window.scrollY < 100) return;

      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      if (rect.top <= window.innerHeight) {
        if (!hasTrackedShownRef.current) {
          hasTrackedShownRef.current = true;
          window.posthog?.capture?.("newsletter_modal_shown", {
            source: SOURCE,
          });
        }
        setIsOpen(true);
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [shouldShow, isOpen]);

  const handleClose = () => {
    dismissed.current = true;
    setIsOpen(false);
    setShouldShow(false);
    try {
      localStorage.setItem("newsletter-modal-dismissed", "true");
    } catch (err) {}
    window.posthog?.capture?.("newsletter_modal_dismissed", { source: SOURCE });
  };

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (isSubscribing) return;

    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      // Don't fail silently: point at the field and say what's missing.
      setHint(
        value
          ? "Please enter a valid email address."
          : "Enter your email address to subscribe.",
      );
      inputRef.current?.focus();
      return;
    }

    setHint("");
    setIsSubscribing(true);

    try {
      await subscribe(value, SOURCE);
      toast.success("You're in. See you Sunday!");
      setIsOpen(false);
      setShouldShow(false);
    } catch (error) {
      console.error("Subscription error:", error);
      toast.error("Failed to subscribe. Please try again.");
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <>
      <style>{`
        .newsletter-trigger {
          position: absolute;
          top: 150vh;
          left: 0;
          width: 1px;
          height: 1px;
          pointer-events: none;
        }

        .newsletter-close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          background: none;
          border: none;
          font-size: 28px;
          cursor: pointer;
          color: var(--text-tertiary);
          padding: 4px;
          line-height: 1;
          transition: color 0.2s;
        }

        .newsletter-close-btn:hover {
          color: var(--text-primary);
        }

        .newsletter-logo {
          width: 64px;
          height: 64px;
          margin: 0 auto 24px;
          background-color: var(--text-primary);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .newsletter-logo img {
          width: 40px;
          height: 40px;
          filter: saturate(90%);
        }

        .newsletter-title {
          font-size: 17pt;
          font-weight: 700;
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          text-align: center;
          margin: 0 0 8px 0;
          color: var(--text-primary);
          line-height: 1.2;
        }

        .newsletter-social-proof {
          font-size: 10pt;
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          text-align: center;
          color: var(--text-secondary);
          font-weight: 600;
          margin: 0 0 20px 0;
        }

        .newsletter-input {
          width: 100%;
          padding: 7px 14px;
          font-size: 11pt;
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: var(--text-primary);
          border: var(--border-thin);
          border-radius: 0;
          margin-bottom: 8px;
          background-color: var(--bg-white);
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }

        .newsletter-hint {
          font-size: 10pt;
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #b3261e;
          margin: -2px 0 8px 0;
        }

        @media (prefers-color-scheme: dark) {
          .newsletter-hint {
            color: #ff8a80;
          }
        }

        .newsletter-input:focus {
          border-color: var(--accent-primary);
        }

        .newsletter-submit {
          width: 100%;
          padding: 7px 14px;
          font-size: 12pt;
          font-weight: bold;
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background-color: var(--accent-primary);
          color: var(--color-black);
          border: var(--border-thin);
          border-radius: 0;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .newsletter-submit:hover:not(:disabled) {
          background-color: var(--accent-primary-hover);
        }

        .newsletter-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .newsletter-footer {
          font-size: 9pt;
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-weight: normal;
          text-align: center;
          color: var(--text-quaternary);
          margin-top: 12px;
          margin-bottom: 0;
        }

        .newsletter-footer a {
          color: var(--text-tertiary);
          text-decoration: underline;
        }

        .newsletter-footer a:hover {
          color: var(--text-secondary);
        }
      `}</style>

      {shouldShow && <div className="newsletter-trigger" ref={triggerRef} />}

      <Modal
        isOpen={isOpen}
        onRequestClose={handleClose}
        style={modalStyles}
        shouldCloseOnOverlayClick={true}
      >
        <button
          onClick={handleClose}
          className="newsletter-close-btn"
          aria-label="Close"
        >
          ×
        </button>

        <div className="newsletter-logo">
          <img src="/kiwi-icon.webp" alt="Kiwi" />
        </div>

        <h2 className="newsletter-title">
          Top 5 crypto links. Every Sunday.
        </h2>

        <p className="newsletter-social-proof">
          The week's 5 most-upvoted stories on Kiwi News.
        </p>

        <form onSubmit={handleSubscribe} noValidate>
          <input
            ref={inputRef}
            type="email"
            className="newsletter-input"
            placeholder="you@email.com"
            autoComplete="email"
            aria-label="Email address"
            aria-invalid={hint ? "true" : undefined}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (hint) setHint("");
            }}
            disabled={isSubscribing}
            required
          />
          {hint && (
            <p className="newsletter-hint" role="alert">
              {hint}
            </p>
          )}

          <button
            type="submit"
            className="newsletter-submit"
            disabled={isSubscribing}
          >
            {isSubscribing ? "Joining..." : "Get Sunday's digest"}
          </button>
        </form>

        <p className="newsletter-footer">
          Free forever. Unsubscribe anytime. <a href="https://buttondown.com/kiwi-news-weekly/archive/" target="_blank" rel="noopener noreferrer">See past issues</a>
        </p>
      </Modal>
    </>
  );
};

export default NewsletterScrollModal;
