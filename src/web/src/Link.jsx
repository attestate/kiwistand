// @format
import { WagmiConfig, useAccount } from "wagmi";
import { ConnectKitProvider } from "connectkit";

import client from "./client.mjs";

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
  return <a href={link}>
    {children}
  </a>;
};

export default Container;
