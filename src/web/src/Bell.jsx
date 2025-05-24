// @format
import React, { useEffect, useState } from "react";
import { WagmiConfig, useAccount } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { eligible } from "@attestate/delegator2";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import { Wallet } from "@ethersproject/wallet";

import { Connector, TextConnectButton } from "./Navigation.jsx";
import * as API from "./API.mjs";
import { isIOS, getLocalAccount, getCookie } from "./session.mjs";
import { client, chains, useProvider } from "./client.mjs";
import { dynamicPrefetch } from "./main.jsx";
import { sdk } from "@farcaster/frame-sdk";
import KiwipassMintModal from "./KiwipassMintModal.jsx";

const EmailSubscriptionForm = ({
  onSuccess,
  allowlist,
  delegations,
  toast,
}) => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [subscribeToComments, setSubscribeToComments] = useState(true);
  const [subscribeToNewsletter, setSubscribeToNewsletter] = useState(true);
  const [subscribeToUpdates, setSubscribeToUpdates] = useState(true);
  const account = useAccount();
  const localAccount = getLocalAccount(account.address, allowlist);
  const provider = useProvider();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("sending");

    try {
      // Subscribe to comment notifications
      if (subscribeToComments) {
        const value = API.messageFab(email, email, "EMAILAUTH");
        let signature;
        try {
          const signer = new Wallet(localAccount.privateKey, provider);
          signature = await signer._signTypedData(
            API.EIP712_DOMAIN,
            API.EIP712_TYPES,
            value,
          );
        } catch (err) {
          console.error("Signing failed:", err);
          setStatus("error");
          return;
        }

        const wait = null;
        const endpoint = "/api/v1/email-notifications";
        const port = window.location.port;

        try {
          const response = await API.send(
            value,
            signature,
            wait,
            endpoint,
            port,
          );
          if (response.status !== "success") {
            console.error("API error:", response.details);
            throw new Error(
              response.details || "Failed to subscribe to comments",
            );
          }
        } catch (err) {
          console.error("Network request failed:", err);
          throw err;
        }
      }

      // Subscribe to newsletter
      if (subscribeToNewsletter) {
        const response = await fetch(
          "https://paragraph.xyz/api/blogs/@kiwi-weekly/subscribe",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email }),
          },
        );

        if (!response.ok) {
          throw new Error("Newsletter subscription failed");
        }
      }

      // Subscribe to Kiwi Updates
      if (subscribeToUpdates) {
        const response = await fetch(
          "https://paragraph.xyz/api/blogs/@kiwi-updates/subscribe",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email }),
          },
        );
        if (!response.ok) {
          throw new Error("Kiwi Updates subscription failed");
        }
      }

      setStatus("success");
      onSuccess();
    } catch (err) {
      console.error("Subscription error:", err);
      toast.error("Failed to subscribe");
      setStatus("error");
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: "320px", marginBottom: "3rem" }}>
      <h1
        style={{
          fontFamily: "var(--font-family)",
          fontSize: "24px",
          fontWeight: "600",
          marginBottom: "24px",
        }}
      >
        Stay Updated
      </h1>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          style={{
            width: "100%",
            padding: "12px",
            marginBottom: "16px",
            border: "var(--border-thin)",
            borderRadius: "2px",
            fontSize: "11pt",
          }}
          required
        />

        <div style={{ marginBottom: "24px" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "12px",
              fontSize: "11pt",
              color: "#666",
            }}
          >
            <input
              type="checkbox"
              checked={subscribeToComments}
              onChange={(e) => setSubscribeToComments(e.target.checked)}
              style={{ marginRight: "8px" }}
            />
            Get notified about replies to your comments
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: "11pt",
              color: "#666",
              marginBottom: "12px", // Added margin for spacing
            }}
          >
            <input
              type="checkbox"
              checked={subscribeToNewsletter}
              onChange={(e) => setSubscribeToNewsletter(e.target.checked)}
              style={{ marginRight: "8px" }}
            />
            Subscribe to Kiwi Weekly
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: "11pt",
              color: "#666",
            }}
          >
            <input
              type="checkbox"
              checked={subscribeToUpdates}
              onChange={(e) => setSubscribeToUpdates(e.target.checked)}
              style={{ marginRight: "8px" }}
            />
            Subscribe to Kiwi Updates
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            disabled={status === "sending"}
            style={{
              padding: "8px 16px",
              background: status === "sending" ? "#828282" : "black",
              color: "white",
              border: "none",
              borderRadius: "2px",
              cursor: "pointer",
              fontSize: "11pt",
            }}
          >
            {status === "sending" ? "Subscribing..." : "Subscribe"}
          </button>
        </div>
      </form>
    </div>
  );
};

const ConnectedEmailSubscriptionForm = (props) => {
  return (
    <Connector {...props}>
      <EmailSubscriptionForm {...props} />
    </Connector>
  );
};

export { ConnectedEmailSubscriptionForm };

const NotificationButton = ({ onEnabled }) => {
  const [permissionStatus, setPermissionStatus] = useState("default");

  useEffect(() => {
    const handlePermissionResult = (event) => {
      setPermissionStatus(event.detail);
      if (event.detail === "granted" && onEnabled) {
        onEnabled();
      }
    };

    window.addEventListener(
      "notificationPermissionResult",
      handlePermissionResult,
    );
    return () => {
      window.removeEventListener(
        "notificationPermissionResult",
        handlePermissionResult,
      );
    };
  }, [onEnabled]);

  const handleNotificationRequest = () => {
    if (window.requestIOSNotifications) {
      window.requestIOSNotifications();
    }
  };

  return (
    <button
      onClick={handleNotificationRequest}
      style={{
        padding: "6px 12px",
        background: "black",
        color: "white",
        border: "var(--border)",
        borderRadius: "2px",
        cursor: "pointer",
        fontSize: "10pt",
      }}
    >
      {permissionStatus === "granted"
        ? "Notifications Enabled"
        : "Enable Notifications"}
    </button>
  );
};

let wasTitleSet = false;
const Bell = (props) => {
  let address;
  const account = useAccount();
  const localAccount = getLocalAccount(account.address, props.allowlist);
  if (localAccount) {
    address = localAccount.identity;
  } else if (account.isConnected) {
    address = account.address;
  }
  const isEligible =
    address && eligible(props.allowlist, props.delegations, address);

  const localLastUpdate = parseInt(getCookie("lastUpdate"), 10);
  const [lastUpdate, setLastUpdate] = useState(localLastUpdate);
  const [notificationCount, setNotificationCount] = useState(0);
  const [readNotifications, setReadNotifications] = useState(0);
  const [isFull, setIsFull] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const link = isEligible ? `/activity?address=${address}` : "/kiwipass-mint";

  const handleClick = (event) => {
    // Added event parameter
    setIsFull(!isFull);
    if (
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      event.button !== 1
    ) {
      document.getElementById("spinner-overlay").style.display = "block";
    }
  };

  useEffect(() => {
    if (!address || isLoading) return;

    const fetchAndUpdateNotifications = async () => {
      setIsLoading(true);

      try {
        const notifications = await API.fetchNotifications(address);
        const localLastUpdate = parseInt(getCookie("lastUpdate"), 10);
        setReadNotifications(notifications.length);

        const newNotifications = notifications
          .filter((elem) => elem.timestamp > localLastUpdate)
          .sort((a, b) => b.timestamp - a.timestamp);
        setNotificationCount(newNotifications.length);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndUpdateNotifications();
  }, [address]); // Removed isLoading from dependency array to avoid potential loop

  const mobileBellStyle = props.mobile
    ? {
        padding: "0", // Remove padding
        backgroundColor: "transparent", // No background
        border: "none", // No border
        display: "flex", // Use flex for layout
        flexDirection: "column", // Stack icon and text vertically
        alignItems: "center", // Center items horizontally
        justifyContent: "center", // Center items vertically
        position: "relative",
        textDecoration: "none", // Remove underline from link
        color: "black", // Ensure text color is black
        height: "100%", // Fill container height
      }
    : {
        // Desktop styles
        padding: "10px 10px",
        backgroundColor: "var(--bg-off-white)",
        border: "var(--border)",
        borderRadius: "2px",
        display: "inline-flex",
        position: "relative",
      };

  if (
    props.mobile &&
    !isEligible &&
    !getCookie("identity") &&
    account?.isConnected
  ) {
    return (
      <a
        style={mobileBellStyle}
        title="Sign up"
        href="/kiwipass-mint"
        className="mobile-bell"
      >
        <div
          style={
            props.mobile
              ? { position: "relative", display: "inline-block" }
              : {}
          }
        >
          {window.location.pathname === "/kiwipass-mint" ? (
            <PersonFullSVG />
          ) : (
            <PersonSVG />
          )}
        </div>
        <span style={{ fontSize: "9px", marginTop: "2px" }}>Sign up</span>
      </a>
    );
  }

  if (
    (isEligible && !lastUpdate && readNotifications === 0) ||
    window.location.pathname === "/indexing" ||
    window.location.pathname === "/kiwipass-mint" ||
    window.location.pathname === "/demonstration" ||
    window.location.pathname === "/invite" ||
    window.location.pathname === "/notifications" ||
    window.location.pathname === "/whattosubmit" ||
    window.location.pathname === "/pwa" ||
    window.location.pathname === "/start" ||
    window.location.pathname === "/friends"
  ) {
    // Render nothing for these specific paths or conditions
    // For mobile nav consistency, we might want to render *something*
    // but for now, adhering to original logic.
    // If a placeholder is needed on mobile, return null conditionally based on props.mobile
    return null;
  }

  // Render Connect Button if not connected/eligible
  if (!getCookie("identity") || !isEligible) {
    const mobileConnectStyle = props.mobile
      ? {
          display: "flex", // Changed to flex for column layout
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "black",
          textAlign: "center",
          fontSize: "9pt", // Adjusted size slightly
          padding: "0", // Remove padding for tighter fit
          flexGrow: 1,
          border: "none",
          backgroundColor: "transparent", // No background needed
          textDecoration: "none", // Ensure no underline
          height: "100%", // Fill container height
        }
      : {
          // Desktop styles remain the same
          color: "black",
          textAlign: "center",
          fontSize: "9pt",
          display: "inline",
          padding: "10px 10px",
          border: "3px inset #59321C",
          backgroundColor: "#E2F266",
        };

    return (
      <TextConnectButton
        className={props.mobile ? "mobile-bell" : "bell-button"}
        style={mobileConnectStyle}
        allowlist={props.allowlist}
        delegations={props.delegations}
        text={
          props.mobile ? (
            // Using Fragment to group elements for flex layout
            <>
              <svg
                style={{ width: "24px", height: "24px" }} // Added style for size
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 256 256"
              >
                <rect width="256" height="256" fill="none" />
                <path
                  d="M40,56V184a16,16,0,0,0,16,16H216a8,8,0,0,0,8-8V80a8,8,0,0,0-8-8H56A16,16,0,0,1,40,56h0A16,16,0,0,1,56,40H192"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="16"
                />
                <circle cx="180" cy="132" r="12" />
              </svg>
              <span style={{ fontSize: "9px", marginTop: "2px" }}>Connect</span>
            </>
          ) : (
            "Connect" // Desktop text
          )
        }
      />
    );
  }

  // Render Bell Icon if connected/eligible
  dynamicPrefetch(link);
  if (notificationCount > 0 && !wasTitleSet) {
    document.title = `[${notificationCount}] ${document.title}`;
    wasTitleSet = true;
  }

  const disabled = !lastUpdate && readNotifications === 0;

  return (
    <a
      data-no-instant
      disabled={disabled}
      title="Notifications"
      href={link}
      className={props.mobile ? "mobile-bell" : "bell-button"}
      onClick={handleClick}
      style={mobileBellStyle}
    >
      <div
        style={
          props.mobile ? { position: "relative", display: "inline-block" } : {}
        }
      >
        {isFull || window.location.pathname === "/activity" ? (
          <BellSVGFull mobile={props.mobile} />
        ) : (
          <BellSVG
            mobile={props.mobile}
            style={disabled ? { color: "grey" } : {}}
          />
        )}
        {notificationCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: props.mobile ? "-2px" : "5px", // Adjusted position for mobile
              right: props.mobile ? "-5px" : "8px", // Adjusted position for mobile
              backgroundColor: "red",
              borderRadius: "50%", // Make it round
              color: "white",
              padding: "1px",
              fontSize: "8px",
              fontWeight: "bold",
              minWidth: "13px", // Keep min width
              height: "13px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: "1", // Ensure text fits vertically
            }}
          >
            {notificationCount}
          </span>
        )}
      </div>
      {props.mobile && (
        <span style={{ fontSize: "9px", marginTop: "2px" }}>Notifications</span>
      )}
    </a>
  );
};

const Form = (props) => {
  // This component seems to wrap Bell for desktop scenarios or modals
  // Ensure Bell receives the mobile prop correctly if Form is used in mobile layout
  return (
    <Connector {...props}>
      <KiwipassMintModal {...props} />
      <Bell {...props} />
    </Connector>
  );
};

export default Form; // Assuming Form is the intended export for general use

// Export Bell directly if it's used standalone elsewhere
export { Bell };

const BellSVGFull = (props) => (
  <svg
    style={
      props.mobile
        ? { width: "24px", height: "24px" } // Explicit size for mobile
        : {
            color: "black",
            width: "1.5rem", // Desktop size
          }
    }
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216Z" />
  </svg>
);
const BellSVG = (props) => (
  <svg
    style={
      props.mobile
        ? { width: "24px", height: "24px", ...props.style } // Explicit size for mobile
        : {
            color: "black",
            width: "1.5rem", // Desktop size
            ...props.style,
          }
    }
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <path
      d="M96,192a32,32,0,0,0,64,0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
    <path
      d="M56,104a72,72,0,0,1,144,0c0,35.82,8.3,64.6,14.9,76A8,8,0,0,1,208,192H48a8,8,0,0,1-6.88-12C47.71,168.6,56,139.81,56,104Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
  </svg>
);

const PersonSVG = () => (
  <svg
    style={{ width: "24px", height: "24px" }}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <circle
      cx="128"
      cy="96"
      r="64"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
    <path
      d="M32,216c19.37-33.47,54.55-56,96-56s76.63,22.53,96,56"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
  </svg>
);

const PersonFullSVG = () => (
  <svg
    style={{ width: "24px", height: "24px" }}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <path d="M230.93,220a8,8,0,0,1-6.93,4H32a8,8,0,0,1-6.92-12c15.23-26.33,38.7-45.21,66.09-54.16a72,72,0,1,1,73.66,0c27.39,8.95,50.86,27.83,66.09,54.16A8,8,0,0,1,230.93,220Z" />
  </svg>
);
