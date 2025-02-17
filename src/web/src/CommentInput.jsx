import { useState, useEffect, useRef, useCallback } from "react";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiConfig, useAccount } from "wagmi";
import { Wallet } from "@ethersproject/wallet";
import { eligible } from "@attestate/delegator2";
import Drawer from "react-bottom-drawer";

import * as API from "./API.mjs";
import { getLocalAccount } from "./session.mjs";
import { client, chains, useProvider, useSigner } from "./client.mjs";

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
    window.visualViewport ? window.visualViewport.height : window.innerHeight
  );
  useEffect(() => {
    function updateHeight() {
      setViewportHeight(
        window.visualViewport ? window.visualViewport.height : window.innerHeight
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
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: "white",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: viewportHeight,
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

  useEffect(() => {
    const loadData = async () => {
      const result =
        signer && eligible(allowlist, delegations, await signer.getAddress());
      setIsEligible(result);
    };
    loadData();
  });

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

    function preventTouch(e) {
      // Only prevent if the target is not the textarea
      if (showMobileComposer && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
      }
    }
    document.addEventListener("touchmove", preventTouch, { passive: false });
    return () => {
      document.removeEventListener("touchmove", preventTouch);
    };
  }, [showMobileComposer]);


  const [isLoading, setIsLoading] = useState(false);
  const handleSubmit = async (e) => {
    setIsLoading(true);
    e.preventDefault();
    const index = getIndex();

    const validMiladyTexts = ["Milady.", "milady.", "milady", "Milady"];
    const isValidMilady = validMiladyTexts.includes(text);
    if ((text.length < 15 || text.length > 10_000) && !isValidMilady) {
      toast.error("Comment must be between 15 and 10000 characters.");
      setIsLoading(false);
      return;
    }
    const type = "comment";
    const value = API.messageFab(text, `kiwi:${index}`, type);

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

    const wait = false;
    const response = await API.send(value, signature, wait);
    if (response && response.status === "error") {
      toast.error("Failed to submit your comment.");
      return;
    }

    // NOTE: We fetch the current page here in JavaScript to (hopefully)
    // produce a cache revalidation that then makes the new comment fastly
    // available to all other users.
    const path = `/stories?index=${getIndex()}`;
    fetch(path);
    toast.success("Thanks for submitting your comment. Reloading...");
    localStorage.removeItem(`-kiwi-news-comment-${address}-${getIndex()}`);

    const nextPage = new URL(path, window.location.origin);
    if (response?.data?.index) {
      nextPage.searchParams.set("cachebuster", response.data.index);
      nextPage.hash = `#${response.data.index}`;
    }
    window.location.href = nextPage.href;
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
      if (e.key !== "r") return;

      const selection = window.getSelection();
      const selected = selection.toString().trim();
      if (!selected || !address || !isEligible) return;

      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const quote =
        selected
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n") + "\n\n";

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
