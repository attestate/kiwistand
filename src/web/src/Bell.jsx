// @format
import { useEffect, useState } from "react";
import { WagmiConfig, useAccount } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { eligible } from "@attestate/delegator2";

import { fetchNotifications } from "./API.mjs";
import { getLocalAccount, getCookie } from "./session.mjs";
import { client, chains } from "./client.mjs";
import { dynamicPrefetch } from "./main.jsx";

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
  const [cacheBuster, setCacheBuster] = useState("");
  const [isFull, setIsFull] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const link = isEligible
    ? `/activity?address=${address}${
        cacheBuster ? `&cacheBuster=${cacheBuster}` : ""
      }`
    : "/kiwipass-mint";

  const handleClick = () => {
    setIsFull(!isFull);
  };

  useEffect(() => {
    if (!address || isLoading) return;

    const fetchAndUpdateNotifications = async () => {
      setIsLoading(true);

      try {
        const notifications = await fetchNotifications(address);
        const localLastUpdate = parseInt(getCookie("lastUpdate"), 10);
        setReadNotifications(notifications.length);

        const newNotifications = notifications
          .filter((elem) => elem.timestamp > localLastUpdate)
          .sort((a, b) => b.timestamp - a.timestamp);
        if (newNotifications.length > 0) {
          setCacheBuster(`0x${newNotifications[0].message.index}`);
        }
        setNotificationCount(newNotifications.length);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndUpdateNotifications();
  }, [address]);

  if (
    (isEligible && !lastUpdate && readNotifications === 0) ||
    window.location.pathname === "/indexing" ||
    window.location.pathname === "/kiwipass-mint" ||
    window.location.pathname === "/demonstration" ||
    window.location.pathname === "/invite" ||
    window.location.pathname === "/passkeys" ||
    window.location.pathname === "/notifications" ||
    window.location.pathname === "/whattosubmit" ||
    window.location.pathname === "/pwa" ||
    window.location.pathname === "/start" ||
    window.location.pathname === "/friends"
  ) {
    return null;
  }

  if (!getCookie("identity") || !isEligible) {
    return (
      <a
        style={{
          textAlign: "center",
          fontSize: "6pt",
          display: props.mobile ? "inline-flex" : "inline",
          padding: props.mobile ? "" : "10px 10px",
          flexGrow: 1,
          width: "1.5rem",
        }}
        className={props.mobile ? "mobile-bell" : "bell-button"}
        href="/gateway"
      >
        Sign {props.mobile && <br />}
        up
      </a>
    );
  }

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
      style={{
        padding: props.mobile ? "" : "10px 10px",
        backgroundColor: props.mobile ? "" : "var(--bg-off-white)",
        border: props.mobile ? "" : "var(--border)",
        borderRadius: "2px",
        display: "inline-flex",
        position: "relative",
      }}
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
            top: props.mobile ? "8px" : "5px",
            right: props.mobile ? "32px" : "8px",
            backgroundColor: "red",
            borderRadius: "2px",
            color: "white",
            padding: "1px",
            fontSize: "8px",
            fontWeight: "bold",
            minWidth: "13px",
            height: "13px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {notificationCount}
        </span>
      )}
    </a>
  );
};

const Form = (props) => {
  return (
    <WagmiConfig config={client}>
      <RainbowKitProvider chains={chains}>
        <Bell {...props} />
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default Form;

const BellSVGFull = (props) => (
  <svg
    style={
      props.mobile
        ? {}
        : {
            color: "black",
            width: "1.5rem",
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
        ? { ...props.style }
        : {
            color: "black",
            width: "1.5rem",
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
