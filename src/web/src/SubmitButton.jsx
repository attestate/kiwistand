import { useEffect, useState } from "react";
import { Wallet } from "@ethersproject/wallet";
import { useAccount, WagmiConfig } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { eligible } from "@attestate/delegator2";
import DOMPurify from "isomorphic-dompurify";

import * as API from "./API.mjs";
import { useSigner, useProvider, client, chains } from "./client.mjs";
import NFTModal from "./NFTModal.jsx";
import { getLocalAccount } from "./session.mjs";

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

const UrlInput = (props) => {
  const { url, setURL } = props;
  const [checkedURLs, setCheckedURLs] = useState(new Set());

  useEffect(() => {
    if (
      !checkedURLs.has(url) &&
      (url.includes("http") || url.includes("https"))
    ) {
      fetchMetadata(url);
    }
  }, [url]);
  const fetchMetadata = async (url) => {
    try {
      const response = await fetch(`/api/v1/metadata?url=${url}`);
      const data = await response.json();

      if (data.data && data.data.canonicalLink) {
        setURL(data.data.canonicalLink);
        setCheckedURLs(new Set(checkedURLs).add(url));
      }
    } catch (error) {
      console.error("Error fetching metadata:", error);
    }
  };

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
            borderRadius: "2px",
            border: "1px solid #828282",
            flexGrow: 8,
            padding: "5px 10px",
            fontSize: "16px",
            boxSizing: "border-box",
          }}
          value={url}
          onChange={(e) => setURL(e.target.value)}
        />
      </div>
    </div>
  );
};

const SubmitButton = (props) => {
  const { toast, url } = props;
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [remainingChars, setRemainingChars] = useState(80);

  useEffect(() => {
    const embedPreview = document.getElementById("embed-preview");

    const canonicalURL = url;
    if (canonicalURL) {
      fetch(`/api/v1/parse?url=${encodeURIComponent(canonicalURL)}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.text();
        })
        .then((data) => {
          embedPreview.innerHTML = DOMPurify.sanitize(data);
        })
        .catch((error) => {
          console.log("Fetch error: ", error);
        });
      fetch(`/api/v1/metadata?url=${encodeURIComponent(canonicalURL)}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          if (data.data.ogTitle) {
            const title = data.data.ogTitle;
            document.getElementById("titleInput").innerText = title;
            const remaining = 80 - title.length;
            document.querySelector(".remaining").textContent = remaining;
            setTitle(title);
          }
        })
        .catch((error) => {
          console.log("Fetch error: ", error);
        });
    } else {
      embedPreview.innerHTML = "";
    }
  }, [url]);

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

    const canonicalURL = url;
    if (previewLink && canonicalURL) {
      previewLink.href = DOMPurify.sanitize(canonicalURL);
    } else if (previewLink) {
      previewLink.href = DOMPurify.sanitize(placeholderUrl);
    }

    if (previewDomain) {
      previewDomain.textContent = canonicalURL
        ? `(${safeExtractDomain(canonicalURL)})`
        : placeholderDomain;
    }
  }, [title, url]);

  let address;
  const account = useAccount();
  const localAccount = getLocalAccount(account.address, props.allowlist);
  if (account.isConnected) {
    address = account.address;
  }
  if (localAccount) {
    address = localAccount.identity;
  }
  const isEligible =
    address && eligible(props.allowlist, props.delegations, address);

  const provider = useProvider();
  const result = useSigner();

  let signer;
  if (localAccount && localAccount.privateKey) {
    signer = new Wallet(localAccount.privateKey, provider);
  } else {
    signer = result;
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

    const canonicalURL = url;
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
    let wait = true;
    const domain = safeExtractDomain(canonicalURL);
    const response = await API.send(value, signature, wait);

    let message;
    if (response.status === "success") {
      message = "Thanks for your submission, have a 🥝";
    } else {
      message = `Error! Sad Kiwi! "${response.details}"`;
    }

    let nextPage;
    if (response?.data?.index && response?.data?.isResubmission) {
      redirectTo = "/stories";
      nextPage = new URL(window.location.origin + redirectTo);
      nextPage.searchParams.set("index", response.data.index);
    } else if (response?.data?.index) {
      nextPage = new URL(window.location.origin + redirectTo);
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

  return (
    <div>
      <button
        id="button-onboarding"
        style={buttonStyles}
        onClick={handleClick}
        disabled={isLoading || !isEligible}
      >
        {isLoading
          ? !localAccount
            ? "Please confirm signature..."
            : "Submitting..."
          : "Submit"}
      </button>
    </div>
  );
};

const Form = (props) => {
  const urlInput = document.getElementById("urlInput");
  const [url, setURL] = useState(urlInput.value);

  return (
    <WagmiConfig config={client}>
      <RainbowKitProvider chains={chains}>
        <UrlInput url={url} setURL={setURL} />
        <SubmitButton {...props} url={url} />
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default Form;
