// @format
import { WagmiConfig, createClient } from "wagmi";
import { Avatar, ConnectKitProvider, ConnectKitButton, getDefaultClient } from "connectkit";

import client from "./client.mjs";

const shorten = address => address.slice(0,6)+"..."+address.slice(address.length-4, address.length);

export const Navigation = () => {
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, show, hide, address }) => {
        if (isConnected && window.innerWidth <= 600) {
          document.querySelector("#footer").style.display = "flex";
        } else {
          document.querySelector("#footer").style.display = "none";
        }

        const divider = <span> | </span>;
        const submit = <span className="hide-on-mobile"><a style={{ color: "black", cursor: "pointer" }} href={"/submit"}>Submit</a></span>;
        const upvotes = <span className="hide-on-mobile">{divider}<a style={{ color: "black", cursor: "pointer" }} href={"/upvotes?address="+address}>Profile</a></span>;
        const notifications = <span className="hide-on-mobile">{divider}<a className="hide-on-mobile" style={{ color: "black", cursor: "pointer" }} href={"/activity?address="+address}>Activity</a></span>;

        return (
          <span>
            {isConnected ? <span>{submit}{upvotes}{notifications}</span> : ""}

            {isConnected ? <span className="hide-on-mobile">{divider}</span>: ""}
            <a style={{color: "black", cursor: "pointer"}} onClick={show}>
              {isConnected ? <span style={{marginRight: "5px", display: "inline-block"}}><Avatar name={address} size={8} radius={0} /> </span> : ""}
              {isConnected ? shorten(address) : "Connect" }
            </a>
          </span>
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
