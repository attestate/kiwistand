// @format
import React, { useState, useEffect, useRef } from "react";

import posthog from "posthog-js";
import { useAccount, WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Wallet } from "@ethersproject/wallet";
import { RainbowKitProvider, ConnectButton } from "@rainbow-me/rainbowkit";
import { resolveIdentity } from "@attestate/delegator2";
import DOMPurify from "isomorphic-dompurify";
import { sdk } from "@farcaster/frame-sdk";

import * as API from "./API.mjs";
import {
  useSigner,
  useProvider,
  client,
  chains,
  useIsMiniApp,
} from "./client.mjs";
import theme from "./theme.jsx";
import { getLocalAccount, isIOSApp } from "./session.mjs";
import {
  openDelegationModalForAction,
  isDelegationModalNeeded,
} from "./delegationModalManager.js";

export const iconSVG = (
  <svg
    style={{ width: "20px", height: "20px" }}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <path
      d="M128,224S24,168,24,102A54,54,0,0,1,78,48c22.59,0,41.94,12.31,50,32,8.06-19.69,27.41-32,50-32a54,54,0,0,1,54,54C232,168,128,224,128,224Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
    />
  </svg>
);

const iconFullSVG = (
  <svg
    style={{ width: "20px", height: "20px" }}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <path
      d="M240,102c0,70-103.79,126.66-108.21,129a8,8,0,0,1-7.58,0C119.79,228.66,16,172,16,102A62.07,62.07,0,0,1,78,40c20.65,0,38.73,8.88,50,23.89C139.27,48.88,157.35,40,178,40A62.07,62.07,0,0,1,240,102Z"
      fill="currentColor"
    />
  </svg>
);

const queryClient = new QueryClient();

const Container = (props) => {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={client}>
        <RainbowKitProvider chains={chains}>
          <Vote {...props} />
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
};

const KarmaAnimation = ({ active }) => {
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    if (active) {
      setAnimationKey((prev) => prev + 1);
    }
  }, [active]);

  if (!active) return null;

  return (
    <div
      key={animationKey}
      className="karma-animation"
      style={{ color: theme.color, whiteSpace: "nowrap" }}
    >
      +1 🥝
    </div>
  );
};

const Vote = (props) => {
  // Read current feed variant from meta tag (if present)
  const getVariant = () => {
    try {
      const el = document.querySelector('meta[name="kiwi-variant"]');
      return el?.content || "unknown";
    } catch (_) {
      return "unknown";
    }
  };

  const { isMiniApp, loading } = useIsMiniApp();
  const [isFarcasterClient, setIsFarcasterClient] = useState(false);

  useEffect(() => {
    const determineFarcasterClient = async () => {
      if (loading) return; // Wait for the hook to finish

      if (isMiniApp) {
        setIsFarcasterClient(true);
        return;
      }

      // Fallback check for Coinbase Wallet client
      try {
        if (window.sdk && window.sdk.context) {
          const context = await window.sdk.context;
          if (
            context &&
            context.client &&
            context.client.clientFid === 309857
          ) {
            setIsFarcasterClient(true);
            return;
          }
        }
      } catch (err) {
        console.log("Coinbase Wallet client check failed:", err);
      }

      setIsFarcasterClient(false);
    };

    determineFarcasterClient();
  }, [isMiniApp, loading]);

  const { delegations, toast, isad } = props;
  const value = API.messageFab(props.title, props.href);
  const [showKarmaAnimation, setShowKarmaAnimation] = useState(false);
  const animationContainerRef = useRef(null);

  let address;
  const account = useAccount();
  const localAccount = getLocalAccount(account.address);
  if (account.isConnected) {
    address = account.address;
  }
  if (localAccount) {
    address = localAccount.identity;
  }

  const provider = useProvider();
  const result = useSigner();
  const [hasUpvoted, setHasUpvoted] = useState(
    props.upvoters.includes(address),
  );
  const [upvotes, setUpvotes] = useState(props.upvoters.length);

  let signer, isLocal;
  if (localAccount && localAccount.privateKey) {
    signer = new Wallet(localAccount.privateKey, provider);
    isLocal = true;
  } else {
    signer = result;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check wallet connection for both mini app and traditional users
    if (!isFarcasterClient && !signer) {
      toast.error("Please connect your wallet to like");
      return;
    }

    // Check if delegation is needed for non-mini app users
    if (
      !isMiniApp &&
      account?.address &&
      isDelegationModalNeeded(account.address)
    ) {
      openDelegationModalForAction();
      return;
    }

    // Set upvoted state immediately for better UX
    setHasUpvoted(true);

    // Show animation immediately when button is clicked
    setShowKarmaAnimation(true);
    // Reset animation after it completes
    setTimeout(() => setShowKarmaAnimation(false), 700);

    let response;

    if (isMiniApp) {
      // Mini app upvote flow - REQUIRES JWT authentication
      try {
        const context = await window.sdk.context;
        const fid = context.user.fid;

        if (!fid) {
          throw new Error("No FID available in context");
        }

        // Get Quick Auth JWT token - REQUIRED
        let authToken = null;

        if (window.sdk && window.sdk.quickAuth) {
          try {
            const tokenResponse = await window.sdk.quickAuth.getToken();
            authToken =
              typeof tokenResponse === "string"
                ? tokenResponse
                : tokenResponse.token;
          } catch (tokenError) {
            console.error("Failed to get Quick Auth token:", tokenError);
            throw new Error(
              "Authentication failed. Please try again or update your Farcaster app.",
            );
          }
        } else {
          throw new Error(
            "Quick Auth not available. Please update your Farcaster app to continue.",
          );
        }

        // Get the user's connected wallet address from Wagmi (the proper way)
        let walletAddress = null;

        // For mini apps, use the current account's address from useAccount hook
        if (account.isConnected && account.address) {
          walletAddress = account.address;
        } else {
          // Fallback: try to get from Ethereum provider
          try {
            const provider = await window.sdk.wallet.getEthereumProvider();
            const accounts = await provider.request({
              method: "eth_requestAccounts",
            });
            if (accounts && accounts.length > 0) {
              walletAddress = accounts[0];
            }
          } catch (providerError) {
            // Silently fail and try next method
          }
        }

        if (!walletAddress) {
          throw new Error("No connected wallet found in Farcaster mini app");
        }

        toast("Submitting your upvote...");

        response = await API.sendMiniAppUpvote(
          value,
          fid,
          walletAddress,
          authToken,
        );
      } catch (err) {
        console.error("Mini app upvote error:", err);
        setHasUpvoted(false);
        setShowKarmaAnimation(false);
        toast.error(err.message || "Unable to complete upvote");
        return;
      }
    } else {
      // Traditional wallet signature flow
      if (!isLocal) toast("Please sign the message in your wallet");
      const signature = await signer._signTypedData(
        API.EIP712_DOMAIN,
        API.EIP712_TYPES,
        value,
      );
      response = await API.send(value, signature);
    }

    console.log(response);
    let message;
    if (response.status === "success") {
      // Update UI state
      setUpvotes(upvotes + 1);
      toast.success("Thanks for your like! Have a 🥝");
      const isAnonMode = localStorage.getItem('anon-mode') === 'true';
      if (!isAnonMode) {
        posthog.capture("upvote", { variant: getVariant() });
      }
    } else if (response.status === "error") {
      if (
        response.details.includes(
          "doesn't pass legitimacy criteria (duplicate)",
        ) ||
        response.details.includes("probably submitted and accepted before")
      ) {
        // This is a duplicate vote - keep upvoted state true
        toast.success(
          "Your vote was already recorded! The feed may need to refresh to show it. 🥝",
        );
      } else {
        setHasUpvoted(false);
        setShowKarmaAnimation(false); // Hide animation on error
        toast.error(`Sad Kiwi :( "${response.details}"`);
      }
      return;
    }
  };

  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openConnectModal }) => {
        const connected = account && chain && mounted;
        return (
          <button
            ref={animationContainerRef}
            onClick={async (e) => {
              if (hasUpvoted || isad || window.location.pathname === "/submit")
                return;

              let isEligible = false;
              if (isFarcasterClient) {
                // For mini apps, check if we have FID context
                try {
                  const context = await window.sdk.context;
                  isEligible = !!context.user.fid;
                } catch (err) {
                  console.error("Failed to get mini app context:", err);
                  isEligible = false;
                }
              } else {
                // Traditional eligibility check for wallet users
                isEligible =
                  signer &&
                  resolveIdentity(delegations, await signer.getAddress());
              }

              if (!isEligible && isIOSApp()) {
                toast.error("Login to upvote");
                return;
              }

              if (!isEligible) {
                if (isFarcasterClient) {
                  toast.error("Unable to access your Farcaster profile");
                } else {
                  toast.error("Connect your wallet to sign up");
                }
                return;
              }

              // NOTE: It can happen that the Feedbot will suggests to submit
              // articles that have a title length of > 80 chars, in this
              // case we want to redirect the user to the /submit page to
              // adjust the title.
              if (props.title.length > 80) {
                const url = new URL(window.location);
                url.pathname = "/submit";
                url.searchParams.set("url", DOMPurify.sanitize(props.href));
                window.location.href = url.href;
                return;
              }

              // Add haptic feedback for vote action only in frames
              if (isFarcasterClient) {
                try {
                  await sdk.haptics.impactOccurred("medium");
                } catch (error) {
                  // Silently fail if haptics not supported
                }
              }

              handleSubmit(e);
            }}
            className={`interaction-button like-button ${
              hasUpvoted ? "" : "interaction-element"
            }`}
            style={{
              minWidth: "60px",
              padding: "8px 12px",
              border: "none",
              background: "transparent",
              borderRadius: "999px",
              cursor: hasUpvoted ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              transition: "all 0.15s ease",
              position: "relative", // For positioning the animation
            }}
            onMouseOver={(e) =>
              !hasUpvoted &&
              (e.currentTarget.style.backgroundColor =
                "var(--bg-hover-minimal)")
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            <KarmaAnimation active={showKarmaAnimation} />
            <span
              className="heart-icon"
              style={{
                width: "20px",
                height: "20px",
                color: hasUpvoted ? "var(--color-voted)" : "var(--color-vote-default)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {hasUpvoted ? iconFullSVG : iconSVG}
            </span>
            <span
              style={{
                fontSize: "13px",
                color: "var(--color-vote-default)",
                fontWeight: "400",
              }}
            >
              {upvotes}
            </span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
};

export default Container;
