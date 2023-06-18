import { WagmiConfig, createClient, useAccount } from "wagmi";
import { Avatar, ConnectKitProvider, ConnectKitButton } from "connectkit";
import client from "./client.mjs";
import { useEffect, useState } from 'react';

const shorten = address => address.slice(0,6)+"..."+address.slice(address.length-4, address.length);

const Profile = () => {
  const { address, isConnected } = useAccount();
  const [display, setDisplay] = useState(false);
  
  useEffect(() => {
    if (address && isConnected) {
      document.querySelector("#profile-container").style.display = "";
      setDisplay(true);
    } else {
      document.querySelector("#profile-container").style.display = "none";
      setDisplay(false);
    }
  }, [address]);

  return display ? (
    <span>
      <a style={{ color: "black", cursor: "pointer" }} href={"/upvotes?address="+address}>Profile</a>
    </span>
  ) : null;
};

const Activity = () => {
  const { address, isConnected } = useAccount();
  const [display, setDisplay] = useState(false);

  useEffect(() => {
    if (address && isConnected) {
      document.querySelector("#activity-container").style.display = "";
      setDisplay(true);
    } else {
      document.querySelector("#activity-container").style.display = "none";
      setDisplay(false);
    }
  }, [address]);

  return display ? (
    <span className="hide-on-mobile">
      <a style={{ color: "black", cursor: "pointer" }} href={"/activity?address="+address}>Notifications</a>
    </span>
  ) : null;
};

const ConnectButton = () => {
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, show, address }) => {
        if (isConnected && window.innerWidth <= 600) {
          document.querySelector("#footer").style.display = "flex";
        } else {
          document.querySelector("#footer").style.display = "none";
        }

        return (
          <a style={{color: "black", cursor: "pointer"}} onClick={show}>
            {isConnected ? <span style={{color: "#828282"}}> <span style={{color: "black", marginRight: "5px", display: "inline-block"}}><Avatar name={address} size={8} radius={0} /> </span></span> : ""}
            {isConnected ? shorten(address) : "Connect" }
          </a>
        );
      }}
    </ConnectKitButton.Custom>
  );
};

const Connector = ({children}) => {
  return (
    <WagmiConfig client={client}>
      <ConnectKitProvider>
        {children}
      </ConnectKitProvider>
    </WagmiConfig>
  );
};

export const ConnectedProfile = () => <Connector><Profile /></Connector>;
export const ConnectedActivity = () => <Connector><Activity /></Connector>;
export const ConnectedConnectButton = () => <Connector><ConnectButton /></Connector>;

