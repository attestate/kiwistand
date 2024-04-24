// @format
import { useEffect, useState } from "react";
import { WagmiConfig, useAccount } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { eligible } from "@attestate/delegator2";

import { fetchNotifications } from "./API.mjs";
import { getLocalAccount, getCookie } from "./session.mjs";
import { client, chains } from "./client.mjs";

const Bell = (props) => {
  let address;
  const account = useAccount();
  const localAccount = getLocalAccount(account.address);
  if (account.isConnected) {
    address = account.address;
  }
  if (localAccount) {
    address = localAccount.identity;
  }
  const isEligible =
    address && eligible(props.allowlist, props.delegations, address);
  const link = `/activity?address=${address}`;

  const [notificationCount, setNotificationCount] = useState(0);
  const [readNotifications, setReadNotifications] = useState(0);
  const [documentTitle] = useState(document.title);

  useEffect(() => {
    if (address) {
      const fetchAndUpdateNotifications = async () => {
        const notifications = await fetchNotifications(address);
        const lastUpdate = getCookie("lastUpdate");
        setReadNotifications(notifications.length);

        const count = notifications.reduce((acc, notification) => {
          return notification.timestamp > lastUpdate ? acc + 1 : acc;
        }, 0);
        setNotificationCount(count);
      };
      fetchAndUpdateNotifications();
    }
  }, [address]);

  if (
    !isEligible ||
    (!getCookie("lastUpdate") && readNotifications === 0) ||
    window.location.pathname === "/indexing" ||
    window.location.pathname === "/kiwipass-mint" ||
    window.location.pathname === "/demonstration" ||
    window.location.pathname === "/invite" ||
    window.location.pathname === "/passkeys" ||
    window.location.pathname === "/notifications" ||
    window.location.pathname === "/whattosubmit" ||
    window.location.pathname === "/pwa" ||
    window.location.pathname === "/start"
  ) {
    return null;
  }

  if (notificationCount > 0 && documentTitle === document.title) {
    document.title = `[${notificationCount}] ${documentTitle}`;
  }

  return (
    <a
      title="Notifications"
      href={link}
      className="bell-button"
      style={{
        padding: "10px 10px",
        backgroundColor: "rgba(0, 0, 0, 0.1)",
        borderRadius: "2px",
        display: "inline-flex",
        position: "relative",
      }}
    >
      <i className="icon">
        {window.location.pathname === "/activity" ? (
          <BellSVGFull />
        ) : (
          <BellSVG />
        )}
      </i>
      {notificationCount > 0 && (
        <span
          style={{
            position: "absolute",
            top: "5px",
            right: "8px",
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

const BellSVGFull = () => (
  <svg
    style={{
      color: "black",
      width: "1.5rem",
    }}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216Z" />
  </svg>
);
const BellSVG = () => (
  <svg
    style={{
      color: "black",
      width: "1.5rem",
    }}
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
