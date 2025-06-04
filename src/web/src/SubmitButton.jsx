import { useEffect, useState } from "react";
import { Wallet } from "@ethersproject/wallet";
import { useAccount, WagmiConfig } from "wagmi";
import { RainbowKitProvider, ConnectButton } from "@rainbow-me/rainbowkit";
import { eligible } from "@attestate/delegator2";
import DOMPurify from "isomorphic-dompurify";
import slugify from "slugify";
slugify.extend({ "′": "", "'": "", "'": "", '"': "" });

import * as API from "./API.mjs";
import { useSigner, useProvider, client, chains, isInFarcasterFrame } from "./client.mjs";
import NFTModal from "./NFTModal.jsx";
import { getLocalAccount } from "./session.mjs";
import { SimpleDisconnectButton } from "./Navigation.jsx";

export function getSlug(title) {
  return slugify(DOMPurify.sanitize(title));
}

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
  const { url, setURL, toast } = props;
  const [checkedURLs, setCheckedURLs] = useState(new Set());
  const [isUploading, setIsUploading] = useState(false);

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

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Only allow image files
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setIsUploading(true);

    try {
      // Step 1: Get upload URL from our backend
      const tokenResponse = await fetch("/api/v1/image-upload-token");
      if (!tokenResponse.ok) throw new Error("Failed to get upload token");

      const tokenData = await tokenResponse.json();
      const { uploadURL } = tokenData.data;

      // Step 2: Upload file directly to Cloudflare
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch(uploadURL, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) throw new Error("Failed to upload image");

      // Step 3: Generate the final image URL
      // The URL pattern for Cloudflare Images is:
      // https://imagedelivery.net/[account hash]/[image id]/[variant]
      const imageId = tokenData.data.id;
      const accountHash = uploadURL.split("/").slice(-2)[0];
      const imageUrl = `https://imagedelivery.net/${accountHash}/${imageId}/public`;

      // Set the URL in the input field
      setURL(imageUrl);
      toast.success("Image uploaded successfully");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Error uploading image: " + error.message);
    } finally {
      setIsUploading(false);
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
          placeholder="Enter or paste article URL"
          id="urlInput"
          type="text"
          name="link"
          size="50"
          maxLength="2048"
          required
          style={{
            borderRadius: "2px",
            border:
              url.length > 2048 ||
              url.length === 0 ||
              (!url.startsWith("https://") && !url.startsWith("http://"))
                ? "2px solid black"
                : "1px solid green",
            color:
              url.length > 2048 ||
              url.length === 0 ||
              (!url.startsWith("https://") && !url.startsWith("http://"))
                ? "black"
                : "#828282",

            width: "80%",
            padding: "12px 16px",
            fontSize: "16px",
            boxSizing: "border-box",
            background: "white",
            minHeight: "50px",
          }}
          value={url}
          onChange={(e) => setURL(e.target.value)}
        />
        <input
          type="file"
          id="imageUpload"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: "none" }}
        />
        <label
          htmlFor="imageUpload"
          style={{
            marginLeft: "10px",
            padding: "0 16px",
            backgroundColor: "#000",
            color: "#fff",
            borderRadius: "2px",
            cursor: "pointer",
            fontSize: "14px",
            height: "50px" /* Match exactly the height of the URL input */,
            boxSizing: "border-box",
            display: "flex",
            textAlign: "center",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isUploading ? "Uploading..." : "Upload Image"}
        </label>
      </div>
    </div>
  );
};

const buttonStyles = {
  width: "100%",
  maxWidth: "600px",
  marginTop: "2rem",
  padding: "5px",
  fontSize: "16px",
  cursor: "pointer",
};

const SubmitButton = (props) => {
  const { toast, url } = props;
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [remainingChars, setRemainingChars] = useState(80);

  // Ad related state removed
  // const params = new URLSearchParams(window.location.search);
  // const adParam = params.get("isad") === "true";
  // const [isAd, setIsAd] = useState(adParam);

  useEffect(() => {
    const embedPreview = document.getElementById("embed-preview");

    const canonicalURL = url;

    if (canonicalURL.includes("imagedelivery.net")) {
      embedPreview.innerHTML = `<img src="${DOMPurify.sanitize(
        canonicalURL.includes("/public")
          ? canonicalURL
          : canonicalURL + "/public",
      )}" style="border: 1px solid black; max-width: 100%; max-height: 500px; display: block; margin: 0 auto;" alt="Uploaded image" />`;
      return;
    }

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
      fetch(
        `/api/v1/metadata?url=${encodeURIComponent(
          canonicalURL,
        )}&generateTitle=true`,
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          if (data.data.ogTitle) {
            const titleInputElem = document.getElementById("titleInput");
            const isTitleBlank = titleInputElem.innerText.length === 0;
            // NOTE: We don't want to overwrite the title in case the user has
            // already typed something in the title box.
            if (!isTitleBlank) return;

            const title = data.data.ogTitle;
            titleInputElem.innerText = title;
            const remaining = 80 - title.length;
            document.querySelector(".remaining").textContent = remaining;
            document.querySelector(".remaining").style.color =
              remaining > 0 ? "#828282" : "red";
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
        document.querySelector(".remaining").style.color =
          remaining > 0 ? "#828282" : "red";
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
    // Check for emojis in the title
    const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
    if (emojiRegex.test(title)) {
      toast.error("Emojis are not allowed in the title.");
      setIsLoading(false);
      return;
    }

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

    const wait = true;
    const domain = safeExtractDomain(canonicalURL);
    const response = await API.send(value, signature, wait);

    let message;
    if (response.status === "success") {
      message = "Thanks for your submission, have a 🥝";
    } else {
      message = `Error! Sad Kiwi! "${response.details}"`;
    }

    if (
      response.status === "error" &&
      response.details.includes("Message with marker")
    ) {
      toast.success(
        "You've voted on this link already earlier, redirecting...",
      );
    } else if (response.status === "error") {
      toast.error(
        "Unexpected error during submission. Please report this to the team!",
      );
      return;
    }

    const nextPage = new URL(
      window.location.origin + `/stories/${getSlug(title)}`,
    );
    nextPage.searchParams.set("index", response.data.index);
    window.location.href = nextPage.href;
  };

  if (!isEligible && account.isConnected) {
    return (
      <div>
        <div style={{
          padding: "1rem",
          margin: "1rem 0",
          background: "#fff3cd",
          border: "1px solid #856404",
          borderRadius: "4px",
          color: "#856404",
          maxWidth: "600px"
        }}>
          <h3 style={{ marginTop: 0 }}>Kiwi Pass Required</h3>
          <p>Only Kiwi Pass holders can submit stories to Kiwi News. Get your Kiwi Pass to start curating the best crypto content!</p>
          <p>
            <a 
              href="/kiwipass-mint" 
              style={{ 
                color: "#856404", 
                textDecoration: "underline",
                fontWeight: "bold" 
              }}
            >
              Get your Kiwi Pass →
            </a>
          </p>
        </div>
        <button
          id="button-onboarding"
          style={{...buttonStyles, opacity: 0.5, cursor: "not-allowed"}}
          disabled={true}
        >
          Submit (Kiwi Pass Required)
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* AdForm removed */}
      <>
        <button
          id="button-onboarding"
          style={buttonStyles}
          onClick={handleClick}
          disabled={
            isLoading ||
            !isEligible ||
            title.length > 80 ||
            url.length > 2048 ||
            title.length === 0 ||
            url.length === 0 ||
            (!url.startsWith("https://") && !url.startsWith("http://"))
          }
        >
          {isLoading
            ? !localAccount
              ? "Please confirm signature..."
              : "Submitting..."
            : "Submit"}
        </button>
      </>
    </div>
  );
};

// AdForm component and related constants/imports removed

const Form = (props) => {
  const urlInput = document.getElementById("urlInput");
  const [url, setURL] = useState(urlInput.value);

  return (
    <WagmiConfig config={client}>
      <RainbowKitProvider chains={chains}>
        <UrlInput url={url} setURL={setURL} toast={toast} />
        <SubmitButton {...props} url={url} />
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default Form;
