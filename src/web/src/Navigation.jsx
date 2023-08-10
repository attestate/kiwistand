import { WagmiConfig, createClient, useAccount } from "wagmi";
import { RainbowKitProvider, ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useState } from "react";

import { client, chains } from "./client.mjs";
import Bell from "./Bell.jsx";

const shorten = (address) =>
  address.slice(0, 6) +
  "..." +
  address.slice(address.length - 4, address.length);

const LearnMore = () => {
  const { isConnected } = useAccount();
  const [display, setDisplay] = useState(false);

  useEffect(() => {
    setDisplay(!isConnected);
  }, [isConnected]);

  return display ? (
    <div style={{ textAlign: "center", paddingRight: "4px" }}>
      <a
        href="/welcome"
        style={{ textDecoration: "underline", color: "black" }}
      >
        Learn more <br />
        about 🥝
      </a>
    </div>
  ) : null;
};

const SettingsSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="none" />
    <circle
      cx="128"
      cy="128"
      r="40"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
    <path
      d="M130.05,206.11c-1.34,0-2.69,0-4,0L94,224a104.61,104.61,0,0,1-34.11-19.2l-.12-36c-.71-1.12-1.38-2.25-2-3.41L25.9,147.24a99.15,99.15,0,0,1,0-38.46l31.84-18.1c.65-1.15,1.32-2.29,2-3.41l.16-36A104.58,104.58,0,0,1,94,32l32,17.89c1.34,0,2.69,0,4,0L162,32a104.61,104.61,0,0,1,34.11,19.2l.12,36c.71,1.12,1.38,2.25,2,3.41l31.85,18.14a99.15,99.15,0,0,1,0,38.46l-31.84,18.1c-.65,1.15-1.32,2.29-2,3.41l-.16,36A104.58,104.58,0,0,1,162,224Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
  </svg>
);

const ProfileSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="none" />
    <circle
      cx="128"
      cy="120"
      r="40"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
    <rect
      x="40"
      y="40"
      width="176"
      height="176"
      rx="8"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
    <path
      d="M57.78,216a72,72,0,0,1,140.44,0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
  </svg>
);
const Settings = () => {
  const { address, isConnected } = useAccount();
  const [display, setDisplay] = useState(false);

  useEffect(() => {
    if (address && isConnected) {
      setDisplay(true);
    } else {
      setDisplay(false);
    }
  }, [address, isConnected]);

  return display ? (
    <a
      href="/settings"
      style={{ color: "black", textDecoration: "none", display: "block" }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div className="svg-container">
          <SettingsSVG />
        </div>
        <span>Settings</span>
      </div>
    </a>
  ) : null;
};

const Profile = () => {
  const { address, isConnected } = useAccount();
  const [display, setDisplay] = useState(false);

  useEffect(() => {
    if (address && isConnected) {
      setDisplay(true);
    } else {
      setDisplay(false);
    }
  }, [address, isConnected]);

  return display ? (
    <a
      href={"/upvotes?address=" + address}
      style={{ color: "black", textDecoration: "none", display: "block" }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div className="svg-container">
          <ProfileSVG />
        </div>
        <span>Profile</span>
      </div>
    </a>
  ) : null;
};

const DisconnectSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="none" />
    <line
      x1="144"
      y1="144"
      x2="120"
      y2="168"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
    <line x1="144" y1="144" x2="120" y2="168" fill="#231f20" />
    <line
      x1="112"
      y1="112"
      x2="88"
      y2="136"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
    <line x1="112" y1="112" x2="88" y2="136" fill="#231f20" />
    <line
      x1="64"
      y1="112"
      x2="144"
      y2="192"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
    <line
      x1="58.06"
      y1="197.94"
      x2="24"
      y2="232"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
    <path
      d="M132,180l-29,29a24,24,0,0,1-33.94,0L47,186.91A24,24,0,0,1,47,153l29-29"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
    <line
      x1="112"
      y1="64"
      x2="192"
      y2="144"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
    <line
      x1="197.94"
      y1="58.06"
      x2="232"
      y2="24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
    <path
      d="M180,132l29-29a24,24,0,0,0,0-33.94L186.91,47A24,24,0,0,0,153,47L124,76"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
  </svg>
);
const DisconnectButton = () => {
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openConnectModal, openAccountModal }) => {
        const connected = account && chain && mounted;
        if (connected) {
          return (
            <div onClick={openAccountModal} className="sidebar-div">
              <div style={{ display: "flex", alignItems: "center" }}>
                <div className="svg-container">
                  <DisconnectSVG />
                </div>
                <span>Disconnect</span>
              </div>
            </div>
          );
        } else {
          return null;
        }
      }}
    </ConnectButton.Custom>
  );
};

const CustomConnectButton = () => {
  const buttonStyle = {
    borderRadius: "2px",
    padding: "5px 15px 5px 15px",
    backgroundColor: "black",
    border: "1px solid black",
    color: "white",
    textAlign: "center",
    textDecoration: "none",
    cursor: "pointer",
    width: "100px",
  };

  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openConnectModal }) => {
        const connected = account && chain && mounted;
        if (connected) {
          return <Bell to="/activity"></Bell>;
        } else {
          return (
            <a style={buttonStyle} onClick={openConnectModal}>
              {connected ? (
                <span style={{ color: "#828282" }}>
                  <span
                    style={{
                      color: "black",
                      marginRight: "5px",
                      display: "inline-block",
                    }}
                  ></span>
                </span>
              ) : (
                ""
              )}

              {connected ? shorten(account) : "Connect"}
            </a>
          );
        }
      }}
    </ConnectButton.Custom>
  );
};

const Connector = ({ children }) => {
  return (
    <WagmiConfig client={client}>
      <RainbowKitProvider chains={chains}>{children}</RainbowKitProvider>
    </WagmiConfig>
  );
};

export const ConnectedProfile = () => (
  <Connector>
    <Profile />
  </Connector>
);
export const ConnectedDisconnectButton = () => (
  <Connector>
    <DisconnectButton />
  </Connector>
);
export const ConnectedConnectButton = () => (
  <Connector>
    <CustomConnectButton />
  </Connector>
);
export const ConnectedSettings = () => (
  <Connector>
    <Settings />
  </Connector>
);
export const ConnectedLearnMore = () => (
  <Connector>
    <LearnMore />
  </Connector>
);
