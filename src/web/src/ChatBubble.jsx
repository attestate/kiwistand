import React, { useState, useEffect } from "react";

import { ChatsSVG } from "./icons.jsx";

const ChatBubble = ({ storyIndex, commentCount }) => {
  let isFeedbot = false;
  try {
    BigInt(storyIndex);
  } catch (err) {
    isFeedbot = true;
  }
  commentCount = parseInt(commentCount, 10);
  return (
    <a
      disabled={isFeedbot}
      onClick={() => {
        if (isFeedbot) return;
        window.dispatchEvent(new CustomEvent(`open-comments-${storyIndex}`));
      }}
      href={null}
      className={`chat-bubble${isFeedbot ? "" : " interaction-element"}`}
      id={`chat-bubble-${storyIndex}`}
      style={{
        cursor: isFeedbot ? "not-allowed" : "pointer",
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
          color: isFeedbot ? "grey" : "rgba(0,0,0,0.65)",
          width: "25px",
        }}
      />
      <span style={{ color: "rgba(0,0,0,0.65)", fontSize: "8pt" }}>
        {commentCount !== 0 ? commentCount : null}
      </span>
    </a>
  );
};

export default ChatBubble;
