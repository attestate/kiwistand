import React, { useRef, useState } from "react";

import { getCookie } from "./session.mjs";
import Fcicon from "./fcicon.jsx";

const copySVG = (
  <svg
    style={{ height: "1rem" }}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <polyline
      points="168 168 216 168 216 40 88 40 88 88"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
    <rect
      x="40"
      y="88"
      width="128"
      height="128"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
  </svg>
);

const InviteLink = ({ toast }) => {
  const cookieValue = getCookie("identity") || "0x";
  const referralLink = `https://news.kiwistand.com/?referral=${cookieValue}`;
  const wcLink = `https://warpcast.com/~/compose?embeds[]=${referralLink}`;
  const inputRef = useRef(null);

  const copyToClipboard = () => {
    const input = inputRef.current;
    input.select();
    document.execCommand("copy");
    toast.success("Link copied!");
  };

  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
      <input
        ref={inputRef}
        type="text"
        value={referralLink}
        readOnly
        style={{
          height: "40px",
          width: "60%",
          padding: "10px 15px",
          border: "1px solid #ccc",
          borderRadius: "2px",
          marginRight: "10px",
        }}
      />
      <button
        id="button-onboarding"
        style={{ width: "15%", marginRight: "10px", height: "40px" }}
        onClick={copyToClipboard}
      >
        {copySVG}
      </button>
      <button
        id="button-onboarding"
        style={{ backgroundColor: "#472a91", width: "15%", height: "40px" }}
        onClick={() => window.open(wcLink, "_blank")}
      >
        <Fcicon style={{ height: "1rem", color: "white" }} />
      </button>
    </div>
  );
};

export default InviteLink;
