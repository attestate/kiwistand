import React from "react";
import { useEffect, useState } from "react";
import { useSigner, useAccount, WagmiConfig } from "wagmi";
import { ConnectKitProvider, ConnectKitButton } from "connectkit";

import * as API from "./API.mjs";
import client from "./client.mjs";
import { showMessage } from "./message.mjs";

const SubmitButton = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const { data: signer, isError } = useSigner();
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
          setTitle(titleInput.value)
        );
      }
    };
  }, []);

  const handleClick = async (e) => {
    e.preventDefault();

    const value = API.messageFab(title.replace(/(\r\n|\n|\r)/gm, " "), url);

    if (title.length > 80 || url.length > 2048) {
      showMessage(
        "The title should be no more than 80 characters, and the URL should be no more than 2048 characters."
      );
      setIsLoading(false);
      return;
    }
    if (title.length === 0) {
      showMessage("Please add a title.");
      setIsLoading(false);
      return;
    }
    if (url.length === 0) {
      showMessage("Please add a link.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    showMessage("Please sign the message in your wallet!");

    let signature;
    try {
      signature = await signer._signTypedData(
        API.EIP712_DOMAIN,
        API.EIP712_TYPES,
        value
      );
    } catch (err) {
      console.log(err);
      showMessage(`Error! Sad Kiwi! "${err.message}"`);
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
    nextPage.searchParams.set("message", message);
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

const CenteredConnectKitButton = () => {
  return (
    <div className="connect-kit-wrapper">
      <h3>You're almost there!</h3>
      <p>
        To submit links to the p2p network you'll need to:
        <br />
        <br />
        🥝 connect your wallet
        <br />
        🥝 mint our News Access NFT.
      </p>
      <ConnectKitButton />
    </div>
  );
};

const Form = () => {
  const { isConnected } = useAccount();
  return (
    <WagmiConfig client={client}>
      <ConnectKitProvider>
        {isConnected ? <SubmitButton /> : <CenteredConnectKitButton />}
      </ConnectKitProvider>
    </WagmiConfig>
  );
};

export default Form;
