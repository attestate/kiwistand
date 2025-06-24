import React, { useState, useEffect } from "react";
import { WagmiConfig, useAccount } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { eligible } from "@attestate/delegator2";

import { getLocalAccount } from "./session.mjs";
import { client, chains, getProvider, isInFarcasterFrame } from "./client.mjs";
import { fetchKarma } from "./API.mjs";

export const resolveAvatar = async (address) => {
  if (!address) return null;

  try {
    // Use the existing /api/v1/profile endpoint that properly resolves avatars
    const res = await fetch(`/api/v1/profile/${address}`);
    if (!res.ok) return null;

    const response = await res.json();
    if (!response?.data) return null;

    // The profile endpoint returns a safeAvatar that's already properly processed
    return response.data.safeAvatar || null;
  } catch (err) {
    console.error("Avatar resolution failed:", err);
    return null;
  }
};

const Avatar = (props) => {
  const isStoryPage = window.location.pathname.startsWith("/stories");

  const handleBackClick = (event) => {
    // Always prevent the default link behavior when JS is active
    event.preventDefault();
    // Stop the event from bubbling up to parent elements
    event.stopPropagation();
    if (
      window.history.length > 1 &&
      document.referrer &&
      document.referrer.startsWith(window.location.origin)
    ) {
      // If there's history within the app, go back
      window.history.back();
    } else {
      // Otherwise, explicitly navigate to the root page
      window.location.href = "/";
    }
  };

  // --- Logic for Non-Story Pages ---
  let address;
  const account = useAccount();
  const localAccount = getLocalAccount(account.address, props.allowlist);
  
  // Check if we're in a mini app and get the connected wallet address
  // Note: Using conservative detection for UI - if frame detection passes, we assume mini app for UI purposes
  const isMiniAppForUI = isInFarcasterFrame() && window.sdk;
  
  if (account.isConnected) {
    address = account.address;
  }
  if (localAccount) {
    address = localAccount.identity;
  }
  
  // For mini apps, ensure we use the connected address even without allowlist eligibility
  if (isMiniAppForUI && account.isConnected && !address) {
    address = account.address;
  }

  const [avatar, setAvatar] = useState("");
  const [points, setPoints] = useState(0);
  const [karmaDiff, setKarmaDiff] = useState(0);

  // Initialize karmaDiff from sessionStorage on component mount
  useEffect(() => {
    if (address) {
      const sessionDiff = sessionStorage.getItem(`karmaDiff-${address}`);
      if (sessionDiff) {
        setKarmaDiff(parseInt(sessionDiff, 10));
      }
    }
  }, [address]);

  useEffect(() => {
    const getAvatar = async () => {
      const avatarUrl = await resolveAvatar(address);
      setAvatar(avatarUrl);
    };

    const getPoints = async () => {
      if (!address) return;

      const data = await fetchKarma(address);
      if (data && data.karma) {
        // Get previous karma from localStorage
        const prevKarma = localStorage.getItem(`karma-${address}`);
        const prevKarmaNum = prevKarma ? parseInt(prevKarma, 10) : data.karma;

        // Calculate difference
        const diff = data.karma - prevKarmaNum;
        if (diff > 0) {
          setKarmaDiff(diff);
          // Store the diff in sessionStorage to persist across page navigation
          sessionStorage.setItem(`karmaDiff-${address}`, diff.toString());
        }

        // Store current karma for next time
        localStorage.setItem(`karma-${address}`, data.karma.toString());

        setPoints(data.karma);
      }
    };

    getPoints();
    getAvatar();
  }, [address, account.isConnected]);

  if (isStoryPage) {
    // Render Back button with client-side logic, matching server-side structure
    // Container div does NOT have sidebar-toggle class
    return (
      <div
        style={{
          // Minimal container styling, no background, ensure it fills the slot
          display: "flex",
          alignItems: "center",
          padding: "0 7px", // Match server-side padding for consistency
          height: "100%",
          width: "100%",
        }}
      >
        <a
          href="/"
          onClick={handleBackClick}
          style={{
            color: "var(--text-primary)",
            textDecoration: "none",
            fontSize: "11pt",
            display: "inline-flex",
            alignItems: "center",
            minHeight: "44px",
            minWidth: "44px",
            padding: "0 5px",
            userSelect: "none",
          }}
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
  }

  // Only show avatar if we actually have an avatar image AND (points OR connected address)
  if (avatar && (points > 0 || address)) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          className="sidebar-toggle"
          style={{
            width: "33%",
            cursor: "pointer",
            alignItems: "center",
            justifyContent: "left",
            padding: "12px 0 7px 7px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              position: "relative",
            }}
          >
            <img
              src={avatar}
              style={{
                borderRadius: "2px",
                height: "18px",
                width: "18px",
                border: "1px solid var(--text-secondary)",
              }}
            />
            <div
              style={{
                marginTop: "3px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                lineHeight: "1",
              }}
            >
              <span
                style={{
                  fontWeight: "bold",
                  fontSize: "8px",
                  marginTop: "-2px",
                  color: "var(--text-primary)",
                }}
              >
                {points > 0 ? points.toString() : "0"}
              </span>
              {karmaDiff > 0 && (
                <span
                  onClick={() => {
                    setKarmaDiff(0);
                    sessionStorage.removeItem(`karmaDiff-${address}`);
                  }}
                  style={{
                    fontWeight: "bold",
                    fontSize: "8px",
                    marginTop: "0px",
                    color: "#00b67a",
                    cursor: "pointer",
                  }}
                  title="Click to dismiss"
                >
                  +{karmaDiff}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 13px 0 7px",
          background: "var(--hover-bg)",
          borderRadius: "2px",
        }}
      >
        <div
          style={{
            display: "flex",
            cursor: "pointer",
            alignItems: "center",
            justifyContent: "left",
            padding: "7px 0 7px 7px",
            position: "relative",
            userSelect: "none",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            style={{ userSelect: "none", paddingTop: "2px" }}
            viewBox="0 0 100 80"
            width="20"
            height="20"
            fill="currentColor"
          >
            <rect width="100" height="10"></rect>
            <rect y="30" width="100" height="10"></rect>
            <rect y="60" width="100" height="10"></rect>
          </svg>
          <span
            style={{ userSelect: "none", color: "var(--text-primary)", marginLeft: "10px" }}
          >
            Menu
          </span>
        </div>
      </div>
    );
  }
};

const Form = (props) => {
  return (
    <WagmiConfig config={client}>
      <RainbowKitProvider chains={chains}>
        <Avatar {...props} />
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default Form;
