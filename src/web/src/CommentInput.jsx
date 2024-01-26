import { useState, useEffect } from "react";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiConfig, useAccount, useSigner, useProvider } from "wagmi";
import { Wallet } from "@ethersproject/wallet";
import { eligible } from "@attestate/delegator2";

import * as API from "./API.mjs";
import { getLocalAccount } from "./session.mjs";
import { client, chains } from "./client.mjs";

const CommentInput = (props) => {
  const { toast, allowlist, delegations } = props;

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

  const [isEligible, setIsEligible] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      const result =
        signer &&
        eligible(await allowlist, await delegations, await signer.getAddress());
      setIsEligible(result);
    };
    loadData();
  });

  let signer, isError;
  if (localAccount && localAccount.privateKey) {
    signer = new Wallet(localAccount.privateKey, provider);
  } else {
    signer = result.data;
    isError = result.isError;
  }

  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const handleSubmit = async (e) => {
    setIsLoading(true);
    e.preventDefault();
    const urlParams = new URLSearchParams(window.location.search);
    const index = urlParams.get("index");

    if (text.length < 15 || text.length > 10_000) {
      toast.error("Comment must be between 15 and 10000 characters.");
      setIsLoading(false);
      return;
    }
    const type = "comment";
    const value = API.messageFab(text, `kiwi:${index}`, type);

    let signature;
    try {
      signature = await signer._signTypedData(
        API.EIP712_DOMAIN,
        API.EIP712_TYPES,
        value,
      );
    } catch (err) {
      console.log(err);
      toast.error(`Error! Sad Kiwi! "${err.message}"`);
      setIsLoading(false);
      return;
    }

    const wait = false;
    const response = await API.send(value, signature, wait);
    toast.success("Thanks for submitting your comment. Reloading...");

    const nextPage = new URL(window.location.href);
    if (response?.data?.index) {
      nextPage.searchParams.set("cachebuster", response.data.index);
    }
    window.location.href = nextPage.href;
  };

  return (
    <div
      style={{
        margin: "0 0 1rem 2rem",
      }}
    >
      <textarea
        rows="8"
        cols="80"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={isLoading || !address || !isEligible}
      ></textarea>
      <br />
      <br />
      <button
        disabled={isLoading || !address || !isEligible}
        onClick={handleSubmit}
      >
        {isLoading ? "Submitting..." : "Add comment"}
      </button>
    </div>
  );
};

const Container = (props) => {
  return (
    <WagmiConfig client={client}>
      <RainbowKitProvider chains={chains}>
        <CommentInput {...props} />
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default Container;
