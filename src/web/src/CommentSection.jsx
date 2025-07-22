import React, { useRef, useState, useEffect } from "react";
import posthog from "posthog-js";
import { formatDistanceToNowStrict } from "date-fns";
import Linkify from "linkify-react";
import { useAccount, WagmiConfig } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { Wallet } from "@ethersproject/wallet";
import { eligible } from "@attestate/delegator2";

import { useProvider, client, chains } from "./client.mjs";
import CommentInput from "./CommentInput.jsx";
import * as API from "./API.mjs";
import { getLocalAccount, isIOS, isRunningPWA } from "./session.mjs";
import { resolveAvatar } from "./Avatar.jsx";
import { dynamicPrefetch } from "./main.jsx";
import { getSlug } from "./CommentInput.jsx"; // Import getSlug from CommentInput

function ShareIcon(style) {
  return (
    <svg style={style} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
      <rect width="256" height="256" fill="none" />
      <path
        d="M176,104h24a8,8,0,0,1,8,8v96a8,8,0,0,1-8,8H56a8,8,0,0,1-8-8V112a8,8,0,0,1,8-8H80"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="24"
      />
      <polyline
        points="88 64 128 24 168 64"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="24"
      />
      <line
        x1="128"
        y1="24"
        x2="128"
        y2="136"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="24"
      />
    </svg>
  );
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

export const EmojiReaction = ({ comment, allowlist, delegations, toast }) => {
  const [isReacting, setIsReacting] = useState(false);
  const [kiwis, setKiwis] = useState(
    comment.reactions?.find((r) => r.emoji === "🥝")?.reactors || [],
  );
  const [fires, setFires] = useState(
    comment.reactions?.find((r) => r.emoji === "🔥")?.reactors || [],
  );
  const [eyes, setEyes] = useState(
    comment.reactions?.find((r) => r.emoji === "👀")?.reactors || [],
  );
  const [hundreds, setHundreds] = useState(
    comment.reactions?.find((r) => r.emoji === "💯")?.reactors || [],
  );
  const [laughs, setLaughs] = useState(
    comment.reactions?.find((r) => r.emoji === "🤭")?.reactors || [],
  );

  const account = useAccount();
  const localAccount = getLocalAccount(account.address, allowlist);
  const provider = useProvider();

  const commonEmojis = ["🥝", "🔥", "👀", "💯", "🤭"];
  const address = localAccount?.identity;
  const hasReacted =
    address &&
    (kiwis.includes(address) ||
      fires.includes(address) ||
      eyes.includes(address) ||
      hundreds.includes(address) ||
      laughs.includes(address));
  const isntLoggedIn = !localAccount?.identity;

  let signer;
  if (localAccount?.privateKey) {
    signer = new Wallet(localAccount.privateKey, provider);
  }
  const [preResolvedAvatar, setPreResolvedAvatar] = useState(null);
  useEffect(() => {
    async function fetchAvatar() {
      if (signer) {
        const addr = await signer.getAddress();
        const identityResolved = eligible(allowlist, delegations, addr);
        if (identityResolved) {
          const resolved = await resolveAvatar(identityResolved);
          setPreResolvedAvatar(resolved);
          dynamicPrefetch(resolved);
        }
      }
    }
    fetchAvatar();
  }, [signer, allowlist, delegations]);

  const handleReaction = async (emoji) => {
    if (!signer) {
      toast.error("Please connect your wallet first");
      return;
    }

    setIsReacting(true);
    try {
      const address = await signer.getAddress();
      const identity = eligible(allowlist, delegations, address);

      if (!identity) {
        window.location.pathname = "/gateway";
        return;
      }

      const value = API.messageFab(emoji, `kiwi:0x${comment.index}`, "comment");

      const signature = await signer._signTypedData(
        API.EIP712_DOMAIN,
        API.EIP712_TYPES,
        value,
      );

      // Optimistically update UI with reaction immediately using pre-resolved avatar if available
      const resolvedAvatar =
        preResolvedAvatar || (await resolveAvatar(identity));
      const existingReaction = comment.reactions.find(
        (r) => r.emoji === emoji && Array.isArray(r.reactorProfiles),
      );
      if (existingReaction) {
        existingReaction.reactorProfiles.push({
          address: identity,
          safeAvatar: resolvedAvatar,
        });
      } else {
        comment.reactions.push({
          emoji,
          reactorProfiles: [{ address: identity, safeAvatar: resolvedAvatar }],
        });
      }

      switch (emoji) {
        case "🥝":
          setKiwis([...kiwis, identity]);
          break;
        case "🔥":
          setFires([...fires, identity]);
          break;
        case "👀":
          setEyes([...eyes, identity]);
          break;
        case "💯":
          setHundreds([...hundreds, identity]);
          break;
        case "🤭":
          setLaughs([...laughs, identity]);
          break;
      }

      // Send reaction in background
      const response = await API.send(value, signature);
      if (response.status === "success") {
        toast.success("Reaction added!");
        posthog.capture("emoji_reaction", {
          emoji: emoji,
        });
      } else {
        toast.error(response.details || "Failed to add reaction");
      }
    } catch (err) {
      console.error("Reaction error:", err);
      toast.error("Failed to add reaction");
    } finally {
      setIsReacting(false);
    }
  };

  // Don't allow reacting to your own comments, but do show reactions you've received
  const isOwnComment = comment.identity.address === address;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        marginTop: "12px",
      }}
    >
      {commonEmojis.map((emoji) => {
        const counts = {
          "🥝": kiwis.length,
          "🔥": fires.length,
          "👀": eyes.length,
          "💯": hundreds.length,
          "🤭": laughs.length,
        };
        const profiles = {
          "🥝":
            comment.reactions?.find((r) => r.emoji === "🥝")?.reactorProfiles ||
            [],
          "🔥":
            comment.reactions?.find((r) => r.emoji === "🔥")?.reactorProfiles ||
            [],
          "👀":
            comment.reactions?.find((r) => r.emoji === "👀")?.reactorProfiles ||
            [],
          "💯":
            comment.reactions?.find((r) => r.emoji === "💯")?.reactorProfiles ||
            [],
          "🤭":
            comment.reactions?.find((r) => r.emoji === "🤭")?.reactorProfiles ||
            [],
        };

        const disabled = isReacting || hasReacted || isOwnComment;

        // Show reaction if there are reactions to display
        // Don't show empty reaction buttons on your own comments
        if (counts[emoji] === 0 && (isntLoggedIn || hasReacted || isOwnComment)) return null;

        return (
          <button
            key={emoji}
            onClick={() => !disabled && handleReaction(emoji)}
            disabled={disabled || isntLoggedIn}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "4px 12px",
              backgroundColor:
                disabled || isntLoggedIn ? "#f3f3f3" : "var(--bg-off-white)",
              border:
                disabled || isntLoggedIn
                  ? "1px solid rgba(0,0,0,0)"
                  : "var(--border-thin)",
              borderRadius: "2px",
              cursor: disabled || isntLoggedIn ? "default" : "pointer",
              color: disabled || isntLoggedIn ? "black" : "auto",
              fontSize: "10pt",
              WebkitAppearance: "none",
              opacity: 1,
              filter: "none",
            }}
          >
            <span style={{ marginRight: counts[emoji] > 0 ? "4px" : "0" }}>
              {emoji}
            </span>
            {profiles[emoji]
              .filter(profile => profile.safeAvatar)
              .map((profile, i) => (
                <img
                  key={i}
                  loading="lazy"
                  src={profile.safeAvatar}
                  alt="reactor"
                  style={{
                    zIndex: i,
                    width: i > 0 ? "13px" : "12px",
                    height: i > 0 ? "13px" : "12px",
                    borderRadius: "2px",
                    border: i > 0 ? "1px solid #f3f3f3" : "1px solid #828282",
                    marginLeft: i > 0 ? "-4px" : 0,
                  }}
                />
              ))}
          </button>
        );
      })}
    </div>
  );
};

function NotificationOptIn(props) {
  const account = useAccount();
  const localAccount = getLocalAccount(account.address, props.allowlist);
  const provider = useProvider();
  const [identity, setIdentity] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isMiniApp, setIsMiniApp] = useState(false);

  useEffect(() => {
    async function init() {
      if (!localAccount || !account) {
        setIdentity(null);
        return;
      }

      const s = new Wallet(localAccount.privateKey, provider);
      setSigner(s);

      const addr = await s.getAddress();
      const isEligible =
        addr && (await eligible(props.allowlist, props.delegations, addr));

      setIdentity(isEligible);
    }

    init();
  }, [account?.account]);

  useEffect(() => {
    async function checkMiniApp() {
      try {
        const miniAppStatus = await window.sdk?.isInMiniApp();
        setIsMiniApp(miniAppStatus);
      } catch (error) {
        setIsMiniApp(false);
      }
    }
    checkMiniApp();
  }, []);

  if (!identity || isMiniApp) return null;
  return (
    <div
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
        Get email notifications when someone replies to your comments or
        submissions
      </p>

      <EmailNotificationLink {...props} />
    </div>
  );
}

const EmailNotificationLink = (props) => {
  const [status, setStatus] = useState("");
  const [email, setEmail] = useState("");
  const account = useAccount();
  const localAccount = getLocalAccount(account.address, props.allowlist);
  const provider = useProvider();
  const identity =
    account.address &&
    localAccount?.address &&
    eligible(props.allowlist, props.delegations, localAccount.address);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Submit triggered");
    setStatus("sending");

    const value = API.messageFab(email, email, "EMAILAUTH");

    let signature;
    try {
      const signer = new Wallet(localAccount.privateKey, provider);
      signature = await signer._signTypedData(
        API.EIP712_DOMAIN,
        API.EIP712_TYPES,
        value,
      );
    } catch (err) {
      console.error("Signing failed:", err);
      setStatus("error");
      return;
    }

    const wait = null;
    const endpoint = "/api/v1/email-notifications";
    const port = window.location.port;

    try {
      const response = await API.send(value, signature, wait, endpoint, port);
      if (response.status === "success") {
        setStatus("success");
        setEmail("");
      } else {
        console.error("API error:", response.details);
        setStatus("error");
      }
    } catch (err) {
      console.error("Network request failed:", err);
      setStatus("error");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        gap: "8px",
      }}
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        style={{
          flex: 1,
          padding: "6px 8px",
          border: "var(--border-thin)",
          borderRadius: "2px",
          fontSize: "10pt",
        }}
        required
      />
      <button
        type="submit"
        disabled={status === "sending" || !localAccount}
        style={{
          padding: "6px 12px",
          background: status === "sending" ? "#828282" : "black",
          color: "white",
          border: "var(--border)",
          borderRadius: "2px",
          cursor: "pointer",
          fontSize: "10pt",
        }}
      >
        {status === "sending" ? "Subscribing..." : "Subscribe"}
      </button>
    </form>
  );
};

const Comment = React.forwardRef(
  ({ comment, storyIndex, storyTitle, allowlist, delegations, toast }, ref) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const toggleCollapsed = (e) => {
      if (e.target.closest("a")) {
        return;
      }
      setIsCollapsed((v) => !v);
    };

    const [isTargeted, setIsTargeted] = useState(
      window.location.hash === `#0x${comment.index}`,
    );

    // Generate proper slug URL if we have the story title, otherwise fallback
    const url = storyTitle 
      ? `${window.location.origin}/stories/${getSlug(storyTitle)}?index=${storyIndex}#0x${comment.index}`
      : `${window.location.origin}/stories?index=${storyIndex}#0x${comment.index}`;
    const handleShare = async (e) => {
      e.preventDefault();
      try {
        await navigator.share({ url });
      } catch (err) {
        if (err.name !== "AbortError") console.error(err);
      }
    };

    useEffect(() => {
      const handleHashChange = () => {
        setIsTargeted(window.location.hash === `#0x${comment.index}`);
      };

      window.addEventListener("hashchange", handleHashChange);
      return () => window.removeEventListener("hashchange", handleHashChange);
    }, [comment.index]);

    return (
      <span
        ref={ref}
        style={{
          boxShadow: isTargeted
            ? "0 0 0 2px rgb(175, 192, 70)"
            : undefined,
          color: "black",
          border: "var(--border)",
          backgroundColor: isTargeted ? "#fefef8" : "var(--bg-off-white)",
          padding: `0.75rem`,
          borderRadius: "2px",
          display: "block",
          marginBottom: "12px",
          whiteSpace: "pre-wrap",
          lineHeight: "1.2",
          wordBreak: "break-word",
          overflowWrap: "break-word",
          transition: "all 0.2s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          {comment.identity.safeAvatar && (
            <div style={{ width: "32px", flexShrink: 0, marginRight: "14px" }}>
              <a
                href={`/upvotes?address=${comment.identity.address}`}
                onClick={() =>
                  (document.getElementById("spinner-overlay").style.display =
                    "block")
                }
              >
                <img
                  loading="lazy"
                  src={comment.identity.safeAvatar}
                  alt="avatar"
                  style={{
                    width: "32px",
                    height: "32px",
                    border: "1px solid #828282",
                    borderRadius: "0",
                  }}
                />
              </a>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                whiteSpace: "nowrap",
                gap: "3px",
                display: "inline-flex",
                alignItems: "center",
                width: "100%",
                paddingBottom: "0.45rem",
              }}
              onClick={toggleCollapsed}
            >
              <a
                style={{
                  marginTop: "-3px",
                  display: "inline-flex",
                  alignItems: "center",
                  color: "black",
                }}
                className="meta-link"
                href={`/upvotes?address=${comment.identity.address}`}
                onClick={() =>
                  (document.getElementById("spinner-overlay").style.display =
                    "block")
                }
              >
                <span style={{ fontWeight: "400", fontSize: "10pt" }}>
                  {truncateName(comment.identity.displayName)}
                </span>
              </a>
              <span style={{ fontSize: "10pt", color: "grey", opacity: "0.6" }}>
                {" "}
                •{" "}
              </span>
              <span style={{ fontSize: "9pt", color: "grey" }}>
                <a
                  href={url}
                  className="caster-link share-link"
                  title="Share"
                  style={{ whiteSpace: "nowrap" }}
                  onClick={handleShare}
                >
                  {ShareIcon({
                    padding: "0 3px 1px 0",
                    verticalAlign: "-3px",
                    height: "13px",
                    width: "13px",
                  })}
                  <span>
                    {formatDistanceToNowStrict(new Date(comment.timestamp * 1000))}
                  </span>
                  <span> ago</span>
                </a>
              </span>
            </div>
            {!isCollapsed && (
              <>
                <span
                  className="comment-text"
                  style={{ fontSize: "11pt", lineHeight: "1.15" }}
                >
                  <Linkify
                    options={{
                      className: "meta-link selectable-link",
                      target: (href) => {
                        if (href.startsWith("https://news.kiwistand.com") || 
                            href.startsWith("https://staging.kiwistand.com"))
                          return "_self";
                        return isIOS() ? "_self" : "_blank";
                      },
                      attributes: (href) => ({
                        onClick: (e) => {
                          const sanitizedHref = DOMPurify.sanitize(href);
                          const isInternal = sanitizedHref.startsWith("https://news.kiwistand.com") || 
                                            sanitizedHref.startsWith("https://staging.kiwistand.com");
                          
                          if ((window.ReactNativeWebView || window !== window.parent) && !isInternal) {
                            e.preventDefault();
                            if (window.sdk?.actions?.openUrl) {
                              window.sdk.actions.openUrl(sanitizedHref);
                            }
                          }
                        },
                      }),
                      defaultProtocol: "https",
                      validate: {
                        url: (value) => /^https:\/\/.*/.test(value),
                        email: () => false,
                      },
                    }}
                  >
                    {comment.title.split("\n").map((line, i) => {
                      if (line.startsWith(">")) {
                        return (
                          <div
                            key={i}
                            style={{
                              borderLeft: "3px solid #ccc",
                              paddingLeft: "10px",
                              margin: "8px 0 0 0",
                              color: "#666",
                            }}
                          >
                            {line.substring(2)}
                          </div>
                        );
                      }
                      // Only wrap in div if it's not an empty line
                      return line.trim() ? (
                        <div key={i}>{line}</div>
                      ) : (
                        // Empty lines create spacing between paragraphs
                        <br key={i} />
                      );
                    })}
                  </Linkify>
                </span>
                <EmojiReaction
                  comment={comment}
                  allowlist={allowlist}
                  delegations={delegations}
                  toast={toast}
                />
              </>
            )}
          </div>
        </div>
      </span>
    );
  },
);

const CommentsSection = (props) => {
  const { storyIndex, commentCount } = props;
  const [comments, setComments] = useState([]);
  const [shown, setShown] = useState(false);
  const lastCommentRef = useRef(null);
  const [source, setSource] = useState(null);
  const [storyTitle, setStoryTitle] = useState(null);

  useEffect(() => {
    const toggle = (evt) => {
      const elem = document.querySelector(`.comment-preview-${storyIndex}`);
      if (shown && elem) {
        setSource(null);
        elem.style.display = "flex";
        if (window.location.hash.startsWith("#0x")) {
          history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search,
          );
          window.dispatchEvent(new HashChangeEvent("hashchange"));
        }
      } else if (elem) {
        setSource(evt?.detail?.source);
        elem.style.display = "none";
      }
      setShown(!shown);
    };
    window.addEventListener(`open-comments-${storyIndex}`, toggle);
    return () =>
      window.removeEventListener(`open-comments-${storyIndex}`, toggle);
  }, [shown]);

  useEffect(() => {
    (async () => {
      if (commentCount === 0) return;

      const story = await API.fetchStory(storyIndex, commentCount);
      if (story && story.comments) setComments(story.comments);
      if (story && story.title) setStoryTitle(story.title);
    })();
  }, [storyIndex]);

  useEffect(() => {
    if (
      shown &&
      comments.length > 1 &&
      lastCommentRef.current &&
      source === "comment-preview"
    ) {
      lastCommentRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [shown, comments]);

  if (!shown) return;
  return (
    <div
      style={{
        marginLeft: "11px",
        marginRight: "11px",
        marginBottom: "10px",
      }}
    >
      <div
        className="comment-section"
        style={{
          backgroundColor: "var(--background-color0)",
          padding: "12px 11px",
          fontSize: "1rem",
          borderLeft: "var(--border)",
          borderRight: "var(--border)",
          borderBottom: "var(--border-thick)",
          borderRadius: "0 0 2px 2px",
        }}
      >
      <WagmiConfig config={client}>
        <RainbowKitProvider chains={chains}>
          {comments.length > 0 &&
            comments.map((comment, index) => (
              <Comment
                {...props}
                ref={index === comments.length - 1 ? lastCommentRef : null}
                key={comment.index}
                comment={comment}
                storyIndex={storyIndex}
                storyTitle={storyTitle}
              />
            ))}
          <NotificationOptIn {...props} />
          <CommentInput 
            {...props} 
            comments={comments}
            setComments={setComments}
            style={{ margin: "0 0 1rem 0" }} 
          />
        </RainbowKitProvider>
      </WagmiConfig>
      </div>
    </div>
  );
};

export default CommentsSection;
