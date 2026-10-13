import React, { useEffect, useState } from "react";
import sdk from "@farcaster/frame-sdk";
import { useWebHaptics } from "web-haptics/react";
import MS from "./ms.jsx";

const BackButton = () => {
  const [canGoBack, setCanGoBack] = useState(false);
  const [referrer, setReferrer] = useState(null);
  const [isMiniApp, setIsMiniApp] = useState(false);
  const haptic = useWebHaptics();

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
    haptic.trigger("selection");
    
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

  // NOTE: The NEU 2 glass button (same as the server-rendered one in
  // views/components/header.mjs that this replaces).
  return (
    <a
      href="/"
      className="kn-glass"
      aria-label="Back"
      onClick={handleBackClick}
    >
      <MS name="chevron_left" size={20} />
    </a>
  );
};

export default BackButton;
