// @format
import { useEffect, useState } from "react";
import { WagmiConfig, useAccount } from "wagmi";
import { ConnectKitProvider } from "connectkit";

import { getCookie, setCookie } from "./session.mjs";
import client from "./client.mjs";

async function fetchNotifications(address) {
  const response = await fetch(`/activity?address=${address}`, {
    method: 'GET',
    headers: {
      'If-None-Match': getCookie('etag')
    },
    credentials: 'omit'
  });

  const newEtag = response.headers.get('ETag');
  const oldEtag = getCookie('etag');

  return oldEtag !== newEtag;
}

const Container = (props) => {
  return (
    <WagmiConfig client={client}>
      <ConnectKitProvider>
        <Link {...props} />
      </ConnectKitProvider>
    </WagmiConfig>
  );
};

const Link = ({to, children}) => {
  const { address } = useAccount();
  const link = `${to}?address=${address}`;

  const [hasNewNotifications, setHasNewNotifications] = useState(false);

  useEffect(() => {
    const fetchAndUpdateNotifications = async () => {
      const isNew = await fetchNotifications(address);
      setHasNewNotifications(isNew);
    }
    fetchAndUpdateNotifications();
  }, [address]);

  return (
    <a href={link} style={{ position: 'relative' }}>
      {children}
      {hasNewNotifications && 
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '54px',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: 'red',
          zIndex: 100,
        }}></div>
      }
    </a>
  );
};

export default Container;
