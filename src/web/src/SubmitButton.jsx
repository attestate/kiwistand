import { useEffect, useState } from "react";
import { Wallet } from "@ethersproject/wallet";
import { useProvider, useSigner, useAccount, WagmiConfig } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { eligible } from "@attestate/delegator2";

import * as API from "./API.mjs";
import { client, chains } from "./client.mjs";
import NFTModal from "./NFTModal.jsx";
import { getLocalAccount } from "./session.mjs";
import { ConnectedConnectButton } from "./Navigation.jsx";

function safeExtractDomain(link) {
  let parsedUrl;
  try {
    parsedUrl = new URL(link);
  } catch (err) {
    return "";
  }

  const parts = parsedUrl.hostname.split(".");
  const tld = parts.slice(-2).join(".");
  return tld;
}

const SubmitButton = (props) => {
  const { toast } = props;
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [openedOnce, setOpenedOnce] = useState(false);
  const [remainingChars, setRemainingChars] = useState(80);

  useEffect(() => {
    const previewLink = document.querySelector(".story-link");
    const previewDomain = document.querySelector(".story-domain");

    const placeholderTitle = document
      .querySelector("#titleInput")
      .getAttribute("data-placeholder");
    const placeholderUrl = document.querySelector("#urlInput").placeholder;
    const placeholderDomain = `(${safeExtractDomain(placeholderUrl)})`;

    if (previewLink) {
      previewLink.textContent = title || placeholderTitle;
    }

    if (previewLink && url) {
      previewLink.href = url;
    } else if (previewLink) {
      previewLink.href = placeholderUrl;
    }

    if (previewDomain) {
      previewDomain.textContent = url
        ? `(${safeExtractDomain(url)})`
        : placeholderDomain;
    }
  }, [title, url]);

  let address;
  const account = useAccount();
  const localAccount = getLocalAccount(account.address);
  if (account.isConnected) {
    address = account.address;
  }
  if (localAccount) {
    address = localAccount.identity;
  }
  const isEligible =
    address && eligible(props.allowlist, props.delegations, address);

  if (!isEligible && !openedOnce) {
    props.setIsOpen(true);
    setOpenedOnce(true);
  }

  const provider = useProvider();
  const result = useSigner();

  let signer, isError;
  if (localAccount && localAccount.privateKey) {
    signer = new Wallet(localAccount.privateKey, provider);
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
      setTitle(titleInput.textContent);
      titleInput.addEventListener("input", () => {
        setTitle(titleInput.textContent);
        const remaining = 80 - titleInput.textContent.length;
        document.querySelector(".remaining").textContent = remaining;
      });
    }

    return () => {
      if (urlInput) {
        urlInput.removeEventListener("input", () => setUrl(urlInput.value));
      }
      if (titleInput) {
        titleInput.removeEventListener("input", () =>
          setTitle(titleInput.textContent),
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
    if (
      url.length === 0 ||
      (!url.startsWith("https://") && !url.startsWith("http://"))
    ) {
      toast.error("Please add a valid link.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    if (!localAccount) toast("Please sign the message in your wallet!");

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
    maxWidth: "600px",
    padding: "5px",
    fontSize: "16px",
    cursor: "pointer",
  };

  if (!account.isConnected && !isEligible) {
    return (
      <ConnectedConnectButton
        allowlist={props.allowlist}
        delegations={props.delegations}
      />
    );
  }

  return (
    <div>
      {!isEligible && "You need to buy our NFT to submit and upvote..."}
      <button
        id="button-onboarding"
        style={buttonStyles}
        onClick={handleClick}
        disabled={(isLoading && !isError) || !isEligible}
      >
        {isLoading && !isError ? "Please confirm signature..." : "Submit"}
      </button>
    </div>
  );
};

const Form = (props) => {
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
