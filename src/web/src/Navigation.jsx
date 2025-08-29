import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useState } from "react";
import { ConnectModal } from "./ConnectModal.jsx";
import { eligible } from "@attestate/delegator2";

import { EthereumSVG } from "./icons.jsx";
import {
  getLocalAccount,
  getCookie,
  isSafariOnIOS,
  isChromeOnAndroid,
  isRunningPWA,
} from "./session.mjs";

const shorten = (address) =>
  address.slice(0, 6) +
  "..." +
  address.slice(address.length - 4, address.length);

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
  if (!isEnabled) return null;
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

export const SimpleDisconnectButton = (props) => {
  let label = "Disconnect";
  if (props.label) {
    label = props.label;
  }
  const [stable, setStable] = useState("loading");
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openAccountModal }) => {
        useEffect(() => {
          const timer = setTimeout(() => {
            setStable(mounted && account && chain);
          }, 300);
          return () => clearTimeout(timer);
        }, [mounted, account, chain]);
        return (
          <span
            className="meta-link"
            style={{
              userSelect: "none",
              transition: "opacity 0.3s ease-out",
              opacity: stable === "loading" || stable ? "1" : "0.2",
              pointerEvents: stable ? "auto" : "none",
            }}
            onClick={openAccountModal}
          >
            {label}
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
        if (!connected) return null;
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

export const TextConnectButton = ({
  allowlist,
  delegations,
  required,
  style,
  className,
  text = "Connect",
}) => {
  const [modalIsOpen, setModalIsOpen] = useState(false);
  
  return (
    <>
      <ConnectButton.Custom>
        {({ account, chain, mounted }) => {
          if (!mounted) return;
          const connected = account && chain;
          // NOTE: We are checking the cookie before calling getLocalAccount
          // because if the cookie expired, then the user will have been taken to
          // the paywall and this means we'll have to reload the page.
          const localAccount = getLocalAccount(
            account && account.address,
            allowlist,
          );

          let address;
          if (connected) {
            address = account.address;
          }
          if (localAccount) {
            address = localAccount.identity;
          }
          const isEligible = address && eligible(allowlist, delegations, address);

          const newIdentityCookie = getCookie("identity");
          if (isEligible && newIdentityCookie && !window.initialIdentityCookie) {
            console.log(
              "Reloading because initial identity cookie was undefined but eligibly was recognized",
            );
            window.location.pathname = "/";
          }

          // Modal will handle showing UI for non-eligible users

          if ((required && !connected) || (!connected && !isEligible)) {
            return (
              <span
                style={{ color: "black", ...style }}
                onClick={() => setModalIsOpen(true)}
                className={`meta-link ${className}`}
              >
                {text}
              </span>
            );
          }
        }}
      </ConnectButton.Custom>
      <ConnectModal 
        isOpen={modalIsOpen} 
        onClose={() => setModalIsOpen(false)} 
      />
    </>
  );
};

export const CustomConnectButton = (props) => {
  const [modalIsOpen, setModalIsOpen] = useState(false);
  
  return (
    <>
      <ConnectButton.Custom>
        {({ account, chain, mounted }) => {
          if (!mounted) return;
          const connected = account && chain;
          // NOTE: We are checking the cookie before calling getLocalAccount
          // because if the cookie expired, then the user will have been taken to
          // the paywall and this means we'll have to reload the page.
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

          const newIdentityCookie = getCookie("identity");
          if (isEligible && newIdentityCookie && !window.initialIdentityCookie) {
            console.log(
              "Reloading because initial identity cookie was undefined but eligibly was recognized",
            );
            window.location.pathname = "/";
          }

          if ((props.required && !connected) || (!connected && !isEligible)) {
            return (
              <PrimaryActionButton
                className={props.className}
                style={props.style}
                icon={<EthereumSVG style={{ width: "16px" }} />}
                text="Connect"
                onClick={() => setModalIsOpen(true)}
              />
            );
          }
        }}
      </ConnectButton.Custom>
      <ConnectModal 
        isOpen={modalIsOpen} 
        onClose={() => setModalIsOpen(false)} 
      />
    </>
  );
};

// Connector component removed - components should use providers from parent

export const ConnectedProfile = Profile;
export const ConnectedDisconnectButton = DisconnectButton;
export const ConnectedSimpleDisconnectButton = SimpleDisconnectButton;
export const ConnectedConnectButton = CustomConnectButton;
export const ConnectedTextConnectButton = TextConnectButton;
