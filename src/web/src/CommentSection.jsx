import React, { useRef, useState, useEffect } from "react";
import posthog from "posthog-js";
import { formatDistanceToNowStrict } from "date-fns";
import Linkify from "linkify-react";
import { useAccount, WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import { openDelegationModalForAction, isDelegationModalNeeded } from "./delegationModalManager.js";

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
  const [isExpanded, setIsExpanded] = useState(false);
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
  
  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isExpanded && !event.target.closest('.reactions-container')) {
        setIsExpanded(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isExpanded]);
  
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

  const handleReaction = async (emoji, isFromExistingReaction = false) => {
    // Check if wallet is connected
    if (!account.isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }

    // Check if delegation is needed using account address
    if (account.address && isDelegationModalNeeded(allowlist, delegations, account.address)) {
      openDelegationModalForAction();
      return;
    }

    // Now check for signer
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
        (r) => r.emoji === emoji,
      );
      if (existingReaction) {
        // Initialize reactorProfiles if it doesn't exist
        if (!Array.isArray(existingReaction.reactorProfiles)) {
          existingReaction.reactorProfiles = [];
        }
        // Only add if not already in the array
        if (!existingReaction.reactors.includes(identity)) {
          existingReaction.reactors.push(identity);
          existingReaction.reactorProfiles.push({
            address: identity,
            safeAvatar: resolvedAvatar,
          });
        }
      } else {
        comment.reactions.push({
          emoji,
          reactors: [identity],
          reactorProfiles: [{ address: identity, safeAvatar: resolvedAvatar }],
        });
      }

      switch (emoji) {
        case "🥝":
          if (!kiwis.includes(identity)) {
            setKiwis([...kiwis, identity]);
          }
          break;
        case "🔥":
          if (!fires.includes(identity)) {
            setFires([...fires, identity]);
          }
          break;
        case "👀":
          if (!eyes.includes(identity)) {
            setEyes([...eyes, identity]);
          }
          break;
        case "💯":
          if (!hundreds.includes(identity)) {
            setHundreds([...hundreds, identity]);
          }
          break;
        case "🤭":
          if (!laughs.includes(identity)) {
            setLaughs([...laughs, identity]);
          }
          break;
      }

      // Collapse after successful reaction
      setIsExpanded(false);

      // Send reaction in background
      const response = await API.send(value, signature);
      if (response.status === "success") {
        toast.success("Reaction added!");
        posthog.capture("emoji_reaction", {
          emoji: emoji,
          from_existing: isFromExistingReaction,
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
  
  const reactionCounts = {
    "🥝": kiwis.length,
    "🔥": fires.length,
    "👀": eyes.length,
    "💯": hundreds.length,
    "🤭": laughs.length,
  };
  
  const existingReactions = comment.reactions?.filter(r => r.reactors?.length > 0) || [];
  
  return (
    <div
      className="reactions-container"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        minHeight: "40px",
        marginTop: "8px",
        position: "relative",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Existing reactions - clickable and larger */}
      {existingReactions.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          {existingReactions.map((reaction) => {
            const alreadyReacted = (
              reaction.emoji === "🥝" && kiwis.includes(address) ||
              reaction.emoji === "🔥" && fires.includes(address) ||
              reaction.emoji === "👀" && eyes.includes(address) ||
              reaction.emoji === "💯" && hundreds.includes(address) ||
              reaction.emoji === "🤭" && laughs.includes(address)
            );
            
            return (
              <button
                key={reaction.emoji}
                onClick={() => !isOwnComment && !alreadyReacted && !hasReacted && handleReaction(reaction.emoji, true)}
                disabled={isReacting || isOwnComment || alreadyReacted || hasReacted}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  backgroundColor: alreadyReacted ? "rgba(175, 192, 70, 0.1)" : "rgba(0, 0, 0, 0.02)",
                  border: "none",
                  borderRadius: "20px",
                  padding: "6px 12px",
                  minHeight: "40px",
                  cursor: (isntLoggedIn || isOwnComment || alreadyReacted || hasReacted) ? "default" : "pointer",
                  transition: "all 0.15s ease",
                  WebkitAppearance: "none",
                  opacity: hasReacted && !alreadyReacted ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isntLoggedIn && !isOwnComment && !alreadyReacted && !hasReacted) {
                    e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.05)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = alreadyReacted ? "rgba(175, 192, 70, 0.1)" : "rgba(0, 0, 0, 0.02)";
                }}
              >
                <span style={{ fontSize: "16px" }}>{reaction.emoji}</span>
                {(() => {
                  const profiles = reaction.reactorProfiles || [];
                  
                  // Debug: Check if current user is in the reactors list
                  const currentUserHasReacted = reaction.reactors?.includes(address);
                  const currentUserProfile = profiles.find(p => 
                    p.address?.toLowerCase() === address?.toLowerCase()
                  );
                  
                  // Temporary debug logging
                  if (currentUserHasReacted && !currentUserProfile?.safeAvatar) {
                    console.log('Current user has reacted but no avatar found:', {
                      address,
                      currentUserProfile,
                      reactors: reaction.reactors,
                      profiles: profiles.map(p => ({ address: p.address, hasAvatar: !!p.safeAvatar }))
                    });
                  }
                  
                  let profilesToShow = [];
                  
                  // If current user has reacted, always show them first
                  if (currentUserHasReacted && currentUserProfile?.safeAvatar) {
                    profilesToShow.push(currentUserProfile);
                  }
                  
                  // Then add other profiles with avatars
                  const otherProfiles = profiles
                    .filter(p => 
                      p.address?.toLowerCase() !== address?.toLowerCase() && 
                      p.safeAvatar
                    )
                    .slice(0, currentUserProfile?.safeAvatar ? 1 : 2);
                  
                  profilesToShow = [...profilesToShow, ...otherProfiles];
                  
                  return profilesToShow.map((profile, i) => (
                    <img
                      key={profile.address}
                      loading="lazy"
                      src={profile.safeAvatar}
                      alt=""
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        marginLeft: i === 0 ? "0" : "-6px",
                        border: "1.5px solid white",
                      }}
                    />
                  ));
                })()}
                {reactionCounts[reaction.emoji] > 1 && (
                  <span style={{ color: "#666", fontSize: "13px", fontWeight: "500" }}>
                    {reactionCounts[reaction.emoji]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      
      {/* React button - larger touch target */}
      {(!isOwnComment || localAccount) && !hasReacted && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={false}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "8px 14px",
            minWidth: "48px",
            minHeight: "40px",
            background: isExpanded ? "rgba(0, 0, 0, 0.04)" : "transparent",
            border: "none",
            borderRadius: "20px",
            fontSize: "16px",
            color: isExpanded ? "#666" : "#888",
            cursor: "pointer",
            fontFamily: "var(--font-family)",
            WebkitAppearance: "none",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            if (!isntLoggedIn && !isExpanded) {
              e.target.style.backgroundColor = "rgba(0, 0, 0, 0.04)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isExpanded) {
              e.target.style.backgroundColor = "transparent";
            }
          }}
        >
          <span style={{ fontSize: "20px", lineHeight: "1" }}>
            {isExpanded ? "−" : "+"}
          </span>
        </button>
      )}
      
      {/* Expanded emoji picker - floating overlay */}
      {isExpanded && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: "0",
            marginTop: "4px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            backgroundColor: "white",
            borderRadius: "24px",
            padding: "6px",
            boxShadow: "0 2px 12px rgba(0, 0, 0, 0.12)",
            border: "1px solid rgba(0, 0, 0, 0.08)",
            zIndex: 10,
            animation: "fadeIn 0.15s ease-out",
          }}
        >
          {commonEmojis.map((emoji) => {
            const alreadyReacted = (
              emoji === "🥝" && kiwis.includes(address) ||
              emoji === "🔥" && fires.includes(address) ||
              emoji === "👀" && eyes.includes(address) ||
              emoji === "💯" && hundreds.includes(address) ||
              emoji === "🤭" && laughs.includes(address)
            );
            const disabled = isReacting || isOwnComment || alreadyReacted;
            
            return (
              <button
                key={emoji}
                onClick={() => !disabled && handleReaction(emoji)}
                disabled={disabled}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "48px",
                  height: "48px",
                  padding: "0",
                  background: alreadyReacted ? "rgba(175, 192, 70, 0.1)" : "transparent",
                  border: "none",
                  borderRadius: "50%",
                  fontSize: "20px",
                  cursor: disabled ? "default" : "pointer",
                  WebkitAppearance: "none",
                  opacity: disabled ? 0.5 : 1,
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!disabled) {
                    e.target.style.backgroundColor = "rgba(0, 0, 0, 0.08)";
                    e.target.style.transform = "scale(1.1)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = alreadyReacted ? "rgba(175, 192, 70, 0.1)" : "transparent";
                  e.target.style.transform = "scale(1)";
                }}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

function NotificationOptIn(props) {
  const account = useAccount();
  const localAccount = getLocalAccount(account.address, props.allowlist);
  const [isMiniApp, setIsMiniApp] = useState(null); // Start with null to indicate loading state

  // Compute eligibility synchronously when possible to avoid pop-in
  const identity =
    localAccount?.identity &&
    eligible(props.allowlist, props.delegations, localAccount.identity);

  useEffect(() => {
    let mounted = true;
    async function checkMiniApp() {
      try {
        const miniAppStatus = await window.sdk?.isInMiniApp();
        if (mounted) setIsMiniApp(Boolean(miniAppStatus));
      } catch (error) {
        if (mounted) setIsMiniApp(false);
      }
    }
    checkMiniApp();
    return () => {
      mounted = false;
    };
  }, []);

  // Don't render until we know the mini app status to avoid flash
  if (!identity || isMiniApp === null || isMiniApp === true) return null;
  return (
    <div
      style={{
        padding: "0.75rem",
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
      ? `${window.location.origin}/stories/${getSlug(storyTitle)}?index=${storyIndex}&commentIndex=${comment.index}`
      : `${window.location.origin}/stories?index=${storyIndex}&commentIndex=${comment.index}`;
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
          backgroundColor: isTargeted ? "#fefef8" : "white",
          border: "var(--border)",
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
  const { storyIndex, commentCount, hasPreview } = props;
  const [comments, setComments] = useState([]);
  const [loaded, setLoaded] = useState(commentCount === 0);
  const [shown, setShown] = useState(false);
  const lastCommentRef = useRef(null);
  const [source, setSource] = useState(null);
  const [storyTitle, setStoryTitle] = useState(null);

  useEffect(() => {
    const toggle = (evt) => {
      const preview = document.querySelector(`.comment-preview-${storyIndex}`);
      const host = document.querySelector(`.comment-section[data-story-index="${storyIndex}"]`);
      const nextShown = !shown;

      if (nextShown) {
        // Opening: replace preview with a same-height placeholder immediately
        setSource(evt?.detail?.source);
        if (preview && host) {
          const { height } = preview.getBoundingClientRect();
          // Hide preview right away to avoid overlap
          preview.style.display = "none";
          // Reserve exact space for comments to avoid layout jump
          host.style.minHeight = `${Math.ceil(height)}px`;
        }
      } else {
        // Closing: show preview again and clear placeholder
        setSource(null);
        if (preview) {
          preview.style.display = "flex";
          preview.style.opacity = 1;
        }
        if (host) {
          host.style.minHeight = "";
        }
        if (window.location.hash.startsWith("#0x")) {
          history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search,
          );
          window.dispatchEvent(new HashChangeEvent("hashchange"));
        }
      }

      setShown(nextShown);
    };
    window.addEventListener(`open-comments-${storyIndex}`, toggle);
    return () =>
      window.removeEventListener(`open-comments-${storyIndex}`, toggle);
  }, [shown, storyIndex]);

  useEffect(() => {
    (async () => {
      if (commentCount === 0) return;

      const story = await API.fetchStory(storyIndex, commentCount);
      if (story && story.comments) setComments(story.comments);
      if (story && story.title) setStoryTitle(story.title);
      setLoaded(true);
    })();
  }, [storyIndex, commentCount]);

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
  }, [shown, comments, source]);

  // Ensure placeholder is released once comments are ready (keep hooks before returns)
  useEffect(() => {
    if (shown && loaded) {
      const host = document.querySelector(`.comment-section[data-story-index="${storyIndex}"]`);
      if (host) host.style.minHeight = "";
    }
  }, [shown, loaded, storyIndex]);

  if (!shown) return null;
  // Avoid staggered pop-ins by showing content once initial data is ready
  if (!loaded) {
    return (
      <div
        className="comment-section"
        style={{
          marginLeft: "11px",
          marginRight: "11px",
          marginBottom: "10px",
          backgroundColor: "transparent",
          padding: "0",
          fontSize: "1rem",
        }}
      >
        <div
          style={{
            border: "var(--border)",
            borderRadius: "2px",
            background: "white",
            padding: "0.75rem",
            color: "#666",
          }}
        >
          Loading comments…
        </div>
      </div>
    );
  }
  
  const queryClient = new QueryClient();
  
  return (
    <div
      className="comment-section"
      style={{
        marginLeft: "11px",
        marginRight: "11px",
        marginBottom: "10px",
        backgroundColor: "transparent",
        padding: "0",
        fontSize: "1rem",
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={client}>
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
              style={{ margin: "0" }} 
            />
          </RainbowKitProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </div>
  );
};

export default CommentsSection;
