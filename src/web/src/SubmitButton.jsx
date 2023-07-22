import React from "react";
import { useEffect, useState } from "react";
import { Wallet } from "ethers";
import { useProvider, useSigner, useAccount, WagmiConfig } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";

import * as API from "./API.mjs";
import { client, chains } from "./client.mjs";
import { showMessage } from "./message.mjs";

const SubmitButton = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const account = useAccount();

  const localKey = localStorage.getItem(`-kiwi-news-${account.address}-key`);
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
    if (!localKey) showMessage("Please sign the message in your wallet!");

    let signature;

    try {
      signature = await signer._signTypedData(
        API.EIP712_DOMAIN,
        API.EIP712_TYPES,
        value
      );
      console.log("Signature: ", signature);  // Add this
    } catch (err) {
      console.log(err);
      showMessage(`Error! Sad Kiwi! "${err.message}"`);
      setIsLoading(false);
      return;
    }
    let response;
    try {
      response = await API.send(value, signature);
      console.log("Response: ", response); // Add this
    } catch (err) {
      console.log("Error in sending: ", err); // Add this
      setIsLoading(false);
      return;
    }

    if (response.status === "success") {
    let urlObj = new URL(window.location.origin + "/new");
    urlObj.searchParams.set("bpc", "1");
    urlObj.searchParams.set("success", "true");
    console.log(url);
    urlObj.searchParams.set("submittedLink", url);
    window.location.href = urlObj.href;
    }
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

const Form = () => {
  const { isConnected } = useAccount();
  return (
    <WagmiConfig client={client}>
      <RainbowKitProvider chains={chains}>
        <SubmitButton />
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default Form;
