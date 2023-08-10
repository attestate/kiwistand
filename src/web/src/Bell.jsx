// @format
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { fetchNotifications } from "./API.mjs";

const BellSVGFull = () => (
  <svg
    style={{
      color: "black",
      width: "1.75rem",
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
      width: "1.75rem",
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

const Bell = ({ to, children }) => {
  const { address } = useAccount();
  const link = `${to}?address=${address}`;

  const [hasNewNotifications, setHasNewNotifications] = useState(false);

  useEffect(() => {
    if (address) {
      const fetchAndUpdateNotifications = async () => {
        const isNew = await fetchNotifications(address);
        setHasNewNotifications(isNew);
      };
      fetchAndUpdateNotifications();
    }
  }, [address]);

  return (
    <a title="Notifications" href={link} style={{ position: "relative" }}>
      <i className="icon">
        {window.location.pathname === "/activity" ? (
          <BellSVGFull />
        ) : (
          <BellSVG />
        )}
      </i>
    </a>
  );
};

export default Bell;
