import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import React, { useEffect, useState } from "react";
import { resolveIdentity } from "@attestate/delegator2";

import { EthereumSVG } from "./icons.jsx";
import MS from "./ms.jsx";
import { autoConnectMiniAppWallet } from "./miniapp.mjs";
import { useMiniApp } from "./useMiniApp.js";
import {
  getLocalAccount,
  getCookie,
  hasSingleLocalStorageKey,
  hasStaleDelegationKeys,
  logout,
} from "./session.mjs";

const Profile = (props) => {
  let address;
  const account = useAccount();
  const localAccount = getLocalAccount(account.address);
  if (account.isConnected) {
    address = account.address;
  }
  if (localAccount) {
    address = localAccount.identity;
  }
  const isEligible =
    address && resolveIdentity(props.delegations, address);

  const isEnabled = isEligible || account.isConnected;
  if (!isEnabled) return null;
  const active =
    window.location.pathname.includes("/upvotes") ||
    window.location.href.endsWith(".eth");
  return (
    <a
      title="Profile"
      href={"/upvotes?address=" + address}
      className={`kn-menu-item${active ? " kn-menu-item-active" : ""}`}
    >
      <MS name="user-square" size={22} />
      <span>Profile</span>
    </a>
  );
};

export const SimpleDisconnectButton = (props) => {
  let label = "Disconnect";
  if (props.label) {
    label = props.label;
  }
  const [stable, setStable] = useState("loading");
  const isAnonMode = localStorage.getItem('anon-mode') === 'true';

  // If in anon mode, show logout button
  if (isAnonMode) {
    return (
      <span
        className="meta-link"
        style={{
          userSelect: "none",
          cursor: "pointer",
        }}
        onClick={logout}
      >
        Log out
      </span>
    );
  }

  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openAccountModal }) => {
        useEffect(() => {
          const timer = setTimeout(() => {
            setStable(mounted && account && chain);
          }, 300);
          return () => clearTimeout(timer);
        }, [mounted, account, chain]);

        // If not connected to wallet but has local key, show logout
        if (!account && hasSingleLocalStorageKey()) {
          return (
            <span
              className="meta-link"
              style={{
                userSelect: "none",
                cursor: "pointer",
              }}
              onClick={logout}
            >
              Log out
            </span>
          );
        }

        return (
          <span
            className="meta-link"
            style={{
              userSelect: "none",
              transition: "opacity 0.3s ease-out",
              opacity: stable === "loading" || stable ? "1" : "0",
              pointerEvents: stable ? "auto" : "none",
              cursor: stable ? "pointer" : "default",
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
  const staleAuth = hasStaleDelegationKeys();

  const isAnonMode = localStorage.getItem('anon-mode') === 'true';

  // If in anon mode, show logout button
  if (isAnonMode) {
    return (
      <button
              type="button"
              title="Log out"
              onClick={logout}
              className="kn-menu-item kn-menu-logout"
            >
              <MS name="sign-out" size={22} />
              <span>Log out</span>
            </button>
    );
  }

  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openConnectModal, openAccountModal }) => {
        const connected = account && chain && mounted;

        // If not connected to wallet but has local key, show logout
        if (!connected && hasSingleLocalStorageKey()) {
          return (
            <button
              type="button"
              title="Log out"
              onClick={logout}
              className="kn-menu-item kn-menu-logout"
            >
              <MS name="sign-out" size={22} />
              <span>Log out</span>
            </button>
          );
        }

        if (!connected && staleAuth) {
          return (
            <button
              type="button"
              title="Log out"
              onClick={logout}
              className="kn-menu-item kn-menu-logout"
            >
              <MS name="sign-out" size={22} />
              <span>Log out</span>
            </button>
          );
        }
        if (!connected) return null;
        return (
          <button
            type="button"
            title="Disconnect Wallet"
            onClick={openAccountModal}
            className="kn-menu-item kn-menu-logout"
          >
            <MS name="sign-out" size={22} />
            <span>Disconnect</span>
          </button>
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
  const miniApp = useMiniApp();
  // NOTE: In the Farcaster mini app the Farcaster wallet connects by itself
  // (miniapp.mjs); the wallet picker doesn't work there.
  if (miniApp.isMiniApp) {
    if (miniApp.wallet !== "unavailable") return null;
    return (
      <PrimaryActionButton
        className={props.className}
        style={props.style}
        icon={<EthereumSVG style={{ width: "16px" }} />}
        text="Connect Farcaster wallet"
        onClick={(e) => {
          e.preventDefault();
          autoConnectMiniAppWallet({ retry: true });
        }}
      />
    );
  }
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openConnectModal }) => {
        if (!mounted) return;
        const connected = account && chain;
        // NOTE: We are checking the cookie before calling getLocalAccount
        // because if the cookie expired, then the user will have been taken to
        // the paywall and this means we'll have to reload the page.
        const localAccount = getLocalAccount(
          account && account.address
        );

        let address;
        if (connected) {
          address = account.address;
        }
        if (localAccount) {
          address = localAccount.identity;
        }
        const isEligible =
          address && resolveIdentity(props.delegations, address);

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
              onClick={openConnectModal}
            />
          );
        }
      }}
    </ConnectButton.Custom>
  );
};

// Connector component removed - components should use providers from parent

export const ConnectedProfile = Profile;
export const ConnectedDisconnectButton = DisconnectButton;
export const ConnectedSimpleDisconnectButton = SimpleDisconnectButton;
export const ConnectedConnectButton = CustomConnectButton;
