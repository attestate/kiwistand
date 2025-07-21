// @format
import { useState, useEffect, useRef } from "react";

import posthog from "posthog-js";
import { useAccount, WagmiConfig } from "wagmi";
import { Wallet } from "@ethersproject/wallet";
import { RainbowKitProvider, ConnectButton } from "@rainbow-me/rainbowkit";
import { eligible } from "@attestate/delegator2";
import DOMPurify from "isomorphic-dompurify";
import { sdk } from "@farcaster/frame-sdk";

import * as API from "./API.mjs";
import { useSigner, useProvider, client, chains, isInFarcasterFrame } from "./client.mjs";
import NFTModal from "./NFTModal.jsx";
import theme from "./theme.jsx";
import { getLocalAccount, isIOSApp } from "./session.mjs";

export const iconSVG = (
  <svg
    style={{ width: "35px" }}
    viewBox="0 0 200 200"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M99.84 52.0801L55.04 96.8001L68.44 110.04L90.36 88.0401L90.3747 148H109.8V88.0401L131.84 110.04L144.96 96.8001L100.24 52.0801H99.84Z" />
  </svg>
);

const iconFullSVG = (
  <svg
    style={{ width: "35px" }}
    viewBox="0 0 200 200"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M99.84 52.0801L55.04 96.8001L68.44 110.04L90.36 88.0401L90.3747 148H109.8V88.0401L131.84 110.04L144.96 96.8001L100.24 52.0801H99.84Z" />
  </svg>
);

const Container = (props) => {
  const [modalIsOpen, setIsOpen] = useState(false);

  return (
    <WagmiConfig config={client}>
      <RainbowKitProvider chains={chains}>
        <Vote {...props} setIsOpen={setIsOpen} />
        <NFTModal
          headline="Wait a minute!"
          text="You have to sign up before voting."
          closeText="Close"
          modalIsOpen={modalIsOpen}
          setIsOpen={setIsOpen}
        />
      </RainbowKitProvider>
    </WagmiConfig>
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
  const { allowlist, delegations, toast, isad } = props;
  const value = API.messageFab(props.title, props.href);
  const [showKarmaAnimation, setShowKarmaAnimation] = useState(false);
  const animationContainerRef = useRef(null);

  let address;
  const account = useAccount();
  const localAccount = getLocalAccount(account.address, allowlist);
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

    // Check if we're in a Farcaster mini app
    let isMiniApp = false;
    try {
      if (isInFarcasterFrame() && window.sdk) {
        isMiniApp = await window.sdk.isInMiniApp();
        
        // Also check for Coinbase Wallet's specific clientFid
        if (!isMiniApp && window.sdk.context) {
          const context = await window.sdk.context;
          if (context && context.client && context.client.clientFid === 309857) {
            isMiniApp = true;
            console.log("Detected Coinbase Wallet mini app via clientFid");
          }
        }
      }
    } catch (err) {
      console.log("Mini app detection failed:", err);
      isMiniApp = false;
    }

    // Check wallet connection for both mini app and traditional users
    if (!isMiniApp && !signer) {
      toast.error("Please connect your wallet to upvote");
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
      // Mini app upvote flow - use FID instead of signature
      try {
        const context = await window.sdk.context;
        const fid = context.user.fid;
        
        if (!fid) {
          throw new Error("No FID available in context");
        }
        
        // Get the user's connected wallet address from Wagmi (the proper way)
        let walletAddress = null;
        
        // For mini apps, use the current account's address from useAccount hook
        if (account.isConnected && account.address) {
          walletAddress = account.address;
          console.log("Found wallet via Wagmi useAccount:", walletAddress);
        } else {
          // Fallback: try to get from Ethereum provider
          try {
            const provider = await window.sdk.wallet.getEthereumProvider();
            const accounts = await provider.request({
              method: "eth_requestAccounts",
            });
            if (accounts && accounts.length > 0) {
              walletAddress = accounts[0];
              console.log("Found wallet via SDK Ethereum provider:", walletAddress);
            }
          } catch (providerError) {
            console.log("Failed to get wallet from SDK provider:", providerError);
          }
        }
        
        console.log("Account state:", { isConnected: account.isConnected, address: account.address });
        console.log("Final wallet address:", walletAddress);
        
        if (!walletAddress) {
          throw new Error("No connected wallet found in Farcaster mini app");
        }
        
        toast("Submitting your upvote...");
        
        response = await API.sendMiniAppUpvote(value, fid, walletAddress);
      } catch (err) {
        console.error("Mini app upvote error:", err);
        setHasUpvoted(false);
        setShowKarmaAnimation(false);
        toast.error("Unable to access Farcaster context");
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
      toast.success("Thanks for your like!");
      posthog.capture("upvote");
    } else if (response.details.includes("You must mint")) {
      // NOTE: This should technically never happen, but if it does we pop open
      // the modal to buy the NFT.
      props.setIsOpen(true);
      setHasUpvoted(false);
      setShowKarmaAnimation(false); // Hide animation on error
      return;
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
          <div
            ref={animationContainerRef}
            onClick={async (e) => {
              if (hasUpvoted || isad || window.location.pathname === "/submit")
                return;

              // Check if we're in a mini app - use conservative detection
              let isMiniApp = false;
              try {
                if (isInFarcasterFrame() && window.sdk) {
                  isMiniApp = await window.sdk.isInMiniApp();
                  
                  // Also check for Coinbase Wallet's specific clientFid
                  if (!isMiniApp && window.sdk.context) {
                    const context = await window.sdk.context;
                    if (context && context.client && context.client.clientFid === 309857) {
                      isMiniApp = true;
                      console.log("Detected Coinbase Wallet mini app via clientFid in eligibility check");
                    }
                  }
                }
              } catch (err) {
                console.log("Mini app detection failed in vote eligibility check:", err);
                isMiniApp = false;
              }
              
              let isEligible = false;
              
              if (isMiniApp) {
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
                  eligible(allowlist, delegations, await signer.getAddress());
              }

              if (!isEligible && isIOSApp()) {
                toast.error("Login to upvote");
                return;
              }

              if (!isEligible) {
                if (isMiniApp) {
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
              if (isInFarcasterFrame()) {
                try {
                  await sdk.haptics.impactOccurred('medium');
                } catch (error) {
                  // Silently fail if haptics not supported
                }
              }
              
              handleSubmit(e);
            }}
            className={hasUpvoted ? "" : "interaction-element"}
            style={{
              borderRadius: "2px",
              backgroundColor: "var(--bg-off-white)",
              border: "var(--border-thin)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "49px",
              margin: "5px 8px 5px 6px",
              alignSelf: "stretch",
              cursor: hasUpvoted ? "not-allowed" : "pointer",
              position: "relative", // For positioning the animation
            }}
          >
            <KarmaAnimation active={showKarmaAnimation} />
            <div style={{ minHeight: "42px", display: "block" }}>
              <div
                className={`votearrow`}
                style={{
                  fill: hasUpvoted ? theme.color : "#828282",
                  cursor: hasUpvoted ? "not-allowed" : "pointer",
                }}
                title="upvote"
              >
                {hasUpvoted ? iconFullSVG : iconSVG}
              </div>
            </div>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};

export default Container;
