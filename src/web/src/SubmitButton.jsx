import { useEffect, useState, useCallback } from "react";
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

const UploadButton = (props) => {
  const { imageURL, setImageURL, url, setURL } = props;
  const [loading, setLoading] = useState(false);

  const uploadToCatbox = async (file) => {
    setLoading(true);
    setImageURL("");
    const formData = new FormData();
    formData.append("reqtype", "fileupload");
    formData.append("fileToUpload", file);

    try {
      const response = await fetch("/api/v1/images", {
        method: "POST",
        body: formData,
      });
      const responseURL = await response.text();
      setImageURL(responseURL);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      console.error(error);
    }
  };

  const handleFileSelect = useCallback((event) => {
    const file = event.target.files[0];
    if (file) {
      uploadToCatbox(file);
    }
  }, []);

  return (
    <div style={{ maxWidth: "600px" }}>
      <label
        style={{ marginBottom: "5px", display: "block", fontSize: "16px" }}
      >
        Link:
      </label>
      <div style={{ display: "flex", alignItems: "center" }}>
        <input
          placeholder="https://bitcoin.org/bitcoin.pdf"
          id="urlInput"
          type="text"
          name="link"
          size="50"
          maxLength="2048"
          required
          style={{
            flexGrow: 8,
            padding: "5px 10px",
            fontSize: "16px",
            boxSizing: "border-box",
            marginRight: "20px",
          }}
          disabled={imageURL}
          value={imageURL || url}
          onChange={(e) => setURL(e.target.value)}
        />
        <label>
          <input
            type="file"
            accept="image/png, image/jpeg, image/gif, image/jpg"
            style={{
              display: "none",
            }}
            onChange={handleFileSelect}
          />
          <div
            style={{
              width: "33px",
              height: "33px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#f0f0f0",
              cursor: "pointer",
              backgroundColor: imageURL ? "limegreen" : "black",
              color: "white",
              borderRadius: "3px",
            }}
          >
            {loading ? "..." : imageURL ? <CheckmarkSVG /> : <ImageSVG />}
          </div>
        </label>
      </div>
    </div>
  );
};

const CheckmarkSVG = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
    style={{ width: "1.25rem", height: "1.25rem" }}
  >
    <rect width="256" height="256" fill="none" />
    <polyline
      points="88 136 112 160 168 104"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="24"
    />
    <circle
      cx="128"
      cy="128"
      r="96"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="24"
    />
  </svg>
);

const ImageSVG = () => (
  <svg
    style={{ width: "1.25rem", height: "1.25rem" }}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <rect
      x="40"
      y="40"
      width="176"
      height="176"
      rx="8"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="24"
    />
    <circle cx="96" cy="96" r="20" />
    <path
      d="M56.69,216,166.34,106.34a8,8,0,0,1,11.32,0L216,144.69"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="24"
    />
  </svg>
);

const SubmitButton = (props) => {
  const { toast, imageURL, url } = props;
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [openedOnce, setOpenedOnce] = useState(false);
  const [remainingChars, setRemainingChars] = useState(80);

  useEffect(() => {
    const embedPreview = document.getElementById("embed-preview");

    const canonicalURL = imageURL ? imageURL : url;
    if (canonicalURL) {
      fetch(`/api/v1/parse?url=${encodeURIComponent(canonicalURL)}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.text();
        })
        .then((data) => {
          embedPreview.innerHTML = data;
        })
        .catch((error) => {
          console.log("Fetch error: ", error);
        });
    } else {
      embedPreview.innerHTML = "";
    }
  }, [url, imageURL]);

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

    const canonicalURL = imageURL ? imageURL : url;
    if (previewLink && canonicalURL) {
      previewLink.href = canonicalURL;
    } else if (previewLink) {
      previewLink.href = placeholderUrl;
    }

    if (previewDomain) {
      previewDomain.textContent = canonicalURL
        ? `(${safeExtractDomain(canonicalURL)})`
        : placeholderDomain;
    }
  }, [title, url, imageURL]);

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
    const titleInput = document.getElementById("titleInput");

    if (titleInput) {
      setTitle(titleInput.textContent);
      titleInput.addEventListener("input", () => {
        setTitle(titleInput.textContent);
        const remaining = 80 - titleInput.textContent.length;
        document.querySelector(".remaining").textContent = remaining;
      });
    }

    return () => {
      if (titleInput) {
        titleInput.removeEventListener("input", () =>
          setTitle(titleInput.textContent),
        );
      }
    };
  }, []);

  const handleClick = async (e) => {
    e.preventDefault();

    const canonicalURL = imageURL ? imageURL : url;
    const value = API.messageFab(
      title.replace(/(\r\n|\n|\r)/gm, " "),
      canonicalURL,
    );

    if (title.length > 80 || canonicalURL.length > 2048) {
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
      canonicalURL.length === 0 ||
      (!canonicalURL.startsWith("https://") &&
        !canonicalURL.startsWith("http://"))
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

    let redirectTo = "/new";
    let wait = false;
    const domain = safeExtractDomain(canonicalURL);
    if (domain === "imgur.com" || domain === "catbox.moe") {
      redirectTo = "/images";
      wait = true;
    }

    const response = await API.send(value, signature, wait);

    let message;
    if (response.status === "success") {
      message = "Thanks for your submission, have a 🥝";
    } else {
      message = `Error! Sad Kiwi! "${response.details}"`;
    }

    const nextPage = new URL(window.location.origin + redirectTo);
    if (redirectTo === "/new" && response?.data?.index) {
      nextPage.searchParams.set("index", response.data.index);
    }
    window.location.href = nextPage.href;
  };

  const buttonStyles = {
    width: "100%",
    maxWidth: "600px",
    marginTop: "1rem",
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
        {isLoading && !isError
          ? !localAccount
            ? "Please confirm signature..."
            : "Submitting..."
          : "Submit"}
      </button>
    </div>
  );
};

const Form = (props) => {
  const [modalIsOpen, setIsOpen] = useState(false);
  const [imageURL, setImageURL] = useState("");

  const urlInput = document.getElementById("urlInput");
  const [url, setURL] = useState(urlInput.value);

  return (
    <WagmiConfig client={client}>
      <RainbowKitProvider chains={chains}>
        <UploadButton
          url={url}
          setURL={setURL}
          imageURL={imageURL}
          setImageURL={setImageURL}
        />
        <SubmitButton
          {...props}
          setIsOpen={setIsOpen}
          url={url}
          imageURL={imageURL}
        />
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
