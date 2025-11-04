import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import posthog from "posthog-js";
import { RainbowKitProvider, useConnectModal } from "@rainbow-me/rainbowkit";
import { WagmiProvider, useAccount } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Wallet } from "@ethersproject/wallet";
import { resolveIdentity } from "@attestate/delegator2";
import slugify from "slugify";
import DOMPurify from "isomorphic-dompurify";
import { sdk } from "@farcaster/frame-sdk";

import * as API from "./API.mjs";
import { getLocalAccount } from "./session.mjs";
import { chains, client, useProvider, useSigner, useIsMiniApp, isInIOSApp } from "./client.mjs";
import { resolveAvatar } from "./Avatar.jsx";
import { openDelegationModalForAction, isDelegationModalNeeded } from "./delegationModalManager.js";
import LoginModal from "./LoginModal.jsx";

// Configure slugify extension
slugify.extend({ "′": "", "'": "" });

// Implement getSlug exactly as in src/utils.mjs
export function getSlug(title) {
  return slugify(DOMPurify.sanitize(title));
}

function truncateName(name) {
  const maxLength = 12;
  if (
    !name ||
    (name && name.length <= maxLength) ||
    (name && name.length === 0)
  )
    return name;
  return name.slice(0, maxLength) + "...";
}

const SiteExplainer = () => {
  const loginModalRef = useRef();
  const { openConnectModal } = useConnectModal();

  const handleConnect = (e) => {
    e.preventDefault();
    // On iOS, directly open RainbowKit wallet picker
    if (isInIOSApp && openConnectModal) {
      openConnectModal();
    } else {
      // On other platforms, show the LoginModal with passkey option
      loginModalRef.current?.openModal();
    }
  };

  return (
    <div
      className="site-explainer"
      style={{
        padding: "0.75rem",
        marginTop: "1rem",
        marginBottom: "1rem",
        backgroundColor: "var(--middle-beige)",
        borderRadius: "2px",
        border: "var(--border)",
      }}
    >
      <p
        style={{
          fontSize: "11pt",
          margin: "0 0 12px 0",
          color: "var(--text-tertiary)",
        }}
      >
        Want to leave a comment, like this link or join our community of 500+
        hackers and builders?
      </p>

      <button
        onClick={handleConnect}
        style={{
          padding: "6px 12px",
          background: "var(--button-primary-bg)",
          color: "var(--button-primary-text)",
          border: "1px solid var(--button-primary-bg)",
          borderRadius: "2px",
          cursor: "pointer",
          fontSize: "10pt",
        }}
      >
        Connect to comment
      </button>

      <LoginModal
        ref={loginModalRef}
        allowPasskeyLogin={true}
        allowEmailLogin={false}
      />
    </div>
  );
};

const useIsMobile = () => {
  const compute = () =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false;
  const [isMobile, setIsMobile] = useState(compute);

  useEffect(() => {
    const onResize = () => setIsMobile(compute());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return isMobile;
};

const MobileComposer = ({
  text,
  setText,
  onSubmit,
  onCancel,
  isLoading,
  characterLimit,
  isMiniApp,
}) => {
  const [viewportHeight, setViewportHeight] = useState(
    window.visualViewport ? window.visualViewport.height : window.innerHeight,
  );
  useEffect(() => {
    function updateHeight() {
      setViewportHeight(
        window.visualViewport
          ? window.visualViewport.height
          : window.innerHeight,
      );
    }
    updateHeight();
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateHeight);
    } else {
      window.addEventListener("resize", updateHeight);
    }
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateHeight);
      } else {
        window.removeEventListener("resize", updateHeight);
      }
    };
  }, []);
  return (
    <>
      {/* Solid white backdrop to prevent bleed-through */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "var(--bg-white)",
          zIndex: 998,
        }}
      />
      <div
        onTouchMove={(e) => {
          if (!e.target.closest("textarea")) {
            e.preventDefault();
          }
        }}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "var(--bg-white)",
          zIndex: 999,
          display: "flex",
          flexDirection: "column",
          width: "100%",
          overflow: "hidden",
          touchAction: "none",
          overscrollBehavior: "none",
          isolation: "isolate",
        }}
      >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1rem",
          borderBottom: "var(--border)",
          position: "sticky",
          top: 0,
          backgroundColor: "var(--bg-white)",
          zIndex: 1000,
        }}
      >
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
            document.activeElement && document.activeElement.blur();
          }}
          style={{
            background: "none",
            border: "none",
            fontSize: "1rem",
            cursor: "pointer",
            color: "var(--text-primary)",
          }}
        >
          Cancel
        </button>
        <button
          onClick={async (e) => {
              // Add haptic feedback for comment submission only in frames
              if (isMiniApp) {
                try {
                  await sdk.haptics.impactOccurred("light");
                } catch (error) {
                  // Silently fail if haptics not supported
                }
              }

              onSubmit(e);
            }}
          disabled={isLoading}
          style={{
            background: "var(--button-primary-bg)",
            color: "var(--button-primary-text)",
            border: "1px solid var(--button-primary-bg)",
            padding: "0.5rem 1rem",
            borderRadius: "2px",
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          {isLoading ? "Submitting..." : "Submit"}
        </button>
      </div>
      <textarea
        autoFocus
        onPaste={(e) => {
          setTimeout(() => {
            setText(e.target.value);
          }, 0);
        }}
        style={{
          flex: 1,
          border: "none",
          padding: "1rem",
          fontSize: "1rem",
          resize: "none",
          outline: "none",
          width: "100%",
          height: "100%",
          overflowY: "auto",
          touchAction: "auto",
          backgroundColor: "var(--bg-white)",
          color: "var(--text-primary)",
        }}
        onTouchMove={(e) => e.stopPropagation()}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div
        style={{
          padding: "0.5rem 1rem",
          borderTop: "var(--border)",
          fontSize: "0.8rem",
          color: "var(--text-tertiary)",
          position: "sticky",
          bottom: 0,
          backgroundColor: "var(--bg-white)",
          zIndex: 1000,
        }}
      >
        {(characterLimit - text.length).toLocaleString()} characters remaining
      </div>
    </div>
    </>
  );
};

const CommentInput = (props) => {
  const { toast, delegations } = props;
  const { isMiniApp, loading } = useIsMiniApp();

  let address;
  const account = useAccount();
  const localAccount = getLocalAccount(account.address);
  if (account.isConnected) {
    address = account.address;
  }
  if (localAccount) {
    address = localAccount.identity;
  }

  const provider = useProvider();
  const result = useSigner();

  let signer;
  if (localAccount && localAccount.privateKey) {
    signer = new Wallet(localAccount.privateKey, provider);
  } else {
    signer = result;
  }

  const [isEligible, setIsEligible] = useState(null);
  const [preResolvedAvatar, setPreResolvedAvatar] = useState(null);
  const [preResolvedName, setPreResolvedName] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      if (!signer || !address) {
        setIsEligible(false);
        return;
      }
      const result = resolveIdentity(delegations, await signer.getAddress());
      setIsEligible(result);
    };
    loadData();
  }, [signer, address, delegations]);
  
  // Pre-resolve profile (name and avatar) for optimistic UI updates
  useEffect(() => {
    async function fetchProfile() {
      if (address) {
        // Set initial fallback state immediately
        setPreResolvedName(truncateName(address));
        setPreResolvedAvatar(null);
        try {
          const response = await fetch(`/api/v1/profile/${address}`);
          // Check if the request was successful
          if (!response.ok) {
             // Log HTTP errors but keep the fallback state
             console.error(`HTTP error fetching profile! status: ${response.status}`);
             // No state change needed here, fallback is already set
             return;
          }
          const result = await response.json();
          // Check if the API call itself was successful
          if (result.status === 'success' && result.data) {
            const profile = result.data;
            // Update state with fetched data, keeping fallback if data is missing
            setPreResolvedName(profile.displayName || truncateName(address));
            setPreResolvedAvatar(profile.safeAvatar || null);
          } else {
            // Log API errors but keep the fallback state
            console.error("API error fetching profile:", result.details || 'Unknown API error');
            // No state change needed here, fallback is already set
          }
        } catch (error) {
           // Log network or other fetch errors but keep the fallback state
           console.error("Network/fetch error fetching profile:", error);
           // No state change needed here, fallback is already set
        }
      } else {
        // Clear state if address is not available
        setPreResolvedName(null);
        setPreResolvedAvatar(null);
      }
    }
    fetchProfile();
  }, [address]); // Re-run effect when address changes

  function getIndex() {
    return props.storyIndex;
  }

  const existingComment = localStorage.getItem(
    `-kiwi-news-comment-${address}-${getIndex()}`,
  );
  const [text, setText] = useState(existingComment || "");
  const [showMobileComposer, setShowMobileComposer] = useState(false);
  const [disableAutoOpen, setDisableAutoOpen] = useState(false);
  const [storyTitle, setStoryTitle] = useState(null);
  const isMobile = useIsMobile();
  useEffect(() => {
    localStorage.setItem(`-kiwi-news-comment-${address}-${getIndex()}`, text);
  }, [text]);

  // Fetch story title on component load for slug generation
  useEffect(() => {
    const fetchStoryTitle = async () => {
      try {
        const index = getIndex();
        const storyResponse = await fetch(`/api/v1/stories?index=${index}`);
        if (storyResponse.ok) {
          const storyData = await storyResponse.json();
          if (storyData.data && storyData.data[0] && storyData.data[0].title) {
            setStoryTitle(storyData.data[0].title);
          }
        }
      } catch (err) {
        console.log("Failed to fetch story title for slug generation");
      }
    };

    fetchStoryTitle();
  }, []);


  useEffect(() => {
    if (showMobileComposer) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }

    function preventScroll(e) {
      if (!showMobileComposer) return;

      // Stop propagation to prevent underlying page from scrolling.
      e.stopPropagation();

      // For touchmove events inside a textarea (e.g. selection handles), allow native behavior.
      if (e.type === "touchmove" && e.target.closest("textarea")) {
        return;
      }

      if (e.target.closest("textarea")) {
        const textarea = e.target.closest("textarea");
        // Prevent scrolling if the textarea is empty.
        if (textarea.value.trim() === "") {
          e.preventDefault();
          return;
        }
        if (e.type === "wheel") {
          const isScrollable = textarea.scrollHeight > textarea.clientHeight;
          const isAtTop = textarea.scrollTop === 0;
          const isAtBottom =
            textarea.scrollTop + textarea.clientHeight ===
            textarea.scrollHeight;

          // Prevent scroll if content fits or we're at the bounds.
          if (
            !isScrollable ||
            (isAtTop && e.deltaY < 0) ||
            (isAtBottom && e.deltaY > 0)
          ) {
            e.preventDefault();
          }
        }
      } else {
        e.preventDefault();
      }
    }

    // Handle both touch and mouse wheel events
    document.addEventListener("touchmove", preventScroll, {
      passive: false,
      capture: true,
    });
    document.addEventListener("wheel", preventScroll, {
      passive: false,
      capture: true,
    });

    return () => {
      document.removeEventListener("touchmove", preventScroll, {
        capture: true,
      });
      document.removeEventListener("wheel", preventScroll, { capture: true });
    };
  }, [showMobileComposer]);

  const [isLoading, setIsLoading] = useState(false);
  
  // Hide SSR placeholder once React mounts to avoid overlap/flash
  useEffect(() => {
    const placeholder = document.querySelector(
      ".comment-input-ssr-placeholder",
    );
    if (placeholder) {
      placeholder.style.display = "none";
    }
  }, []);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const index = getIndex();

    // --- Check if delegation is needed ---
    if (address && isDelegationModalNeeded(address)) {
      setIsLoading(false);
      openDelegationModalForAction();
      return;
    }

    // --- Validation ---
    const validMiladyTexts = ["Milady.", "milady.", "milady", "Milady"];
    const isValidMilady = validMiladyTexts.includes(text);
    if ((text.length < 15 || text.length > 10_000) && !isValidMilady) {
      toast.error("Comment must be between 15 and 10000 characters.");
      setIsLoading(false);
      return;
    }

    // --- Message Creation ---
    const type = "comment";
    const value = API.messageFab(text, `kiwi:${index}`, type);

    // --- Conditional Handling ---
    if (props.setComments && typeof props.setComments === 'function') {
      // OPTIMISTIC PATH (Feed Page - CommentSection provides props)

      // Calculate ID locally
      const digestResult = API.toDigest(value);
      const commentId = digestResult.index;

      // Create optimistic comment object
      // Ensure props.comments is treated as an array, even if initially empty
      const currentComments = Array.isArray(props.comments) ? props.comments : [];
      const newComment = {
        index: commentId,
        title: text,
        identity: {
          address: address,
          displayName: preResolvedName, // Use pre-resolved data
          safeAvatar: preResolvedAvatar // Use pre-resolved data
        },
        timestamp: value.timestamp,
        reactions: []
      };

      // Add to UI immediately
      props.setComments([...currentComments, newComment]); // Use currentComments

      // Clear input
      setText("");
      localStorage.removeItem(`-kiwi-news-comment-${address}-${index}`);

      if (showMobileComposer) {
        setShowMobileComposer(false);
      }

      // Sign and send in background (fire-and-forget)
      try {
        const signature = await signer._signTypedData(
          API.EIP712_DOMAIN,
          API.EIP712_TYPES,
          value,
        );
        API.send(value, signature, false); // Fire and forget
        toast.success("Comment added successfully!"); // Confirmation of *sending*
        posthog.capture("comment_created", { variant: getFeedVariant() });
      } catch (err) {
        console.error("Signing/Sending error (optimistic path):", err);
        toast.error(`Error: ${err.message}`);
        // Consider removing the optimistic comment here if signing/initial send fails
      } finally {
         setIsLoading(false);
      }

    } else {
      // RELOAD PATH (Story Page - Standalone mounting, no setComments prop)

      try {
        // Sign the message
        const signature = await signer._signTypedData(
          API.EIP712_DOMAIN,
          API.EIP712_TYPES,
          value,
        );

        // Send and WAIT for server response
        const wait = true; // Wait for server confirmation
        const response = await API.send(value, signature, wait);

        if (response && response.status === "error") {
          toast.error(`Failed to submit comment: ${response.details || 'Unknown server error'}`);
          setIsLoading(false);
          return;
        }

        // Success! Clear local state and reload
        toast.success("Comment submitted successfully!");
        posthog.capture("comment_created", { variant: getFeedVariant() });
        localStorage.removeItem(`-kiwi-news-comment-${address}-${index}`);
        setText(""); // Clear input

        // Construct reload URL using pre-fetched story title
        let path = `/stories?index=${index}`; // fallback
        if (storyTitle) {
          const slug = getSlug(storyTitle);
          path = `/stories/${slug}?index=${index}`;
        }
        
        const nextPage = new URL(path, window.location.origin);
        if (response?.data?.index) {
           // Use the index confirmed by the server
           nextPage.hash = `#${response.data.index}`; // Only add #, index already has 0x
        }
        window.location.href = nextPage.href; // Perform reload/redirect

        // No need to call setIsLoading(false) here as the page reloads

      } catch (err) {
        console.error("Signing/Sending error (reload path):", err);
        toast.error(`Error: ${err.message}`);
        setIsLoading(false);
      }
    }
  };

  const characterLimit = 10_000;

  function toggleNavigationItems() {
    toggleElement(".submit-button", "block");
    toggleElement(".bottom-nav", "flex");
  }

  function toggleElement(name, defaultDisplay) {
    const button = document.querySelector(name);
    if (!button) return;

    const { display } = button.style;

    if (display === "none") {
      button.style.display = defaultDisplay;
    } else if (display === defaultDisplay || display === "") {
      button.style.display = "none";
    }
  }
  const textareaRef = useRef(null);
  
  // Auto-focus the textarea when component mounts (desktop only, and only if no existing comments)
  useEffect(() => {
    // Only auto-focus on desktop when there are no existing comments
    const hasNoComments = !props.comments || props.comments.length === 0;
    
    if (!isMobile && hasNoComments && textareaRef.current && address && isEligible) {
      // Small delay to ensure smooth rendering
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 100);
    }
  }, [isMobile, address, isEligible, props.comments]);
  
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (
        document.activeElement &&
        document.activeElement.tagName === "TEXTAREA"
      )
        return;
      if (e.key !== "r") return;

      const selection = window.getSelection();
      const selected = selection.toString().trim();
      if (!selected || !address || !isEligible) return;

      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = text.slice(0, start);
      const prefix =
        before.length === 0
          ? ""
          : before.endsWith("\n\n")
          ? ""
          : before.endsWith("\n")
          ? "\n"
          : "\n\n";
      const quote =
        prefix +
        selected
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n") +
        "\n\n";

      setText(text.slice(0, start) + quote + text.slice(end));

      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + quote.length;
      }, 0);
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [text, address, isEligible]);

  if (isEligible === false) {
    return (
      <div
        style={{
          margin: "0 1rem 1rem 1rem",
          ...props.style,
        }}
      >
        <SiteExplainer />
      </div>
    );
  }

  return (
    <div
      style={{
        margin: isMobile ? "1rem 1rem 1rem 1rem" : "0 1rem 1rem 1rem",
        ...props.style,
      }}
    >
      {showMobileComposer && isMobile ? (
        createPortal(
          <MobileComposer
            text={text}
            setText={setText}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowMobileComposer(false);
              setDisableAutoOpen(true);
              setTimeout(() => setDisableAutoOpen(false), 300);
            }}
            isLoading={isLoading}
            characterLimit={characterLimit}
            isMiniApp={isMiniApp}
          />,
          document.body,
        )
      ) : (
        <>
          {isMobile ? (
            <div
              onClick={(e) => {
                if (!disableAutoOpen && address && isEligible) {
                  e.preventDefault();

                  // Check if delegation is needed before opening mobile composer
                  if (isDelegationModalNeeded(address)) {
                    openDelegationModalForAction();
                  } else {
                    setShowMobileComposer(true);
                  }
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px",
                borderRadius: "2px",
                backgroundColor: "var(--bg-white)",
                border: "var(--border)",
                cursor: address && isEligible ? "pointer" : "not-allowed",
                opacity: address && isEligible ? 1 : 0.5,
                marginBottom: "10px",
              }}
            >
              <div style={{ width: "32px", height: "32px", flexShrink: 0 }}>
                {preResolvedAvatar ? (
                  <img
                    src={preResolvedAvatar}
                    alt="Your avatar"
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "2px",
                      border: "1px solid var(--text-secondary)",
                      display: "block",
                    }}
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "2px",
                      border: "var(--border-subtle)",
                      backgroundColor: "var(--bg-hover)",
                    }}
                  />
                )}
              </div>
              <span
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "0.9rem",
                  flex: 1,
                }}
              >
                {text ? text.substring(0, 50) + (text.length > 50 ? "..." : "") : "Post your reply"}
              </span>
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              onFocus={(e) => {
                toggleNavigationItems();
              }}
              onBlur={toggleNavigationItems}
              rows="12"
              cols="80"
              style={{
                display: "block",
                width: "100%",
                border: "var(--border)",
                backgroundColor: "var(--bg-white)",
                color: "var(--text-primary)",
                fontSize: "1rem",
                borderRadius: "2px",
                resize: "vertical",
                padding: "10px",
              }}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isLoading || !address || !isEligible}
            ></textarea>
          )}
          {!isMobile && (
            <>
              <span>
                Characters remaining:{" "}
                {(characterLimit - text.length).toLocaleString()}
              </span>
              <br />
              <br />
            </>
          )}
          {!isMobile && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <button
                id="button-onboarding"
                style={{
                  marginBottom: "10px",
                  width: "auto",
                  backgroundColor: "var(--button-primary-bg)",
                  color: "var(--button-primary-text)",
                  border: "1px solid var(--button-primary-bg)"
                }}
                disabled={isLoading || !address || !isEligible}
                onClick={async (e) => {
                  // Add haptic feedback for comment submission only in frames
                  if (isMiniApp) {
                    try {
                      await sdk.haptics.impactOccurred("light");
                    } catch (error) {
                      // Silently fail if haptics not supported
                    }
                  }

                  handleSubmit(e);
                }}
              >
                {isLoading ? "Submitting..." : "Add comment"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};


const queryClient = new QueryClient();

const Container = (props) => {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={client}>
        <RainbowKitProvider chains={chains}>
          <CommentInput {...props} />
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
};

export default Container;
// Helper to read feed variant from meta
function getFeedVariant() {
  try {
    const el = document.querySelector('meta[name="kiwi-variant"]');
    return el?.content || "unknown";
  } catch (_) {
    return "unknown";
  }
}
