import { useEffect } from "react";
import DOMPurify from "isomorphic-dompurify";
import { sdk } from "@farcaster/miniapp-sdk";

const ShareModal = ({ isOpen, onClose, title, url, storyUrl }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFarcasterShare = async () => {
    const shareUrl = `https://farcaster.xyz/~/compose?text=${encodeURIComponent(title)}&embeds[]=${encodeURIComponent(storyUrl)}`;
    try {
      const inMini = await sdk.isInMiniApp();
      if (inMini && sdk?.actions?.composeCast) {
        await sdk.actions.composeCast({ text: title, embeds: [storyUrl] });
        return;
      }
    } catch (e) {
      // fall through
    }
    const inMiniContext = window.ReactNativeWebView || window !== window.parent;
    if (inMiniContext) {
      try { await sdk.actions.openUrl(shareUrl); } catch { window.open(shareUrl, '_blank'); }
    } else { window.open(shareUrl, '_blank'); }
  };

  const handleGoToStory = () => {
    window.location.href = storyUrl;
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "var(--bg-overlay)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--bg-white)",
          borderRadius: "8px",
          padding: "2rem",
          maxWidth: "500px",
          width: "90%",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h2 style={{ margin: "0 0 0.5rem 0", fontSize: "24px" }}>
            🥝 Success! Your story has been submitted
          </h2>
          <p style={{ color: "var(--text-tertiary)", margin: "0", fontSize: "14px" }}>
            Share your submission with your network
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <button
            onClick={handleFarcasterShare}
            style={{
              padding: "16px",
              backgroundColor: "#472A91",
              color: "var(--text-white)",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
            }}
          >
            <svg
              style={{ width: "20px", height: "20px" }}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M23.2 21.4286C23.642 21.4286 24 21.7802 24 22.2143V23H16V22.2143C16 21.7802 16.358 21.4286 16.8 21.4286H23.2Z"
                stroke="white"
                fill="none"
              ></path>
              <path
                d="M23.2 21.4286V20.6429C23.2 20.2087 22.842 19.8571 22.4 19.8571H17.6C17.158 19.8571 16.8 20.2087 16.8 20.6429V21.4286H23.2Z"
                stroke="white"
                fill="none"
              ></path>
              <path d="M20 1H4V4.14286H20V1Z" stroke="white" fill="none"></path>
              <path
                d="M23.2 7.28571H0.8L0 4.14286H24L23.2 7.28571Z"
                stroke="white"
                fill="none"
              ></path>
              <path
                d="M22.4 7.28571H17.6L17.6 19.8571H22.4V7.28571Z"
                stroke="white"
                fill="none"
              ></path>
              <path
                d="M7.2 21.4286C7.642 21.4286 8 21.7802 8 22.2143V23H0V22.2143C0 21.7802 0.358 21.4286 0.8 21.4286H7.2Z"
                stroke="white"
                fill="none"
              ></path>
              <path
                d="M7.2 21.4286V20.6429C7.2 20.2087 6.842 19.8571 6.4 19.8571H1.6C1.158 19.8571 0.800001 20.2087 0.800001 20.6429L0.8 21.4286H7.2Z"
                stroke="white"
                fill="none"
              ></path>
              <path
                d="M6.4 7.28571H1.6L1.6 19.8571H6.4L6.4 7.28571Z"
                stroke="white"
                fill="none"
              ></path>
              <path
                d="M6.4 13.5086C6.4 10.471 8.9072 8.00857 12 8.00857C15.0928 8.00857 17.6 10.471 17.6 13.5086L17.6 7.28571H6.4L6.4 13.5086Z"
                stroke="white"
                fill="none"
              ></path>
            </svg>
            Share on Farcaster
          </button>

          <button
            onClick={handleGoToStory}
            style={{
              padding: "16px",
              backgroundColor: "var(--bg-white)",
              color: "var(--text-primary)",
              border: "2px solid var(--bg-black)",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "500",
            }}
          >
            View Story
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
