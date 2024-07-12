import { WagmiConfig, useAccount } from "wagmi";
import { RainbowKitProvider, ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useState } from "react";
import { eligible } from "@attestate/delegator2";

import { RestoreDialogue } from "./Passkeys.jsx";
import { client, chains } from "./client.mjs";
import { EthereumSVG } from "./icons.jsx";
import {
  getLocalAccount,
  isSafariOnIOS,
  isChromeOnAndroid,
  isRunningPWA,
} from "./session.mjs";

const shorten = (address) =>
  address.slice(0, 6) +
  "..." +
  address.slice(address.length - 4, address.length);

const SettingsSVGFull = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="none" />
    <path d="M216,130.16q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.6,107.6,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.29,107.29,0,0,0-26.25-10.86,8,8,0,0,0-7.06,1.48L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.6,107.6,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z" />
  </svg>
);

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

const ProfileSVGFull = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="none" />
    <path d="M172,120a44,44,0,1,1-44-44A44,44,0,0,1,172,120Zm52-72V208a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V48A16,16,0,0,1,48,32H208A16,16,0,0,1,224,48ZM208,208V48H48V208h3.67a80.58,80.58,0,0,1,26.07-38.25q3.08-2.48,6.36-4.62a4,4,0,0,1,4.81.33,59.82,59.82,0,0,0,78.18,0,4,4,0,0,1,4.81-.33q3.28,2.15,6.36,4.62A80.58,80.58,0,0,1,204.33,208H208Z" />
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
const Settings = (props) => {
  let address;
  const account = useAccount();
  const localAccount = getLocalAccount(account.address, props.allowlist);
  if (account.isConnected) {
    address = account.address;
  }
  if (localAccount) {
    address = localAccount.identity;
  }
  const isEligible =
    address && eligible(props.allowlist, props.delegations, address);

  return (
    <a
      title="Settings"
      href="/settings"
      onClick={(e) => !isEligible && e.preventDefault()}
      style={{
        pointerEvents: isEligible ? "auto" : "none",
        color: isEligible ? "black" : "grey",
        textDecoration: "none",
        display: "block",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div className="svg-container" style={{ position: "relative" }}>
          {window.location.pathname === "/settings" ? (
            <SettingsSVGFull />
          ) : (
            <>
              <SettingsSVG />
            </>
          )}
        </div>
        <span>Settings</span>
      </div>
    </a>
  );
};

const Profile = (props) => {
  let address;
  const account = useAccount();
  const localAccount = getLocalAccount(account.address, props.allowlist);
  if (account.isConnected) {
    address = account.address;
  }
  if (localAccount) {
    address = localAccount.identity;
  }
  const isEligible =
    address && eligible(props.allowlist, props.delegations, address);

  const isEnabled = isEligible || account.isConnected;
  return (
    <a
      title="Profile"
      href={isEnabled ? "/upvotes?address=" + address : ""}
      style={{
        pointerEvents: isEnabled ? "auto" : "none",
        color: isEnabled ? "black" : "grey",
        textDecoration: "none",
        display: "block",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div className="svg-container">
          {window.location.pathname.includes("/upvotes") ||
          window.location.href.endsWith(".eth") ? (
            <ProfileSVGFull />
          ) : (
            <ProfileSVG />
          )}
        </div>
        <span>Profile</span>
      </div>
    </a>
  );
};

const SubmitSVGFull = (props) => (
  <svg
    style={props.style}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <path d="M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM51.31,160l90.35-90.35,16.68,16.69L68,176.68ZM48,179.31,76.69,208H48Zm48,25.38L79.31,188l90.35-90.35h0l16.68,16.69Z" />
  </svg>
);

const SubmitSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="none" />
    <path
      d="M92.69,216H48a8,8,0,0,1-8-8V163.31a8,8,0,0,1,2.34-5.65L165.66,34.34a8,8,0,0,1,11.31,0L221.66,79a8,8,0,0,1,0,11.31L98.34,213.66A8,8,0,0,1,92.69,216Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
    <line
      x1="136"
      y1="64"
      x2="192"
      y2="120"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
    <line
      x1="164"
      y1="92"
      x2="68"
      y2="188"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
    <line
      x1="95.49"
      y1="215.49"
      x2="40.51"
      y2="160.51"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
  </svg>
);

const Submit = (props) => {
  let address;
  const account = useAccount();
  const localAccount = getLocalAccount(account.address, props.allowlist);
  if (account.isConnected) {
    address = account.address;
  }
  if (localAccount) {
    address = localAccount.identity;
  }
  const isEligible =
    address && eligible(props.allowlist, props.delegations, address);

  const isEnabled = isEligible || account.isConnected;
  return (
    <a
      title="Submit"
      href={isEnabled ? "/submit" : ""}
      style={{
        pointerEvents: isEnabled ? "auto" : "none",
        color: isEnabled ? "black" : "grey",
        textDecoration: "none",
        display: "block",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div className="svg-container">
          {window.location.pathname.includes("/submit") ? (
            <SubmitSVGFull style={{ fill: isEnabled ? "black" : "grey" }} />
          ) : (
            <SubmitSVG />
          )}
        </div>
        <span>Submit</span>
      </div>
    </a>
  );
};

const SimpleDisconnectButton = (props) => {
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openAccountModal }) => {
        const connected = account && chain && mounted;
        return (
          <span
            style={{ visibility: connected ? "visible" : "hidden" }}
            onClick={openAccountModal}
          >
            Disconnect
          </span>
        );
      }}
    </ConnectButton.Custom>
  );
};
const DisconnectButton = () => {
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openConnectModal, openAccountModal }) => {
        const connected = account && chain && mounted;
        return (
          <div
            title="Disconnect Wallet"
            onClick={connected && openAccountModal}
            style={{
              color: connected ? "black" : "grey",
              pointerEvents: connected ? "auto" : "none",
            }}
            className="sidebar-div"
          >
            <div
              style={{
                fontVariant: "small-caps",
                display: "flex",
                alignItems: "center",
              }}
            >
              <div className="svg-container">
                <EthereumSVG />
              </div>
              <span>Disconnect</span>
            </div>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};

export const PrimaryActionButton = (props) => {
  return (
    <a
      style={{
        ...props.style,
        ...{
          display: "flex",
          gap: "5px",
          alignItems: "center",
          width: "auto",
          justifyContent: "center",
        },
      }}
      className={props.className}
      href={props.href}
      title={props.text}
      id="button-onboarding"
      onClick={props.onClick}
    >
      {props.icon ? props.icon : ""} {props.text}
    </a>
  );
};

export const CustomConnectButton = (props) => {
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openConnectModal }) => {
        if (!mounted) return;
        const connected = account && chain;
        const localAccount = getLocalAccount(
          account && account.address,
          props.allowlist,
        );

        let address;
        if (connected) {
          address = account.address;
        }
        if (localAccount) {
          address = localAccount.identity;
        }
        const isEligible =
          address && eligible(props.allowlist, props.delegations, address);

        if ((props.required && !connected) || (!connected && !isEligible)) {
          return (
            <PrimaryActionButton
              className={props.className}
              style={props.style}
              icon={<EthereumSVG style={{ width: "16px" }} />}
              text="Connect"
              onClick={openConnectModal}
            />
          );
        }
      }}
    </ConnectButton.Custom>
  );
};

export const Connector = (props) => {
  return (
    <WagmiConfig config={client}>
      <RainbowKitProvider
        appInfo={{
          disclaimer: RestoreDialogue(
            props.allowlist,
            props.delegations,
            props.toast,
          ),
        }}
        chains={chains}
      >
        {props.children}
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export const ConnectedSubmit = (props) => (
  <Connector {...props}>
    <Submit {...props} />
  </Connector>
);
export const ConnectedProfile = (props) => (
  <Connector {...props}>
    <Profile {...props} />
  </Connector>
);
export const ConnectedDisconnectButton = (props) => (
  <Connector {...props}>
    <DisconnectButton {...props} />
  </Connector>
);
export const ConnectedSimpleDisconnectButton = (props) => (
  <Connector {...props}>
    <SimpleDisconnectButton {...props} />
  </Connector>
);
export const ConnectedConnectButton = (props) => (
  <Connector {...props}>
    <CustomConnectButton {...props} />
  </Connector>
);
export const ConnectedSettings = (props) => (
  <Connector {...props}>
    <Settings {...props} />
  </Connector>
);
