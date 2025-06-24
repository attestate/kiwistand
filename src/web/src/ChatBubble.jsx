import React, { useState, useEffect } from "react";
import { WagmiConfig, useAccount } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";

import { getLocalAccount } from "./session.mjs";
import { ChatsSVG } from "./icons.jsx";
import { client, chains } from "./client.mjs";

const ChatBubble = ({ allowlist, delegations, storyIndex, commentCount }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  let address;
  const account = useAccount();
  const localAccount = getLocalAccount(account.address, allowlist);
  if (account.isConnected) {
    address = account.address;
  }
  if (localAccount) {
    address = localAccount.identity;
  }

  commentCount = parseInt(commentCount, 10);

  let isDisabled = false;
  try {
    BigInt(storyIndex);
  } catch (err) {
    isDisabled = true;
  }
  if (!address && commentCount === 0) {
    isDisabled = true;
  }

  useEffect(() => {
    const toggle = (evt) => {
      if (evt?.detail?.source === "chat-bubble") return;
      setIsExpanded(!isExpanded);
    };
    window.addEventListener(`open-comments-${storyIndex}`, toggle);
    return () =>
      window.removeEventListener(`open-comments-${storyIndex}`, toggle);
  });

  return (
    <a
      disabled={isDisabled}
      onClick={() => {
        if (isDisabled) return;
        setIsExpanded(!isExpanded);
        window.dispatchEvent(
          new CustomEvent(`open-comments-${storyIndex}`, {
            detail: {
              source: "chat-bubble",
            },
          }),
        );
        window.dispatchEvent(new HashChangeEvent("hashchange"));

        const commentPreview = document.querySelector(
          `.comment-preview-${storyIndex}`,
        );
        if (commentPreview) {
          commentPreview.style.opacity = 1;
        }
        const borderElem = document.querySelector(
          `.without-comment-preview-${storyIndex}`,
        );
        if (borderElem) {
          borderElem.classList.toggle("no-border");
        }
      }}
      href={null}
      className={`chat-bubble${isDisabled ? "" : " interaction-element"}`}
      id={`chat-bubble-${storyIndex}`}
      style={{
        cursor: isDisabled ? "not-allowed" : "pointer",
        margin: "5px",
        backgroundColor: "var(--bg-off-white)",
        border: isExpanded ? "1px solid var(--button-primary-bg)" : "var(--border-thin)",
        borderRadius: "2px",
        display: "flex",
        alignSelf: "stretch",
        justifyContent: "center",
        minWidth: "49px",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <ChatsSVG
        style={{
          color: isDisabled
            ? "var(--text-muted)"
            : isExpanded
            ? "var(--button-primary-bg)"
            : "var(--text-secondary)",
          width: "25px",
        }}
      />
      <span
        style={{
          userSelect: "none",
          color: isExpanded ? "var(--button-primary-bg)" : "var(--text-secondary)",
          fontSize: "8pt",
          fontWeight: "bold",
        }}
      >
        {commentCount !== 0 ? commentCount : null}
      </span>
    </a>
  );
};

const Container = (props) => {
  return (
    <WagmiConfig config={client}>
      <RainbowKitProvider chains={chains}>
        <ChatBubble {...props} />
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default Container;
