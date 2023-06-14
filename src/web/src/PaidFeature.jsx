// @format
import React, { useEffect, useState } from 'react';
import { WagmiConfig, useAccount } from 'wagmi';
import { ConnectKitProvider } from 'connectkit';

import client from "./client.mjs";

const PaidFeature = ({ children, freeFeature, allowList }) => {
  const { address } = useAccount();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (allowList.includes(address)) {
      setAllowed(true);
    }
  }, [address, allowList]);

  if (!address || !allowed) {
    return freeFeature;
  }

  return <>{children}</>;
};

const Container = ({children, freeFeature, allowList}) => {
  return (
    <WagmiConfig client={client}>
      <ConnectKitProvider>
        <PaidFeature allowList={allowList} freeFeature={freeFeature}>
          {children}
        </PaidFeature>
      </ConnectKitProvider>
    </WagmiConfig>
  );
};

export default Container;
