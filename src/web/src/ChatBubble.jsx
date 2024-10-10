import React, { useState, useEffect } from "react";
import { WagmiConfig, useAccount } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";

import { getLocalAccount } from "./session.mjs";
import { ChatsSVG } from "./icons.jsx";
import { client, chains } from "./client.mjs";

const ChatBubble = ({ allowlist, delegations, storyIndex, commentCount }) => {
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

  return (
    <a
      disabled={isDisabled}
      onClick={() => {
        if (isDisabled) return;
        window.dispatchEvent(new CustomEvent(`open-comments-${storyIndex}`));
      }}
      href={null}
      className={`chat-bubble${isDisabled ? "" : " interaction-element"}`}
      id={`chat-bubble-${storyIndex}`}
      style={{
        cursor: isDisabled ? "not-allowed" : "pointer",
        margin: "5px",
        backgroundColor: "#e6e6df",
        borderRadius: "2px",
        display: "flex",
        alignSelf: "stretch",
        justifyContent: "center",
        minWidth: "40px",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <ChatsSVG
        style={{
          color: isDisabled ? "grey" : "rgba(0,0,0,0.65)",
          width: "25px",
        }}
      />
      <span style={{ color: "rgba(0,0,0,0.65)", fontSize: "8pt" }}>
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
