// @format
import { WagmiConfig, createClient } from "wagmi";
import { ConnectKitProvider, ConnectKitButton, getDefaultClient } from "connectkit";

import client from "./client.mjs";

const shorten = address => address.slice(0,6)+"..."+address.slice(address.length-4, address.length);

export const Navigation = () => {
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, show, hide, address }) => {
        const divider = <span> | </span>;
        const submit = <a style={{ color: "black", cursor: "pointer" }} href="/submit">Submit</a>;

        return (
          <div>
            <a style={{color: "black"}} href="/subscribe">Subscribe</a>
            {divider}
            {isConnected ? <span>{submit}{divider}</span> : ""}
            <a style={{color: "black", cursor: "pointer"}} onClick={show}>
              {isConnected ? shorten(address) : "Login"}
            </a>
          </div>
        );
      }}
    </ConnectKitButton.Custom>
  );
};

const Connector = () => {
  return (
    <WagmiConfig client={client}>
    <ConnectKitProvider>
        <Navigation />
      </ConnectKitProvider>
    </WagmiConfig>
  );
};

export default Connector;
