// @format
import { WagmiConfig, createClient } from "wagmi";
import { Avatar, ConnectKitProvider, ConnectKitButton, getDefaultClient } from "connectkit";

import client from "./client.mjs";

const shorten = address => address.slice(0,6)+"..."+address.slice(address.length-4, address.length);

export const Navigation = () => {
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, show, hide, address }) => {
        const divider = <span> | </span>;
        const submit = <a style={{ color: "black", cursor: "pointer" }} href="/submit">Submit</a>;
        const upvotes = <a style={{ color: "black", cursor: "pointer" }} href={"/upvotes?address="+address}>Upvotes</a>;

        // {isConnected ? <span>{submit}{divider}</span> : ""}
        return (
          <div>
            {isConnected ? <span>{upvotes}{divider}</span> : ""}

            <a style={{color: "black", cursor: "pointer"}} onClick={show}>
              {isConnected ? <span style={{marginRight: "5px", display: "inline-block"}}><Avatar name={address} size={8} radius={0} /> </span> : ""}
              {isConnected ? shorten(address) : "Connect"}
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
