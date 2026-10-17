import React, { useEffect, useState } from "react";
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
import { getLocalAccount } from "./session.mjs";
import { openOnboarding } from "./LoginModal.jsx";
import ShareModal from "./ShareModal.jsx";
import GuidelinesDrawer, { useGuidelinesCheck } from "./GuidelinesDrawer.jsx";
import { openDelegationModalForAction, isDelegationModalNeeded } from "./delegationModalManager.js";
import { uploadImage } from "./uploadImage.mjs";
import {
  MAX_POST_LENGTH,
  normalizeText,
  splitLinks,
  validatePost,
} from "./post.mjs";

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

// The signed-in account's address (a local key's identity first), or null.
function useSignedInAddress() {
  const account = useAccount();
  const localAccount = getLocalAccount(account.address);
  if (localAccount) return localAccount.identity;
  if (account.isConnected) return account.address;
  return null;
}

// The countdown ring next to the post field: fills up to 200 characters,
// shows the number when 20 or fewer are left, turns red past the limit.
const CounterRing = ({ count, remaining }) => {
  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(count / MAX_POST_LENGTH, 1);
  const state = remaining < 0 ? "is-over" : remaining <= 20 ? "is-near" : "";
  return (
    <span
      className={`n2-ring ${state}`}
      role="status"
      aria-label={`${remaining} characters left`}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <circle className="n2-ring-track" cx="12" cy="12" r={radius} />
        <circle
          className="n2-ring-bar"
          cx="12"
          cy="12"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          transform="rotate(-90 12 12)"
        />
      </svg>
      {remaining <= 20 && <span className="n2-ring-count">{remaining}</span>}
    </span>
  );
};

// The text with its links underlined, as the feed shows it.
const PostText = ({ text }) =>
  splitLinks(text).map((part, i) =>
    part.href ? (
      <span key={i} className="kn-post-link">
        {part.display}
      </span>
    ) : (
      <React.Fragment key={i}>{part.text}</React.Fragment>
    ),
  );

const previewIcons = {
  heart:
    "M128,224S24,168,24,102A54,54,0,0,1,78,48c22.59,0,41.94,12.31,50,32,8.06-19.69,27.41-32,50-32a54,54,0,0,1,54,54C232,168,128,224,128,224Z",
  comment:
    "M71.58,144,32,176V48a8,8,0,0,1,8-8H168a8,8,0,0,1,8,8v88a8,8,0,0,1-8,8ZM80,144v40a8,8,0,0,0,8,8h96.42L224,224V96a8,8,0,0,0-8-8H176",
  share: "M176 152 224 104 176 56M192 216H32V88M72,176a96,96,0,0,1,93-72h59",
  save: "M192,224l-64-40L64,224V48a8,8,0,0,1,8-8H184a8,8,0,0,1,8,8Z",
};
const PreviewAction = ({ icon, save }) => (
  <div className={`kn-action${save ? " kn-action-save" : ""}`}>
    <span className="interaction-button">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" aria-hidden="true">
        <path
          d={previewIcons[icon]}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="16"
        />
      </svg>
    </span>
  </div>
);

// NOTE: The same markup and classes as a post in the feed (PostCard in
// views/components/row.mjs, styled in news.css), with static actions.
const PostPreview = ({ text, image, profile }) => (
  <div className="kn-story kn-post n2-post-preview" aria-hidden="true">
    <span className="kn-post-avatar">
      {profile && profile.safeAvatar ? (
        <img src={profile.safeAvatar} alt="" width="40" height="40" />
      ) : null}
    </span>
    <div className="kn-post-body">
      <div className="kn-post-head">
        <span className="kn-post-name">
          {(profile && profile.displayName) || "You"}
        </span>
        <span className="kn-dot" aria-hidden="true"></span>
        <span className="kn-post-age">now</span>
      </div>
      <div className="kn-post-text">
        <PostText text={text} />
      </div>
      {image && (
        <div className="kn-post-media">
          <img src={sizedImageUrl(image, 800)} alt="" />
        </div>
      )}
      <div className="interaction-bar kn-actions">
        <PreviewAction icon="heart" />
        <PreviewAction icon="comment" />
        <PreviewAction icon="share" />
        <PreviewAction icon="save" save />
      </div>
    </div>
  </div>
);

// Cloudflare Images' flexible variant for a smaller copy (like
// views/utils/imageLoading.mjs' sizedImageUrl).
function sizedImageUrl(url, width) {
  return url.replace(/\/public$/, `/w=${width},fit=scale-down,f=auto`);
}

const PostField = (props) => {
  const { text, setText, image, setImage, toast, address, validation } = props;
  const [isUploading, setIsUploading] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!address) return setProfile(null);
    let cancelled = false;
    fetch(`/api/v1/profile/${address}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => !cancelled && json && setProfile(json.data || null))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [address]);

  const handlePick = (e) => {
    if (address) return;
    // NOTE: Pictures are only for signed-in accounts.
    e.preventDefault();
    toast("Please sign in to add a picture.");
    openOnboarding();
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setIsUploading(true);
    try {
      setImage(await uploadImage(file));
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const showError = text.trim() && validation.error;
  return (
    <>
      <div className="n2-field n2-field-post">
        <label htmlFor="postInput" className="n2-label n2-d">
          Post
        </label>
        <div className={`n2-post-box${showError ? " is-invalid" : ""}`}>
          <textarea
            placeholder="What's on your mind?"
            id="postInput"
            className="n2-post-textarea"
            rows="4"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-invalid={showError ? "true" : "false"}
            aria-describedby="postHint"
          />
          {image && (
            <div className="n2-post-thumb">
              <img src={sizedImageUrl(image, 240)} alt="Your picture" />
              <button
                type="button"
                className="n2-post-thumb-remove"
                aria-label="Remove picture"
                onClick={() => setImage(null)}
              >
                ×
              </button>
            </div>
          )}
          <div className="n2-post-tools">
            <input
              type="file"
              id="postImageUpload"
              accept="image/*"
              onChange={handleUpload}
              disabled={Boolean(image) || isUploading}
              style={{ display: "none" }}
            />
            <label
              htmlFor="postImageUpload"
              className="n2-post-add"
              aria-disabled={image || isUploading ? "true" : "false"}
              onClick={handlePick}
            >
              <AddPhotoSVG />
              {isUploading ? "Uploading…" : "Add image"}
              <span className="n2-post-add-count">{image ? 1 : 0}/1</span>
            </label>
            <CounterRing
              count={validation.count}
              remaining={validation.remaining}
            />
          </div>
        </div>
        <div className="n2-hint-row">
          <span
            id="postHint"
            className={`n2-hint${showError ? " n2-hint-error" : ""}`}
          >
            {showError
              ? validation.error
              : "Links work. The picture shows under your text."}
          </span>
        </div>
      </div>
      {text.trim() && (
        <div className="n2-preview-wrap n2-post-preview-wrap">
          <div className="n2-eyebrow">
            Preview <span className="n2-eyebrow-note">how it will look in the feed</span>
          </div>
          <PostPreview
            text={normalizeText(text)}
            image={image}
            profile={profile}
          />
        </div>
      )}
    </>
  );
};

const UrlInput = (props) => {
  const { url, setURL, toast, isPostMode, setIsPostMode } = props;
  const [checkedURLs, setCheckedURLs] = useState(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const address = useSignedInAddress();

  useEffect(() => {
    if (
      !checkedURLs.has(url) &&
      (url.includes("http") || url.includes("https")) &&
      !isPostMode
    ) {
      fetchMetadata(url);
    }
  }, [url, isPostMode]);

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

  // The Link tab's picture story: the uploaded picture is the link.
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setIsUploading(true);
    try {
      setURL(await uploadImage(file));
      toast.success("Image uploaded successfully");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Error uploading image: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // NOTE: The page's heading, subtitle, tips and layout differ between the
  // Link and Post tabs (views/submit.mjs, public/pages.css).
  useEffect(() => {
    document
      .querySelector(".n2-submit")
      ?.classList.toggle("is-post", isPostMode);
    document
      .getElementById("n2-submit-form")
      ?.classList.toggle("is-post", isPostMode);
    try {
      const params = new URLSearchParams(window.location.search);
      if (isPostMode) params.set("tab", "post");
      else params.delete("tab");
      const query = params.toString();
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + (query ? `?${query}` : ""),
      );
    } catch {}
  }, [isPostMode]);

  return (
    <>
      <div className="n2-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={!isPostMode}
          className={`n2-tab${!isPostMode ? " is-active" : ""}`}
          onClick={() => setIsPostMode(false)}
        >
          Link
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isPostMode}
          className={`n2-tab${isPostMode ? " is-active" : ""}`}
          onClick={() => setIsPostMode(true)}
        >
          Post
        </button>
      </div>

      {/* Link Tab Content */}
      <div
        className="n2-field n2-field-link"
        style={{ display: !isPostMode ? undefined : "none" }}
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
        style={{ display: !isPostMode ? undefined : "none" }}
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

      {isPostMode && <PostField {...props} address={address} />}
    </>
  );
};

// NOTE: Phosphor "image".
const AddPhotoSVG = () => (
  <svg
    className="n2-icon"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,16V158.75l-26.07-26.06a16,16,0,0,0-22.63,0l-20,20-44-44a16,16,0,0,0-22.62,0L40,149.37V56ZM40,172l52-52,80,80H40Zm176,28H194.63l-36-36,20-20L216,181.38V200ZM144,100a12,12,0,1,1,12,12A12,12,0,0,1,144,100Z" />
  </svg>
);


const SubmitButton = (props) => {
  const { toast, isPostMode, post } = props;
  // NOTE: In the Post tab the href and title come from the text and picture
  // (post.mjs); there's no title field.
  const url = isPostMode ? post.href : props.url;
  const [isLoading, setIsLoading] = useState(false);
  const [titleField, setTitle] = useState("");
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
    if (isPostMode && !post.ok) {
      toast.error(post.error);
      setIsLoading(false);
      return;
    }
    const title = isPostMode ? post.title : titleField;
    // Check for emojis in the title (a post's title is cut from its text,
    // which may have emojis)
    const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
    if (!isPostMode && emojiRegex.test(title)) {
      toast.error("Emojis are not allowed in the title.");
      setIsLoading(false);
      return;
    }

    const value = API.messageFab(
      title.replace(/(\r\n|\n|\r)/gm, " "),
      canonicalURL,
    );

    if ([...title].length > 80 || canonicalURL.length > 2048) {
      toast.error(
        "The title should be no more than 80 characters, and the URL should be no more than 2048 characters.",
      );
      setIsLoading(false);
      return;
    }
    if (title.length === 0) {
      toast.error(isPostMode ? "Write something to post." : "Please add a title.");
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
        isPostMode
          ? "You've posted this already, redirecting..."
          : "You've voted on this link already earlier, redirecting...",
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
            (isPostMode
              ? !post.ok
              : titleField.length > 80 ||
                url.length > 2048 ||
                titleField.length === 0 ||
                url.length === 0 ||
                (!url.startsWith("https://") &&
                  !url.startsWith("http://") &&
                  !url.startsWith("data:text/plain,")))
          }
        >
          {isLoading
            ? !localAccount
              ? "Please confirm signature..."
              : isPostMode
                ? "Posting..."
                : "Submitting..."
            : isPostMode
              ? "Post"
              : "Submit"}
        </button>
        <span className="n2-note n2-d">
          {isPostMode
            ? "Your post is signed with your account and is public."
            : "Your submission is signed with your account and is public."}
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
  const [isPostMode, setIsPostMode] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("tab") === "post";
    } catch {
      return false;
    }
  });
  const [postText, setPostText] = useState("");
  const [postImage, setPostImage] = useState(null);
  const post = validatePost(postText, postImage);
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
          <UrlInput
            url={url}
            setURL={setURL}
            toast={toast}
            isPostMode={isPostMode}
            setIsPostMode={setIsPostMode}
            text={postText}
            setText={setPostText}
            image={postImage}
            setImage={setPostImage}
            validation={post}
          />
          <SubmitButton
            {...props}
            url={url}
            isPostMode={isPostMode}
            post={post}
          />
        </RainbowKitProvider>
      </KiwiWagmiProvider>
    </QueryClientProvider>
  );
};

export default Form;
