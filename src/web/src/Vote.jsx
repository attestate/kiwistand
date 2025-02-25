// @format
import { useState, useEffect, useRef } from "react";

import posthog from 'posthog-js';
import { useAccount, WagmiConfig } from "wagmi";
import { Wallet } from "@ethersproject/wallet";
import { RainbowKitProvider, ConnectButton } from "@rainbow-me/rainbowkit";
import { eligible } from "@attestate/delegator2";
import DOMPurify from "isomorphic-dompurify";

import * as API from "./API.mjs";
import { useSigner, useProvider, client, chains } from "./client.mjs";
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
      setAnimationKey(prev => prev + 1);
    }
  }, [active]);

  if (!active) return null;
  
  return (
    <div 
      key={animationKey}
      className="karma-animation"
      style={{ color: theme.color }}
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
    
    // Set upvoted state immediately for better UX
    setHasUpvoted(true);
    
    // Show animation immediately when button is clicked
    setShowKarmaAnimation(true);
    // Reset animation after it completes
    setTimeout(() => setShowKarmaAnimation(false), 700);

    if (!isLocal) toast("Please sign the message in your wallet");
    const signature = await signer._signTypedData(
      API.EIP712_DOMAIN,
      API.EIP712_TYPES,
      value,
    );
    const response = await API.send(value, signature);

    console.log(response);
    let message;
    if (response.status === "success") {
      // Update UI state
      setUpvotes(upvotes + 1);
      toast.success("Thanks for your upvote!");
      posthog.capture("upvote");
    } else if (response.details.includes("You must mint")) {
      // NOTE: This should technically never happen, but if it does we pop open
      // the modal to buy the NFT.
      props.setIsOpen(true);
      setHasUpvoted(false);
      setShowKarmaAnimation(false); // Hide animation on error
      return;
    } else if (response.status === "error") {
      setHasUpvoted(false);
      setShowKarmaAnimation(false); // Hide animation on error
      toast.error(`Sad Kiwi :( "${response.details}"`);
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

              const isEligible =
                signer &&
                eligible(allowlist, delegations, await signer.getAddress());

              if (!isEligible && isIOSApp()) {
                toast.error("Login to upvote");
                return;
              }

              if (!isEligible) {
                window.location.pathname = "/gateway";
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
              {props.editorPicks !== "true" ? (
                <div
                  style={{
                    userSelect: "none",
                    fontSize: "8pt",
                    fontWeight: "bold",
                    textAlign: "center",
                  }}
                >
                  {isad ? "..." : upvotes}
                </div>
              ) : null}
            </div>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};

export default Container;
