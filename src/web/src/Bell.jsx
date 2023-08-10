// @format
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { fetchNotifications } from "./API.mjs";

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
    <a href={link} style={{ position: "relative" }}>
      <i className="icon">
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
      </i>
    </a>
  );
};

export default Bell;
