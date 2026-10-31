import React, { useEffect, useRef, useState } from "react";
import { Wallet } from "@ethersproject/wallet";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { KiwiWagmiProvider } from "./KiwiWagmiProvider.jsx";
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
  isInIOSApp,
} from "./client.mjs";
import { getCookie, getLocalAccount } from "./session.mjs";
import { capture } from "./analytics.mjs";
import { uploadImage } from "./uploadImage.mjs";
import { openOnboarding } from "./LoginModal.jsx";
import ShareModal from "./ShareModal.jsx";
import { postTimestamp, shortName } from "./communities.mjs";
import { mayHaveCommunities } from "./community-gate.mjs";

// NOTE: Only for readers who may have communities (joined here, or an
// account that may run some, see community-gate.mjs) or who came with
// ?community= (views/submit.mjs): the others post to Kiwi News as before.
const PostTo = React.lazy(() => import("./PostTo.jsx"));
function hasCommunities(root) {
  if (!root) return false;
  if (root.dataset.community) return true;
  let joined = null;
  try {
    joined = localStorage.getItem("kiwi-communities");
  } catch (err) {}
  return mayHaveCommunities(joined, getCookie("identity"));
}
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

// The form's tabs: "link", "text" or "image" (an uploaded image as the
// post's link). Choosing "Image" opens the file picker right away.
const UrlInput = (props) => {
  const { url, setURL, toast } = props;
  const [checkedURLs, setCheckedURLs] = useState(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [mode, setMode] = useState("link");
  const [textContent, setTextContent] = useState("");
  const account = useAccount();
  const wallet = useSigner();
  const isTextMode = mode === "text";
  const fileInput = useRef(null);
  // The tab to go back to when the picker is cancelled.
  const previous = useRef("link");

  useEffect(() => {
    if (
      !checkedURLs.has(url) &&
      (url.includes("http") || url.includes("https")) &&
      mode === "link"
    ) {
      // NOTE: Wait until typing pauses: every keystroke changes `url`, and
      // /api/v1/metadata is rate limited per IP (src/ratelimit.mjs).
      const timer = setTimeout(() => fetchMetadata(url), 500);
      return () => clearTimeout(timer);
    }
  }, [url, mode]);

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

  // Back to the tab before "Image" (a cancelled picker or a failed upload),
  // or stay on it when it already has an image.
  const back = () => setMode(previous.current);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    // NOTE: Lets choosing the same file again fire `change`.
    e.target.value = "";
    if (!file) return back();

    // Only allow image files
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return back();
    }

    setIsUploading(true);

    // Signed like the submission: the local Kiwi key or else the wallet.
    const local = getLocalAccount(account.address);
    const signer =
      local && local.privateKey ? new Wallet(local.privateKey) : wallet;

    try {
      const imageUrl = await uploadImage(file, signer);

      // The image is the post's link.
      setURL(imageUrl);
      toast.success("Image uploaded successfully");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Error uploading image: " + error.message);
      back();
    } finally {
      setIsUploading(false);
    }
  };

  const chooseImage = () => {
    previous.current = mode;
    setMode("image");
    fileInput.current?.click();
  };

  // The picker closed without a file.
  useEffect(() => {
    const input = fileInput.current;
    if (!input) return;
    input.addEventListener("cancel", back);
    return () => input.removeEventListener("cancel", back);
  }, []);

  const choose = (next) => {
    if (next === "image") return chooseImage();
    if (next === "text" && mode !== "text") {
      // A text post's link is its text, as a data: URL.
      setTextContent("");
      setURL("");
    }
    if (next === "link" && mode === "text") setURL("");
    setMode(next);
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

  // NOTE: The page's subtitle and layout differ between the tabs
  // (views/submit.mjs, public/pages.css).
  useEffect(() => {
    const form = document.getElementById("n2-submit-form");
    form?.classList.toggle("is-text", isTextMode);
    form?.classList.toggle("is-image", mode === "image");
  }, [mode]);

  const textRemaining = 2048 - textContent.length;
  const tab = (value, label) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      className={`n2-tab${mode === value ? " is-active" : ""}`}
      onClick={() => choose(value)}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="n2-tabs" role="tablist">
        {tab("link", "Link")}
        {tab("text", "Text")}
        {tab("image", "Image")}
      </div>
      <input
        ref={fileInput}
        type="file"
        id="imageUpload"
        accept="image/*"
        onChange={handleImageUpload}
        style={{ display: "none" }}
      />

      {/* Link and Image Tab Content */}
      <div
        className="n2-field n2-field-link"
        style={{ display: !isTextMode ? undefined : "none" }}
      >
        <label htmlFor="urlInput" className="n2-label n2-d">
          {mode === "image" ? "Image" : "Link"}
        </label>
        <input
          placeholder={
            mode === "image"
              ? isUploading
                ? "Uploading..."
                : "Choose an image"
              : "Enter or paste article URL"
          }
          id="urlInput"
          className="n2-input"
          type="text"
          name="link"
          size="50"
          maxLength="2048"
          required
          readOnly={mode === "image"}
          value={url}
          onChange={(e) => setURL(e.target.value)}
        />
        <div className="n2-hint-row n2-d">
          <span className="n2-hint">
            {mode === "image"
              ? isUploading
                ? "Uploading your image..."
                : "Click Image again to replace it."
              : "Paste the link to the original source."}
          </span>
        </div>
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

const SubmitButton = (props) => {
  const { toast, url, target } = props;
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

    let parsed;
    try {
      parsed = new URL(canonicalURL);
    } catch (err) {
      parsed = null;
    }

    // NOTE: Only render image previews for our own Cloudflare Images host and
    // build the element via the DOM to avoid attribute injection.
    if (
      parsed &&
      parsed.protocol === "https:" &&
      parsed.hostname === "imagedelivery.net"
    ) {
      const img = document.createElement("img");
      img.src = parsed.href.includes("/public")
        ? parsed.href
        : parsed.href + "/public";
      img.alt = "Uploaded image";
      img.style.border = "1px solid var(--text-primary)";
      img.style.maxWidth = "100%";
      img.style.maxHeight = "500px";
      img.style.display = "block";
      img.style.margin = "0 auto";
      embedPreview.replaceChildren(img);
      return;
    }

    if (canonicalURL) {
      // NOTE: Same as above: fetch the preview and title once typing pauses,
      // not on every keystroke (parse and metadata are rate limited).
      const timer = setTimeout(() => {
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
      }, 500);
      return () => clearTimeout(timer);
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

  const { openConnectModal } = useConnectModal();

  const handleClick = async (e) => {
    e.preventDefault();

    // NOTE: Logged out, "Submit" used to fail with the toast "Error! Sad
    // Kiwi! "Cannot read properties of undefined (reading '_signTypedData')""
    // (seen in session replays). Open the login instead, like Vote and
    // CommentInput do; the form keeps what was typed.
    if (!signer) {
      if (account.isConnected) {
        toast("Your wallet is still connecting, please try again.");
      } else if (isInIOSApp && openConnectModal) {
        openConnectModal();
      } else {
        openOnboarding();
      }
      return;
    }

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
    // NOTE: A post to a community names it and is signed as the 5-field
    // Message. Nodes only take it once the community is older than it.
    if (target) {
      value.timestamp = postTimestamp(target.created, value.timestamp);
      value.community = target.id;
    }

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
        target ? API.EIP712_COMMUNITY_TYPES : API.EIP712_TYPES,
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

    // NOTE: Same event as the iOS app sends after an accepted submission (text
    // posts included, as data: URLs). It's sent right away because the page
    // navigates to the story next.
    capture(
      "story_submitted",
      {
        href: canonicalURL,
        platform: "web",
        ...(target ? { community: target.id } : {}),
      },
      { send_instantly: true, transport: "sendBeacon" },
    );

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
            : target
              ? `Post to ${shortName(target.name)}`
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
  const [target, setTarget] = useState(null);
  const postTo = document.getElementById("n2-post-to");
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
      <KiwiWagmiProvider>
        <RainbowKitProvider chains={chains}>
          {hasCommunities(postTo) && (
            <React.Suspense fallback={null}>
              <PostTo root={postTo} target={target} setTarget={setTarget} />
            </React.Suspense>
          )}
          <UrlInput url={url} setURL={setURL} toast={toast} />
          <SubmitButton {...props} url={url} target={target} />
        </RainbowKitProvider>
      </KiwiWagmiProvider>
    </QueryClientProvider>
  );
};

export default Form;
