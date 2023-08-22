import { useEffect, useState } from "react";
import { Wallet } from "@ethersproject/wallet";
import { useProvider, useSigner, useAccount, WagmiConfig } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { eligible } from "@attestate/delegator2";

import * as API from "./API.mjs";
import { client, chains } from "./client.mjs";
import NFTModal from "./NFTModal.jsx";

const SubmitButton = (props) => {
  const { toast } = props;
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const { isConnected, address } = useAccount();
  const [openedOnce, setOpenedOnce] = useState(false);

  if (!isConnected && !openedOnce) {
    props.setIsOpen(true);
    setOpenedOnce(true);
  }

  if (isConnected && !openedOnce) {
    const { allowlist, delegations } = props;
    const isEligible = eligible(allowlist, delegations, address);
    if (!isEligible) {
      props.setIsOpen(true);
      setOpenedOnce(true);
    }
  }

  const localKey = localStorage.getItem(`-kiwi-news-${address}-key`);
  const provider = useProvider();
  const result = useSigner();

  let signer, isError;
  if (localKey) {
    signer = new Wallet(localKey, provider);
  } else {
    signer = result.data;
    isError = result.isError;
  }
  useEffect(() => {
    const urlInput = document.getElementById("urlInput");
    const titleInput = document.getElementById("titleInput");

    if (urlInput) {
      setUrl(urlInput.value);
      urlInput.addEventListener("input", () => setUrl(urlInput.value));
    }

    if (titleInput) {
      setTitle(titleInput.value);
      titleInput.addEventListener("input", () => setTitle(titleInput.value));
    }

    // Clean up the event listeners
    return () => {
      if (urlInput) {
        urlInput.removeEventListener("input", () => setUrl(urlInput.value));
      }
      if (titleInput) {
        titleInput.removeEventListener("input", () =>
          setTitle(titleInput.value),
        );
      }
    };
  }, []);

  const handleClick = async (e) => {
    e.preventDefault();

    const value = API.messageFab(title.replace(/(\r\n|\n|\r)/gm, " "), url);

    if (title.length > 80 || url.length > 2048) {
      toast.error(
        "The title should be no more than 80 characters, and the URL should be no more than 2048 characters.",
      );
      setIsLoading(false);
      return;
    }
    if (title.length === 0) {
      toast.error("Please add a title.");
      setIsLoading(false);
      return;
    }
    if (url.length === 0) {
      toast.error("Please add a link.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    if (!localKey) toast("Please sign the message in your wallet!");

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
    const response = await API.send(value, signature);

    let message;
    if (response.status === "success") {
      message = "Thanks for your submission, have a 🥝";
    } else {
      message = `Error! Sad Kiwi! "${response.details}"`;
    }
    const nextPage = new URL(window.location.origin + "/new");
    nextPage.searchParams.set("bpc", "1");
    nextPage.searchParams.set("link", encodeURIComponent(url));
    window.location.href = nextPage.href;
  };

  const buttonStyles = {
    width: "100%",
    padding: "5px",
    fontSize: "16px",
    cursor: "pointer",
  };

  return (
    <button
      style={buttonStyles}
      onClick={handleClick}
      disabled={isLoading && !isError}
    >
      {isLoading && !isError ? "Please confirm signature..." : "Submit"}
    </button>
  );
};

const Form = (props) => {
  const { isConnected } = useAccount();
  const [modalIsOpen, setIsOpen] = useState(false);

  return (
    <WagmiConfig client={client}>
      <RainbowKitProvider chains={chains}>
        <SubmitButton {...props} setIsOpen={setIsOpen} />
        <NFTModal
          modalIsOpen={modalIsOpen}
          setIsOpen={setIsOpen}
          headline="Wait a minute!"
          text="To submit links to Kiwi, you need to own our NFT. 👇"
          closeText="OK, but let me browse more first!"
        />
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default Form;
