// @format
import { useState, useEffect } from "react";
import { useAccount, WagmiConfig } from "wagmi";
import { Wallet } from "@ethersproject/wallet";
import { RainbowKitProvider, ConnectButton } from "@rainbow-me/rainbowkit";
import { eligible } from "@attestate/delegator2";

import * as API from "./API.mjs";
import { useSigner, useProvider, client, chains } from "./client.mjs";
import NFTModal from "./NFTModal.jsx";
import theme from "./theme.mjs";
import { getLocalAccount } from "./session.mjs";

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

const Vote = (props) => {
  const { allowlist, delegations } = props;
  const { toast } = props;
  const value = API.messageFab(props.title, props.href);

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
    setHasUpvoted(true);

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
      toast.success("Thanks for your upvote! Have a 🥝");
      setUpvotes(upvotes + 1);
    } else if (response.details.includes("You must mint")) {
      // NOTE: This should technically never happen, but if it does we pop open
      // the modal to buy the NFT.
      props.setIsOpen(true);
      setHasUpvoted(false);
      return;
    } else if (response.status === "error") {
      setHasUpvoted(false);
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
            onClick={async (e) => {
              if (hasUpvoted || window.location.pathname === "/submit") return;

              const isEligible =
                signer &&
                eligible(allowlist, delegations, await signer.getAddress());

              if (!connected && !isEligible) {
                openConnectModal();
                return;
              }
              if (connected && !isEligible) {
                props.setIsOpen(true);
                return;
              }

              // NOTE: It can happen that the Feedbot will suggests to submit
              // articles that have a title length of > 80 chars, in this
              // case we want to redirect the user to the /submit page to
              // adjust the title.
              if (props.title.length > 80) {
                const url = new URL(window.location);
                url.pathname = "/submit";
                url.searchParams.set("url", props.href);
                window.location.href = url.href;
                return;
              }

              handleSubmit(e);
            }}
            className="interaction-element"
            style={{
              borderRadius: "2px",
              padding: "5px 0",
              backgroundColor: "rgba(0,0,0,0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "40px",
              margin: "5px 6px",
              alignSelf: "stretch",
              cursor: hasUpvoted ? "not-allowed" : "pointer",
            }}
          >
            <div style={{ minHeight: "40px", display: "block" }}>
              <div
                className={`votearrow`}
                style={{
                  color: hasUpvoted ? theme.color : "#828282",
                  cursor: hasUpvoted ? "not-allowed" : "pointer",
                }}
                title="upvote"
              >
                ▲
              </div>
              {props.editorPicks !== "true" ? (
                <div
                  style={{
                    fontSize: "8pt",
                    textAlign: "center",
                  }}
                >
                  {upvotes}
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
