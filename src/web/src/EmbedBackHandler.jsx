import { useEffect } from "react";
import sdk from "@farcaster/frame-sdk";

const EmbedBackHandler = () => {
  useEffect(() => {
    const initBackButton = async () => {
      try {
        // Check if we're in a mini app
        const isMiniApp = await sdk.isInMiniApp();
        if (!isMiniApp) return;

        // Check if back navigation is supported
        const capabilities = await sdk.getCapabilities();
        if (!capabilities.includes('back')) return;

        // Show the back button
        await sdk.back.show();
        
        // Set up manual back handler for the embed page
        sdk.back.onback = () => {
          // Use history.back() first if possible
          if (window.history.length > 1) {
            window.history.back();
          } else {
            window.location.href = '/';
          }
        };
      } catch (err) {
        console.log('Could not initialize back button:', err);
      }
    };

    // Only initialize if we're on the embed page
    if (window.location.pathname === '/embed') {
      initBackButton();
    }

    // Cleanup
    return () => {
      try {
        sdk.back.onback = null;
      } catch (err) {
        // Ignore cleanup errors
      }
    };
  }, []);

  return null;
};

export default EmbedBackHandler;