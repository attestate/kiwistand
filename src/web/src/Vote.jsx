// @format
import { useState } from "react";
import { useSigner, useAccount, WagmiConfig, useProvider } from "wagmi";
import { Wallet } from "@ethersproject/wallet";
import { RainbowKitProvider, ConnectButton } from "@rainbow-me/rainbowkit";
import { eligible } from "@attestate/delegator2";

import * as API from "./API.mjs";
import { client, chains } from "./client.mjs";
import { showMessage } from "./message.mjs";
import NFTModal from "./NFTModal.jsx";
import theme from "./theme.mjs";

const Container = (props) => {
  const [modalIsOpen, setIsOpen] = useState(false);

  return (
    <WagmiConfig client={client}>
      <RainbowKitProvider chains={chains}>
        <Vote {...props} setIsOpen={setIsOpen} />
        <NFTModal
          headline="Wait a minute!"
          text="To upvote, you need to own our NFT. 👇"
          closeText="OK, but let me browse a bit more..."
          modalIsOpen={modalIsOpen}
          setIsOpen={setIsOpen}
        />
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

const Vote = (props) => {
  const value = API.messageFab(props.title, props.href);
  const account = useAccount();
  const localKey = localStorage.getItem(`-kiwi-news-${account.address}-key`);
  const provider = useProvider();
  const result = useSigner();
  const [hasUpvoted, setHasUpvoted] = useState(
    props.upvoters.includes(account.address)
  );

  let signer, isError, isLocal;
  if (localKey) {
    signer = new Wallet(localKey, provider);
    isLocal = true;
  } else {
    signer = result.data;
    isError = result.isError;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setHasUpvoted(true);

    if (!isLocal) showMessage("Please sign the message in your wallet");
    const signature = await signer._signTypedData(
      API.EIP712_DOMAIN,
      API.EIP712_TYPES,
      value
    );
    const response = await API.send(value, signature);

    console.log(response);
    let message;
    if (response.status === "success") {
      message = "Thanks for your upvote! Have a 🥝";
    } else if (response.details.includes("You must mint")) {
      // NOTE: This should technically never happen, but if it does we pop open
      // the modal to buy the NFT.
      props.setIsOpen(true);
      setHasUpvoted(false);
      return;
    } else if (response.status === "error") {
      setHasUpvoted(false);
      showMessage(`Sad Kiwi :( "${response.details}"`);
      return;
    }
    let url = new URL(window.location.href);
    url.searchParams.set("bpc", "1");
    url.searchParams.set("message", message);
    window.location.href = url.href;
  };

  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openConnectModal }) => {
        const connected = account && chain && mounted;
        return (
          <div
            onClick={async (e) => {
              if (hasUpvoted) return;
              if (!connected) {
                openConnectModal();
                return;
              }

              const { allowlist, delegations } = props;
              const isEligible = eligible(
                allowlist,
                delegations,
                await signer.getAddress()
              );
              if (!isEligible) {
                props.setIsOpen(true);
                return;
              }
              handleSubmit(e);
            }}
            className="votearrow"
            style={{
              color: hasUpvoted ? theme.color : "#828282",
              cursor: hasUpvoted ? "not-allowed" : "pointer",
            }}
            title="upvote"
          >
            ▲
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};

export default Container;
