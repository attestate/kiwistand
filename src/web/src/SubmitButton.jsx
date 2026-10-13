import React, { useEffect, useState } from "react";
import { Wallet } from "@ethersproject/wallet";
import { useAccount, WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { resolveIdentity } from "@attestate/delegator2";
import DOMPurify from "isomorphic-dompurify";
import slugify from "slugify";
import { sdk } from "@farcaster/miniapp-sdk";
slugify.extend({ "′": "", "'": "", '"': "" });

import * as API from "./API.mjs";
import {
  useSigner,
  useProvider,
  client,
  chains,
  useIsMiniApp,
} from "./client.mjs";
import { getLocalAccount } from "./session.mjs";
import ShareModal from "./ShareModal.jsx";
import GuidelinesDrawer, { useGuidelinesCheck } from "./GuidelinesDrawer.jsx";
import { openDelegationModalForAction, isDelegationModalNeeded } from "./delegationModalManager.js";

export function getSlug(title) {
  return slugify(DOMPurify.sanitize(title), { strict: true });
}

function safeExtractDomain(link) {
  // Return empty string for text posts (data: and kiwi: URLs)
  if (link.startsWith('data:') || link.startsWith('kiwi:')) {
    return '';
  }

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
  const [isTextMode, setIsTextMode] = useState(false);
  const [textContent, setTextContent] = useState("");

  useEffect(() => {
    if (
      !checkedURLs.has(url) &&
      (url.includes("http") || url.includes("https")) &&
      !isTextMode
    ) {
      fetchMetadata(url);
    }
  }, [url, isTextMode]);

  const fetchMetadata = async (url) => {
    try {
      const response = await fetch(`/api/v1/metadata?url=${url}`);
      if (!response.ok) {
        console.error(`Metadata fetch failed with status: ${response.status}`);
        return;
      }
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

  // Handle toggle between URL and Text mode
  const handleModeToggle = () => {
    const newMode = !isTextMode;
    setIsTextMode(newMode);

    if (newMode) {
      // Switching to text mode - decode if there's a data URL
      if (url.startsWith("data:text/plain,")) {
        const decoded = decodeURIComponent(url.replace("data:text/plain,", ""));
        setTextContent(decoded);
      } else {
        setTextContent("");
      }
      setURL("");
    } else {
      // Switching to URL mode - encode text if there is any
      if (textContent.trim()) {
        const encoded = `data:text/plain,${encodeURIComponent(textContent)}`;
        setURL(encoded);
      }
      setTextContent("");
    }
  };

  // Update URL when text content changes in text mode
  useEffect(() => {
    if (isTextMode && textContent.trim()) {
      const encoded = `data:text/plain,${encodeURIComponent(textContent)}`;
      setURL(encoded);
    } else if (isTextMode) {
      setURL("");
    }
  }, [textContent, isTextMode]);

  // NOTE: The page's subtitle and layout differ between the Link and Text
  // tabs (views/submit.mjs, public/pages.css).
  useEffect(() => {
    document
      .getElementById("n2-submit-form")
      ?.classList.toggle("is-text", isTextMode);
  }, [isTextMode]);

  const textRemaining = 2048 - textContent.length;

  return (
    <>
      <div className="n2-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={!isTextMode}
          className={`n2-tab${!isTextMode ? " is-active" : ""}`}
          onClick={() => setIsTextMode(false)}
        >
          Link
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isTextMode}
          className={`n2-tab${isTextMode ? " is-active" : ""}`}
          onClick={() => setIsTextMode(true)}
        >
          Text
        </button>
      </div>

      {/* Link Tab Content */}
      <div
        className="n2-field n2-field-link"
        style={{ display: !isTextMode ? undefined : "none" }}
      >
        <label htmlFor="urlInput" className="n2-label n2-d">
          Link
        </label>
        <input
          placeholder="Enter or paste article URL"
          id="urlInput"
          className="n2-input"
          type="text"
          name="link"
          size="50"
          maxLength="2048"
          required
          value={url}
          onChange={(e) => setURL(e.target.value)}
        />
        <div className="n2-hint-row n2-d">
          <span className="n2-hint">Paste the link to the original source.</span>
        </div>
      </div>
      <div
        className="n2-upload-row"
        style={{ display: !isTextMode ? undefined : "none" }}
      >
        <input
          type="file"
          id="imageUpload"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: "none" }}
        />
        <label htmlFor="imageUpload" className="n2-btn-outline n2-upload">
          <AddPhotoSVG />
          {isUploading ? (
            "Uploading..."
          ) : (
            <>
              <span className="n2-d">Upload image</span>
              <span className="n2-m">Upload Image</span>
            </>
          )}
        </label>
        <span className="n2-hint n2-d">
          Optional. Replaces the preview image from the link.
        </span>
      </div>

      {/* Text Tab Content */}
      <div
        className="n2-field n2-field-text"
        style={{ display: isTextMode ? undefined : "none" }}
      >
        <label htmlFor="textInput" className="n2-label n2-d">
          Text
        </label>
        <textarea
          placeholder="Enter your text content here..."
          id="textInput"
          className="n2-input n2-textarea"
          rows="6"
          maxLength="2048"
          required
          value={textContent}
          onChange={(e) => setTextContent(e.target.value)}
        />
        <div className="n2-hint-row">
          <span className="n2-count">
            <span className="n2-m">Characters remaining: </span>
            {textRemaining}
            <span className="n2-d"> characters left</span>
          </span>
        </div>
      </div>
    </>
  );
};

// NOTE: Material Symbols Rounded "add_photo_alternate".
const AddPhotoSVG = () => (
  <svg
    className="n2-icon"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 -960 960 960"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M480-480ZM180-120q-24 0-42-18t-18-42v-600q0-24 18-42t42-18h335q12.75 0 21.38 8.68 8.62 8.67 8.62 21.5 0 12.82-8.62 21.32-8.63 8.5-21.38 8.5H180v600h600v-335q0-12.75 8.68-21.38 8.67-8.62 21.5-8.62 12.82 0 21.32 8.62 8.5 8.63 8.5 21.38v335q0 24-18 42t-42 18H180Zm60-162h480L576-474 449-307l-94-124-115 149Zm453-410h-58q-12.75 0-21.37-8.68-8.63-8.67-8.63-21.5 0-12.82 8.63-21.32 8.62-8.5 21.37-8.5h58v-58q0-12.75 8.68-21.38 8.67-8.62 21.5-8.62 12.82 0 21.32 8.62 8.5 8.63 8.5 21.38v58h57q12.75 0 21.38 8.68 8.62 8.67 8.62 21.5 0 12.82-8.62 21.32-8.63 8.5-21.38 8.5h-57v57q0 12.75-8.68 21.37-8.67 8.63-21.5 8.63-12.82 0-21.32-8.63-8.5-8.62-8.5-21.37v-57Z" />
  </svg>
);


const SubmitButton = (props) => {
  const { toast, url } = props;
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [remainingChars, setRemainingChars] = useState(80);
  const [showShareModal, setShowShareModal] = useState(false);
  const [storyData, setStoryData] = useState(null);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [isCloudflareChallenge, setIsCloudflareChallenge] = useState(false);
  const [showGuidelinesDrawer, setShowGuidelinesDrawer] = useState(false);
  const [hasSeenGuidelines, setHasSeenGuidelines] = useState(false);
  const { shouldShowGuidelines } = useGuidelinesCheck();
  const { isMiniApp, loading } = useIsMiniApp();

  // Ad related state removed
  // const params = new URLSearchParams(window.location.search);
  // const adParam = params.get("isad") === "true";
  // const [isAd, setIsAd] = useState(adParam);

  useEffect(() => {
    const embedPreview = document.getElementById("embed-preview");

    const canonicalURL = url;

    // Skip preview for text posts (data: URLs)
    if (canonicalURL.startsWith("data:text/plain,")) {
      if (embedPreview) {
        embedPreview.innerHTML = "";
      }
      return;
    }

    if (canonicalURL.includes("imagedelivery.net")) {
      embedPreview.innerHTML = `<img src="${DOMPurify.sanitize(
        canonicalURL.includes("/public")
          ? canonicalURL
          : canonicalURL + "/public",
      )}" style="border: 1px solid var(--text-primary); max-width: 100%; max-height: 500px; display: block; margin: 0 auto;" alt="Uploaded image" />`;
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
      setIsGeneratingTitle(true);
      fetch(
        `/api/v1/metadata?url=${encodeURIComponent(canonicalURL)}&generateTitle=true`,
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          // Check if it's a Cloudflare challenge page
          if (data.data.isCloudflareChallenge) {
            setIsCloudflareChallenge(true);
            setIsGeneratingTitle(false);
            // Keep the message visible for 3 seconds
            setTimeout(() => {
              setIsCloudflareChallenge(false);
            }, 3000);
            return;
          }
          
          if (data.data.ogTitle) {
            const titleInputElem = document.getElementById("titleInput");
            const isTitleBlank = titleInputElem.innerText.length === 0;
            // NOTE: We don't want to overwrite the title in case the user has
            // already typed something in the title box.
            if (!isTitleBlank) {
              setIsGeneratingTitle(false);
              return;
            }

            const title = data.data.ogTitle;
            titleInputElem.innerText = title;
            const remaining = 80 - title.length;
            document.querySelector(".remaining").textContent = remaining;
            document.querySelector(".remaining").style.color =
              remaining > 0 ? "var(--text-secondary)" : "var(--color-error)";
            setTitle(title);
          }
          setIsGeneratingTitle(false);
        })
        .catch((error) => {
          console.log("Fetch error: ", error);
          setIsGeneratingTitle(false);
        });
    } else {
      embedPreview.innerHTML = "";
      setIsCloudflareChallenge(false);
    }
  }, [url]);

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
    address && resolveIdentity(props.delegations, address);

  const provider = useProvider();
  const result = useSigner();

  let signer;
  if (localAccount && localAccount.privateKey) {
    signer = new Wallet(localAccount.privateKey, provider);
  } else {
    signer = result;
  }

  // Check for delegation needs on mount
  useEffect(() => {
    if (address && isDelegationModalNeeded(address)) {
      openDelegationModalForAction();
    }
  }, [address]);

  useEffect(() => {
    const titleInput = document.getElementById("titleInput");

    if (titleInput) {
      setTitle(titleInput.textContent);
      titleInput.addEventListener("input", () => {
        setTitle(titleInput.textContent);
        const remaining = 80 - titleInput.textContent.length;
        document.querySelector(".remaining").textContent = remaining;
        document.querySelector(".remaining").style.color =
          remaining > 0 ? "var(--text-secondary)" : "var(--color-error)";
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

    // Show guidelines drawer for low-karma users first (only once per session)
    if (shouldShowGuidelines && !hasSeenGuidelines) {
      setShowGuidelinesDrawer(true);
      setHasSeenGuidelines(true);
      return;
    }

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
        !canonicalURL.startsWith("http://") &&
        !canonicalURL.startsWith("data:text/plain,"))
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
      const nextPage = new URL(
        window.location.origin + `/stories/${getSlug(title)}`,
      );
      nextPage.searchParams.set("index", response.data.index);
      window.location.href = nextPage.href;
      return;
    } else if (response.status === "error") {
      toast.error(
        "Unexpected error during submission. Please report this to the team!",
      );
      setIsLoading(false);
      return;
    }

    // Show share modal only in Farcaster frames, otherwise redirect
    const storyUrl = new URL(
      window.location.origin + `/stories/${getSlug(title)}`,
    );
    storyUrl.searchParams.set("index", response.data.index);

    try {
      const inMini = await sdk.isInMiniApp();
      if (inMini) {
      setStoryData({
        title,
        url: canonicalURL,
        storyUrl: storyUrl.href,
      });
      setShowShareModal(true);
      setIsLoading(false);
        return;
      }
    } catch {}
    window.location.href = storyUrl.href;
  };

  const handleShareModalClose = () => {
    setShowShareModal(false);
    // Clear form after closing modal
    setTitle("");
    const titleInput = document.getElementById("titleInput");
    if (titleInput) {
      titleInput.textContent = "";
    }
    const urlInput = document.getElementById("urlInput");
    if (urlInput) {
      urlInput.value = "";
    }
  };

  return (
    <div className="n2-actions" style={{ position: "relative" }}>
      {isGeneratingTitle && (
        <>
          <style>
            {`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}
          </style>
          <div
            style={{
              position: "absolute",
              top: "-120px",
              left: "50%",
              transform: "translateX(-50%)",
              backgroundColor: "var(--background-color0)",
              padding: "1.5rem",
              borderRadius: "8px",
              textAlign: "center",
              width: "280px",
              border: "2px solid var(--accent-primary)",
              boxShadow: "var(--shadow-default)",
              zIndex: 100,
            }}
          >
            <div
              style={{
                fontSize: "2.5rem",
                marginBottom: "0.75rem",
                animation: "spin 2s linear infinite",
                display: "inline-block",
              }}
            >
              🥝
            </div>
            <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--text-primary)", fontSize: "1.1rem" }}>
              AI Title Magic
            </h3>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "13px" }}>
              Generating a catchy title for your link...
            </p>
          </div>
        </>
      )}
      {isCloudflareChallenge && !isGeneratingTitle && (
        <div
          onClick={() => setIsCloudflareChallenge(false)}
          style={{
            position: "absolute",
            top: "-140px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "var(--bg-white)",
            padding: "1rem",
            borderRadius: "8px",
            textAlign: "center",
            width: "320px",
            border: "2px solid var(--text-primary)",
            boxShadow: "var(--shadow-default)",
            zIndex: 100,
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⚠️</div>
          <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--text-primary)", fontSize: "1rem" }}>
            AI Title Magic Failed
          </h3>
          <p style={{ margin: "0 0 0.5rem 0", color: "var(--text-secondary)", fontSize: "13px" }}>
            Please enter a title manually.
          </p>
          <p style={{ margin: 0, color: "var(--text-tertiary)", fontSize: "11px", fontStyle: "italic" }}>
            Tap to dismiss
          </p>
        </div>
      )}
      <>
        <button
          id="button-onboarding"
          className="n2-btn"
          onClick={async (e) => {
            // Add haptic feedback for submit action only in frames
            if (isMiniApp) {
              try {
                await sdk.haptics.impactOccurred("medium");
              } catch (error) {
                // Silently fail if haptics not supported
              }
            }

            handleClick(e);
          }}
          disabled={
            isLoading ||
            title.length > 80 ||
            url.length > 2048 ||
            title.length === 0 ||
            url.length === 0 ||
            (!url.startsWith("https://") && !url.startsWith("http://") && !url.startsWith("data:text/plain,"))
          }
        >
          {isLoading
            ? !localAccount
              ? "Please confirm signature..."
              : "Submitting..."
            : "Submit"}
        </button>
        <span className="n2-note n2-d">
          Your submission is signed with your account and is public.
        </span>
      </>
      {showShareModal && storyData && (
        <ShareModal
          isOpen={showShareModal}
          onClose={handleShareModalClose}
          title={storyData.title}
          url={storyData.url}
          storyUrl={storyData.storyUrl}
        />
      )}
      <GuidelinesDrawer
        isOpen={showGuidelinesDrawer}
        onClose={() => setShowGuidelinesDrawer(false)}
        onContinue={() => {
          setShowGuidelinesDrawer(false);
          // Continue with submission after user acknowledges guidelines
          handleClick({ preventDefault: () => {} });
        }}
      />
    </div>
  );
};

// AdForm component and related constants/imports removed

const queryClient = new QueryClient();

const Form = (props) => {
  const urlInput = document.getElementById("urlInput");
  const [url, setURL] = useState(urlInput.value);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("focus") !== "url") return;

    const focusUrlInput = () => {
      const input = document.getElementById("urlInput");
      if (!input) return;
      input.focus();
      input.select();
    };

    focusUrlInput();
    requestAnimationFrame(focusUrlInput);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={client} reconnectOnMount={false}>
        <RainbowKitProvider chains={chains}>
          <UrlInput url={url} setURL={setURL} toast={toast} />
          <SubmitButton {...props} url={url} />
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
};

export default Form;
