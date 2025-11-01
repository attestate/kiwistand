import React, { useEffect, useState } from "react";
import sdk from "@farcaster/frame-sdk";

const BackButton = () => {
  const [canGoBack, setCanGoBack] = useState(false);
  const [referrer, setReferrer] = useState(null);
  const [isMiniApp, setIsMiniApp] = useState(false);

  useEffect(() => {
    // Check if we're in a mini app
    (async () => {
      try {
        const miniApp = await sdk.isInMiniApp();
        setIsMiniApp(miniApp);
      } catch (err) {
        // Not in mini app
      }
    })();

    // Check if we have a valid referrer from the same origin
    if (document.referrer) {
      try {
        const referrerUrl = new URL(document.referrer);
        const currentUrl = new URL(window.location.href);
        
        // Only use referrer if it's from the same origin
        if (referrerUrl.origin === currentUrl.origin) {
          setReferrer(document.referrer);
          setCanGoBack(true);
        }
      } catch (e) {
        // Invalid referrer URL
      }
    }

    // Check if we have history to go back to
    if (window.history.length > 1) {
      setCanGoBack(true);
    }
  }, []);

  const handleBackClick = async (e) => {
    e.preventDefault();
    
    // Handle webview/iframe context
    if (isMiniApp || window.ReactNativeWebView || window !== window.parent) {
      // Try to use the SDK's back navigation if available
      if (window.sdk?.back?.canGoBack) {
        try {
          const canGoBack = await window.sdk.back.canGoBack();
          if (canGoBack) {
            window.sdk.back.goBack();
            return;
          }
        } catch (err) {
          console.log("SDK back navigation not available:", err);
        }
      }
      
      // Fall back to regular navigation
      window.location.href = '/';
    } else {
      // Regular browser context
      if (referrer && referrer.includes(window.location.origin)) {
        // Go to the referrer if it's from the same site
        window.location.href = referrer;
      } else if (window.history.length > 1) {
        // Try to go back in history
        window.history.back();
      } else {
        // Fall back to home page
        window.location.href = '/';
      }
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", padding: "0 7px", height: "100%", width: "100%" }}>
      <a
        href="/"
        style={{
          color: "var(--text-primary)",
          textDecoration: "none",
          fontSize: "11pt",
          display: "inline-flex",
          alignItems: "center",
          minHeight: "44px",
          minWidth: "44px",
          padding: "0 5px",
          cursor: "pointer"
        }}
        onClick={handleBackClick}
      >
        <svg
          height="21px"
          viewBox="0 0 13 21"
          style={{ marginRight: "6px" }}
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="11.5 1.5 1.5 10.5 11.5 19.5" />
        </svg>
        <span style={{ marginTop: "1px" }}>Back</span>
      </a>
    </div>
  );
};

export default BackButton;