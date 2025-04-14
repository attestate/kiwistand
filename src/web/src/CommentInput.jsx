import { useState, useEffect, useRef, useCallback } from "react";
import posthog from "posthog-js";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiConfig, useAccount } from "wagmi";
import { Wallet } from "@ethersproject/wallet";
import { eligible } from "@attestate/delegator2";
import Drawer from "react-bottom-drawer";
import slugify from "slugify";
import DOMPurify from "isomorphic-dompurify";

import * as API from "./API.mjs";
import { getLocalAccount } from "./session.mjs";
import { client, chains, useProvider, useSigner } from "./client.mjs";
import { resolveAvatar } from "./Avatar.jsx";

// Configure slugify extension
slugify.extend({ "′": "", "'": "", "'": "" });

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
  return (
    <div
      className="site-explainer"
      style={{
        padding: "12px",
        marginBottom: "1rem",
        backgroundColor: "var(--middle-beige)",
        border: "var(--border)",
        borderRadius: "2px",
      }}
    >
      <p
        style={{
          fontSize: "11pt",
          margin: "0 0 8px 0",
          color: "#666",
        }}
      >
        Kiwi is Ethereum Hacker News, built for handpicked, long-form content
        and deep discussions.
      </p>

      <p
        style={{
          fontSize: "11pt",
          margin: "0 0 12px 0",
          color: "#666",
        }}
      >
        Want to leave a comment, upvote this link or join our community of 500+
        Ethereum builders?
      </p>

      <a href="/kiwipass-mint">
        <button
          style={{
            padding: "6px 12px",
            background: "black",
            color: "white",
            border: "var(--border)",
            borderRadius: "2px",
            cursor: "pointer",
            fontSize: "10pt",
          }}
        >
          Sign up
        </button>
      </a>
    </div>
  );
};

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
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
        backgroundColor: "white",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        width: "100%",
        overflow: "hidden",
        touchAction: "none",
        overscrollBehavior: "none",
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
          backgroundColor: "white",
          zIndex: 2,
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
          }}
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={isLoading}
          style={{
            background: "black",
            color: "white",
            border: "none",
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
          color: "#666",
          position: "sticky",
          bottom: 0,
          backgroundColor: "white",
          zIndex: 2,
        }}
      >
        {(characterLimit - text.length).toLocaleString()} characters remaining
      </div>
    </div>
  );
};

const CommentInput = (props) => {
  const { toast, allowlist, delegations } = props;

  let address;
  const account = useAccount();
  const localAccount = getLocalAccount(account.address, allowlist);
  if (account.isConnected) {
    address = account.address;
  }
  if (localAccount) {
    address = localAccount.identity;
  }

  const provider = useProvider();
  const result = useSigner();

  const [isEligible, setIsEligible] = useState(null);
  const [preResolvedAvatar, setPreResolvedAvatar] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      const result =
        signer && eligible(allowlist, delegations, await signer.getAddress());
      setIsEligible(result);
    };
    loadData();
  });
  
  // Pre-resolve avatar for optimistic UI updates
  useEffect(() => {
    async function fetchAvatar() {
      if (address) {
        const resolved = await resolveAvatar(address);
        setPreResolvedAvatar(resolved);
      }
    }
    fetchAvatar();
  }, [address]);

  let signer;
  if (localAccount && localAccount.privateKey) {
    signer = new Wallet(localAccount.privateKey, provider);
  } else {
    signer = result;
  }

  function getIndex() {
    return props.storyIndex;
  }

  const existingComment = localStorage.getItem(
    `-kiwi-news-comment-${address}-${getIndex()}`,
  );
  const [text, setText] = useState(existingComment || "");
  const [showMobileComposer, setShowMobileComposer] = useState(false);
  const [disableAutoOpen, setDisableAutoOpen] = useState(false);
  const isMobile = useIsMobile();
  useEffect(() => {
    localStorage.setItem(`-kiwi-news-comment-${address}-${getIndex()}`, text);
  }, [text]);

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
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const index = getIndex();

    const validMiladyTexts = ["Milady.", "milady.", "milady", "Milady"];
    const isValidMilady = validMiladyTexts.includes(text);
    if ((text.length < 15 || text.length > 10_000) && !isValidMilady) {
      toast.error("Comment must be between 15 and 10000 characters.");
      setIsLoading(false);
      return;
    }
    
    // Create message with a timestamp
    const type = "comment";
    const value = API.messageFab(text, `kiwi:${index}`, type);
    
    // Use toDigest to calculate the actual ID that will be used on the server
    const digestResult = API.toDigest(value);
    const commentId = digestResult.index;
    
    // Create the new comment object
    const newComment = {
      index: commentId,
      title: text,
      identity: {
        address: address,
        displayName: localAccount.displayName || truncateName(address),
        safeAvatar: preResolvedAvatar // Include the pre-resolved avatar
      },
      timestamp: value.timestamp,
      reactions: []
    };
    
    // Add to UI immediately
    props.setComments([...props.comments, newComment]);
    
    // Clear input
    setText("");
    localStorage.removeItem(`-kiwi-news-comment-${address}-${index}`);
    
    if (showMobileComposer) {
      setShowMobileComposer(false);
    }
    
    try {
      // Sign and send in background
      const signature = await signer._signTypedData(
        API.EIP712_DOMAIN,
        API.EIP712_TYPES,
        value,
      );
      
      // Fire and forget API call
      API.send(value, signature, false);
      toast.success("Comment added successfully!");
      posthog.capture("comment_created");
    } catch (err) {
      console.error(err);
      toast.error(`Error: ${err.message}`);
    }
    
    setIsLoading(false);
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

  if (!isEligible) return <SiteExplainer />;
  return (
    <div
      style={{
        margin: "0 1rem 1rem 1rem",
        ...props.style,
      }}
    >
      {showMobileComposer && isMobile ? (
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
        />
      ) : (
        <>
          <textarea
            ref={textareaRef}
            onFocus={(e) => {
              if (isMobile) {
                if (disableAutoOpen) return;
                e.preventDefault();
                setShowMobileComposer(true);
              } else {
                toggleNavigationItems();
              }
            }}
            onBlur={!isMobile ? toggleNavigationItems : undefined}
            rows="12"
            cols="80"
            style={{
              display: "block",
              width: "100%",
              border: "var(--border)",
              fontSize: "1rem",
              borderRadius: "2px",
              resize: "vertical",
            }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isLoading || !address || !isEligible}
          ></textarea>
          <span>
            Characters remaining:{" "}
            {(characterLimit - text.length).toLocaleString()}
          </span>
          <br />
          <br />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <button
              id="button-onboarding"
              style={{ marginBottom: "10px", width: "auto" }}
              disabled={isLoading || !address || !isEligible}
              onClick={handleSubmit}
            >
              {isLoading ? "Submitting..." : "Add comment"}
            </button>
            <CommentGuidelines />
          </div>
        </>
      )}
    </div>
  );
};

const CommentGuidelines = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Drawer
        className="drawer"
        isVisible={open}
        onClose={() => setOpen(false)}
      >
        <h4>What comments are we looking for?</h4>
        <ol>
          <li>
            <strong>Extra Context: </strong>
            Explain why you think the story is interesting.
          </li>
          <br />
          <li>
            <strong>Insider's perspective: </strong>
            Have you been involved? What was <i>your</i> experience?
          </li>
          <br />
          <li>
            <strong>Debunks: </strong>
            Do you believe the material is false or misleading? Tell us why!
          </li>
          <br />
          <li>
            <strong>Impact on you: </strong>
            How were you impacted?
          </li>
          <br />
          <li>
            <strong>Questions: </strong>
            Ask for more information.
          </li>
          <br />
        </ol>
      </Drawer>
      <span
        className="meta-link drawer-link"
        style={{ fontSize: "0.8rem" }}
        onClick={() => setOpen(true)}
      >
        comment guidelines
      </span>
    </>
  );
};

const Container = (props) => {
  return (
    <WagmiConfig config={client}>
      <RainbowKitProvider chains={chains}>
        <CommentInput {...props} />
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default Container;
