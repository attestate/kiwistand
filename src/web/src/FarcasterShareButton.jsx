import React from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import Fcicon from "./fcicon.jsx";

const buttonStyle = {
  minWidth: "40px",
  padding: "8px",
  border: "none",
  background: "transparent",
  borderRadius: "999px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.15s ease",
  color: "inherit",
};

export default function FarcasterShareButton({ title, slug, index, onShared }) {
  const [hover, setHover] = React.useState(false);

  const handleClick = async (e) => {
    e.preventDefault();
    try {
      if (navigator.sendBeacon) {
        const url = new URL(window.location.origin + "/share");
        url.searchParams.set("url", window.location.href);
        url.searchParams.set("type", "farcaster");
        navigator.sendBeacon(url.toString());
      }
    } catch {}

    const kiwiUrl = `https://news.kiwistand.com/stories/${slug}?index=${index}`;
    const composeUrl = `https://farcaster.xyz/~/compose?text=${encodeURIComponent(
      title,
    )}&embeds[]=${encodeURIComponent(kiwiUrl)}`;

    try {
      const inMini = await sdk.isInMiniApp();
      if (inMini && sdk?.actions?.composeCast) {
        await sdk.actions.composeCast({ text: title, embeds: [kiwiUrl] });
        onShared && onShared();
        return;
      }
    } catch {}

    try {
      // If inside a Farcaster client, prefer openUrl
      const inClient = window.ReactNativeWebView || window !== window.parent;
      if (inClient) {
        await sdk.actions.openUrl(composeUrl);
      } else {
        window.open(composeUrl, "_blank");
      }
    } catch {
      window.open(composeUrl, "_blank");
    }
  };

  return (
    <button
      className="farcaster-share-react"
      style={{
        ...buttonStyle,
        backgroundColor: hover ? "var(--color-farcaster-light)" : "transparent",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={handleClick}
      aria-label="Share on Farcaster"
    >
      <Fcicon style={{ width: 20, height: 20, color: "var(--color-farcaster-purple)" }} />
    </button>
  );
}

