// @format
import { useState, useEffect } from "react";
import { useSigner, useAccount, WagmiConfig, useProvider } from "wagmi";
import { Wallet } from "@ethersproject/wallet";
import { RainbowKitProvider, ConnectButton } from "@rainbow-me/rainbowkit";
import { eligible } from "@attestate/delegator2";

import * as API from "./API.mjs";
import { client, chains } from "./client.mjs";
import NFTModal from "./NFTModal.jsx";
import theme from "./theme.mjs";
import { getLocalAccount } from "./session.mjs";

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
  const { toast } = props;
  const value = API.messageFab(props.title, props.href);

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
  const [allowlist, setAllowlist] = useState(null);
  const [delegations, setDelegations] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const list = await props.allowlistPromise;
      const delegates = await props.delegationsPromise;
      setAllowlist(list);
      setDelegations(delegates);
      setIsLoading(false);
    };

    loadData();
  });

  let signer, isError, isLocal;
  if (localAccount && localAccount.privateKey) {
    signer = new Wallet(localAccount.privateKey, provider);
    isLocal = true;
  } else {
    signer = result.data;
    isError = result.isError;
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
          <div>
            <div
              onClick={async (e) => {
                if (hasUpvoted || isLoading) return;

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

                handleSubmit(e);
              }}
              className={`votearrow ${isLoading ? "pulsate" : ""}`}
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
        );
      }}
    </ConnectButton.Custom>
  );
};

export default Container;
