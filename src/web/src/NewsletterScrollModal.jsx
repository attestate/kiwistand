import React, { useState, useEffect, useRef } from "react";

const NewsletterScrollModal = ({ toast }) => {
  const [email, setEmail] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(0);
  const modalRef = useRef(null);

  useEffect(() => {
    // For testing: add ?newsletter=test to URL to reset and show modal
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('newsletter') === 'test') {
      localStorage.removeItem("newsletter-modal-dismissed");
      localStorage.removeItem("newsletter-subscribed");
    }
    
    // Check if user has already subscribed or dismissed
    const dismissed = localStorage.getItem("newsletter-modal-dismissed");
    const subscribed = localStorage.getItem("newsletter-subscribed");
    
    if (dismissed || subscribed) {
      setIsDismissed(true);
    }
  }, []);

  useEffect(() => {
    if (!modalRef.current) return;

    const handleScroll = () => {
      const modal = modalRef.current;
      if (!modal || isDismissed) return;

      const rect = modal.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const scrollY = window.scrollY;
      
      // Calculate how much of the modal is visible
      let visibilityPercentage = 0;
      
      if (rect.bottom > 0 && rect.top < windowHeight) {
        // Modal is at least partially visible
        const visibleHeight = Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0);
        const modalHeight = rect.height;
        visibilityPercentage = visibleHeight / modalHeight;
      }
      
      // Set overlay opacity based on visibility (max 0.5)
      setOverlayOpacity(visibilityPercentage * 0.5);
      
      // Calculate the position where modal would be centered
      const modalAbsoluteTop = window.innerHeight * 1.5; // 150vh from document top
      const modalHeight = rect.height;
      const maxScroll = modalAbsoluteTop - (windowHeight / 2 - modalHeight / 2);
      
      // If we're scrolled past the max position, scroll back
      if (scrollY > maxScroll) {
        window.scrollTo(0, maxScroll);
      }
    };

    // Use a capturing listener to intercept scroll before default handling
    const handleWheel = (e) => {
      const modal = modalRef.current;
      if (!modal || isDismissed) return;
      
      const rect = modal.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const scrollY = window.scrollY;
      
      // Calculate max scroll position
      const modalAbsoluteTop = window.innerHeight * 1.5;
      const modalHeight = rect.height;
      const maxScroll = modalAbsoluteTop - (windowHeight / 2 - modalHeight / 2);
      
      // If scrolling down and we're at or past the limit, prevent default
      if (e.deltaY > 0 && scrollY >= maxScroll - 5) {
        e.preventDefault();
        window.scrollTo(0, maxScroll);
      }
    };

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("wheel", handleWheel, { passive: false });
    handleScroll(); // Check initial position

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("wheel", handleWheel);
    };
  }, [isDismissed]);

  const handleClose = () => {
    setIsDismissed(true);
    localStorage.setItem("newsletter-modal-dismissed", "true");
  };

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email || isSubscribing) return;

    setIsSubscribing(true);
    
    try {
      // Subscribe to newsletter
      const response = await fetch(
        "/api/v1/newsletter/subscribe",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        }
      );

      if (response.ok) {
        localStorage.setItem("newsletter-subscribed", "true");
        toast.success("Successfully subscribed to Kiwi News Newsletter!");
        setIsDismissed(true);
      } else {
        toast.error("Failed to subscribe. Please try again.");
      }
    } catch (error) {
      console.error("Subscription error:", error);
      toast.error("Failed to subscribe. Please try again.");
    } finally {
      setIsSubscribing(false);
    }
  };

  if (isDismissed) return null;

  return (
    <>
      <style>{`
        .newsletter-container {
          position: absolute;
          top: 150vh; /* Position it 1.5 viewport heights down the page */
          left: 0;
          right: 0;
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          z-index: 5; /* Below nav which is typically z-index: 6 or higher */
          padding: 20px 20px 0 20px;
          box-sizing: border-box;
        }

        .newsletter-modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0);
          z-index: 4; /* Below the modal container */
          pointer-events: none;
          transition: background-color 0.1s ease-out;
        }

        .newsletter-modal-backdrop.interactive {
          pointer-events: auto;
        }

        .newsletter-modal {
          position: relative;
          width: 90%;
          max-width: 500px;
          background-color: #f6f6ef;
          border-radius: 0;
          padding: 26px 24px 32px 24px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .newsletter-close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          background: none;
          border: none;
          font-size: 28px;
          cursor: pointer;
          color: #666;
          padding: 4px;
          line-height: 1;
          transition: color 0.2s;
        }

        .newsletter-close-btn:hover {
          color: #142615;
        }

        .newsletter-logo {
          width: 64px;
          height: 64px;
          margin: 0 auto 24px;
          background-color: #142615;
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
          margin: 0 0 12px 0;
          color: #142615;
          line-height: 1.2;
        }

        .newsletter-subtitle {
          font-size: 12pt;
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          text-align: center;
          color: #666;
          margin: 0 0 28px 0;
          line-height: 1.2;
        }

        .newsletter-input {
          width: 100%;
          padding: 7px 14px;
          font-size: 11pt;
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #142615;
          border: 1px solid #142615;
          border-radius: 0;
          margin-bottom: 8px;
          background-color: #f6f6ef;
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }

        .newsletter-input:focus {
          border-color: #c5d54e;
        }

        .newsletter-submit {
          width: 100%;
          padding: 7px 14px;
          font-size: 12pt;
          font-weight: bold;
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background-color: #c5d54e;
          color: #142615;
          border: 1px solid #142615;
          border-radius: 0;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .newsletter-submit:hover:not(:disabled) {
          background-color: #b5c43e;
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
          color: #999;
          margin-top: 12px;
          margin-bottom: 0;
        }
      `}</style>

      {/* Dark backdrop that fades based on scroll position */}
      <div
        className={`newsletter-modal-backdrop ${overlayOpacity > 0.1 ? 'interactive' : ''}`}
        onClick={handleClose}
        style={{ 
          backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` 
        }}
      />

      {/* Container positioned absolutely on the page */}
      <div className="newsletter-container">
        <div className="newsletter-modal" ref={modalRef}>
          {/* Close button */}
          <button
            onClick={handleClose}
            className="newsletter-close-btn"
            aria-label="Close"
          >
            ×
          </button>

          {/* Kiwi Logo */}
          <div className="newsletter-logo">
            <img src="/kiwi-icon.webp" alt="Kiwi" />
          </div>

          {/* Heading */}
          <h2 className="newsletter-title">
            Subscribe to<br />Kiwi News Newsletter
          </h2>

          {/* Subheading */}
          <p className="newsletter-subtitle">
            Get weekly updates with curated stories and trusted insights, handpicked for you.
          </p>

          {/* Email Form */}
          <form onSubmit={handleSubscribe}>
            <input
              type="email"
              className="newsletter-input"
              placeholder="Enter your e-mail..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubscribing}
              required
            />

            <button
              type="submit"
              className="newsletter-submit"
              disabled={isSubscribing}
            >
              {isSubscribing ? "Subscribing..." : "Subscribe"}
            </button>
          </form>

          {/* Footer text */}
          <p className="newsletter-footer">
            Subscription is free. You may cancel anytime at no cost.
          </p>
        </div>
      </div>
    </>
  );
};

export default NewsletterScrollModal;
