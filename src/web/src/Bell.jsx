// @format
import React, { useEffect, useState, useRef } from "react";
import { useAccount } from "wagmi";
import { resolveIdentity } from "@attestate/delegator2";
import { Wallet } from "@ethersproject/wallet";
import { useConnectModal } from "@rainbow-me/rainbowkit";

import * as API from "./API.mjs";
import {
  getLocalAccount,
  getCookie,
  ACCOUNT_CHANGE_EVENT,
} from "./session.mjs";
import { useProvider } from "./client.mjs";
import { subscribe } from "./newsletter.mjs";
import { dynamicPrefetch } from "./main.jsx";
import { showSpinnerOverlay } from "./spinnerOverlay.js";
import LoginModal from "./LoginModal.jsx";
import MS from "./ms.jsx";
import useAccountChange from "./useAccountChange.js";
import { useWebHaptics } from "web-haptics/react";
import { openDelegationModalForAction } from "./delegationModalManager.js";

const EmailSubscriptionForm = ({
  onSuccess,
  delegations,
  toast,
}) => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [subscribeToComments, setSubscribeToComments] = useState(true);
  const [subscribeToNewsletter, setSubscribeToNewsletter] = useState(true);
  const [subscribeToUpdates, setSubscribeToUpdates] = useState(true);
  const account = useAccount();
  const localAccount = getLocalAccount(account.address);
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

      // Subscribe to newsletter (single Buttondown list)
      if (subscribeToNewsletter || subscribeToUpdates) {
        await subscribe(email, "bell");
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
            backgroundColor: "var(--bg-white)",
            color: "var(--text-primary)",
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
              color: "var(--text-tertiary)",
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
              color: "var(--text-tertiary)",
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
              color: "var(--text-tertiary)",
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
              background: status === "sending" ? "var(--text-secondary)" : "var(--button-primary-bg)",
              color: status === "sending" ? "var(--bg-white)" : "var(--button-primary-text)",
              border: status === "sending" ? "none" : "1px solid var(--button-primary-bg)",
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

const ConnectedEmailSubscriptionForm = EmailSubscriptionForm;

export { ConnectedEmailSubscriptionForm };

// NOTE: Re-renders on a login without a page load (announceAccountChange
// in session.mjs) and then also fetches the delegations again (uncached), so
// a key delegated during the onboarding counts.
function useFreshDelegations(initial) {
  const [delegations, setDelegations] = useState(initial);
  useEffect(() => setDelegations(initial), [initial]);
  useEffect(() => {
    const refresh = async () => {
      try {
        const fresh = await API.fetchDelegations(false);
        if (fresh && typeof fresh === "object") setDelegations(fresh);
      } catch (err) {}
    };
    window.addEventListener(ACCOUNT_CHANGE_EVENT, refresh);
    return () => window.removeEventListener(ACCOUNT_CHANGE_EVENT, refresh);
  }, []);
  return delegations;
}

let wasTitleSet = false;
const Bell = (props) => {
  let address;
  const delegations = useFreshDelegations(props.delegations);
  useAccountChange();
  const account = useAccount();
  const localAccount = getLocalAccount(account.address);
  const loginModalRef = useRef();
  const { openConnectModal } = useConnectModal();
  const haptic = useWebHaptics();

  if (localAccount) {
    address = localAccount.identity;
  } else if (account.isConnected) {
    address = account.address;
  }
  const isEligible = address && resolveIdentity(delegations, address);
  const needsDelegation = isEligible && !localAccount && account?.isConnected;

  const localLastUpdate = parseInt(getCookie("lastUpdate"), 10);
  const [lastUpdate, setLastUpdate] = useState(localLastUpdate);
  const [notificationCount, setNotificationCount] = useState(0);
  const [readNotifications, setReadNotifications] = useState(0);
  const [isFull, setIsFull] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // NOTE: The cookie's lastUpdate (the newest notification already seen) goes
  // into the link, so the page (cached per URL) shows the unread rows, "N
  // new" and "Mark all as read" like the design.
  const seen = parseInt(getCookie("lastUpdate"), 10);
  const link = isEligible
    ? `/activity?address=${address}${seen ? `&lastUpdate=${seen}` : ""}`
    : "/";

  const handleClick = (event) => {
    // Added event parameter
    setIsFull(!isFull);
    haptic.trigger("selection");
    if (
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      event.button !== 1
    ) {
      showSpinnerOverlay();
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

  useEffect(() => {
    window.webkit?.messageHandlers?.kiwiNative?.postMessage({
      action: "notificationCount",
      count: notificationCount,
    });
  }, [notificationCount]);

  // Desktop: the account's avatar next to the bell (NEU 2 top bar).
  const [avatar, setAvatar] = useState(null);
  useEffect(() => {
    if (props.mobile || !address) return;
    let cancelled = false;
    fetch(`/api/v1/profile/${address}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json?.data?.safeAvatar) setAvatar(json.data.safeAvatar);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [address, props.mobile]);

  // NOTE: A signed-in account without notifications yet (e.g. right after a
  // passkey sign-in, which sets no lastUpdate) still gets its bell and
  // avatar; returning nothing here left an empty gap in the header.
  if (
    window.location.pathname === "/indexing" ||
    window.location.pathname === "/demonstration" ||
    window.location.pathname === "/invite" ||
    window.location.pathname === "/notifications" ||
    window.location.pathname === "/whattosubmit" ||
    window.location.pathname === "/pwa" ||
    window.location.pathname === "/friends"
  ) {
    // Render nothing for these specific paths or conditions
    return null;
  }

  // Render Connect Button if not connected/eligible
  // If wallet is connected but not logged in/eligible, hide the login button
  // (users should use disconnect in sidebar instead)
  if (!getCookie("identity") || !isEligible) {
    // Don't show login button if wallet is already connected
    if (account?.isConnected && account?.address && !needsDelegation) {
      return null;
    }
    if (needsDelegation) {
      const handleDelegationClick = (e) => {
        e.preventDefault();
        haptic.trigger("medium");
        openDelegationModalForAction();
      };

      return props.mobile ? (
        <button
          type="button"
          className="kn-tab-inner mobile-bell"
          onClick={handleDelegationClick}
        >
          <MS name="user-bold" size={24} />
          <span>Sign in</span>
        </button>
      ) : (
        <button
          type="button"
          className="kn-btn kn-btn-outline bell-button"
          onClick={handleDelegationClick}
        >
          Sign in
        </button>
      );
    }

    const handleLoginClick = (e) => {
      e.preventDefault();
      haptic.trigger("medium");
      loginModalRef.current?.openModal();
    };

    return (
      <>
        {props.mobile ? (
          <button
            type="button"
            className="kn-tab-inner mobile-bell"
            onClick={handleLoginClick}
          >
            <MS name="user-bold" size={24} />
            <span>Log in</span>
          </button>
        ) : (
          <button
            type="button"
            className="kn-btn kn-btn-outline bell-button"
            onClick={handleLoginClick}
          >
            Log in
          </button>
        )}
        <LoginModal
          ref={loginModalRef}
          delegations={delegations}
          toast={props.toast}
        />
      </>
    );
  }

  // Render Bell Icon if connected/eligible
  dynamicPrefetch(link);
  if (notificationCount > 0 && !wasTitleSet) {
    document.title = `[${notificationCount}] ${document.title}`;
    wasTitleSet = true;
  }

  const disabled = !lastUpdate && readNotifications === 0;
  const active = isFull || window.location.pathname === "/activity";

  if (props.mobile) {
    return (
      <a
        data-no-instant
        disabled={disabled}
        title="Notifications"
        href={link}
        className={`kn-tab-inner mobile-bell${active ? " kn-tab-active" : ""}`}
        onClick={handleClick}
      >
        <MS name={active ? "bell-fill" : "bell-bold"} size={24} />
        <span>Notifications</span>
        {notificationCount > 0 && (
          <span className="kn-tab-badge">{notificationCount}</span>
        )}
      </a>
    );
  }

  return (
    <>
      <a
        data-no-instant
        disabled={disabled}
        title="Notifications"
        aria-label={
          notificationCount > 0
            ? `${notificationCount} new notifications`
            : "Notifications"
        }
        href={link}
        className="kn-iconbtn bell-button"
        onClick={handleClick}
      >
        {/* NOTE: The desktop frames keep the outlined bell, also on the
            notifications page. */}
        <MS name="bell-bold" size={18} />
        {notificationCount > 0 && <span className="kn-iconbtn-dot" />}
      </a>
      <a
        href="/profile"
        className="kn-account-avatar"
        title="Your profile"
        aria-label="Your profile"
      >
        {avatar ? <img src={avatar} alt="" /> : <MS name="user" size={18} />}
      </a>
    </>
  );
};

export default Bell;

// Export Bell directly if it's used standalone elsewhere
export { Bell };
