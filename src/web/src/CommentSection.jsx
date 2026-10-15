import React, { useRef, useState, useEffect, useMemo } from "react";
import posthog from "posthog-js";
import { formatDistanceToNowStrict } from "date-fns";
import Linkify from "linkify-react";
import { useAccount } from "wagmi";
import { Wallet } from "@ethersproject/wallet";
import { resolveIdentity } from "@attestate/delegator2";

import { useProvider } from "./client.mjs";
import CommentInput from "./CommentInput.jsx";
import * as API from "./API.mjs";
import { getLocalAccount, isIOS } from "./session.mjs";
import { resolveAvatar } from "./Avatar.jsx";
import { dynamicPrefetch } from "./main.jsx";
import { getSlug } from "./CommentInput.jsx"; // Import getSlug from CommentInput
import { openDelegationModalForAction, isDelegationModalNeeded } from "./delegationModalManager.js";
import { showSpinnerOverlay } from "./spinnerOverlay.js";



export const EmojiReaction = ({ comment, delegations, toast }) => {
  const [isReacting, setIsReacting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [pickerTop, setPickerTop] = useState(0);
  const [pickerLeft, setPickerLeft] = useState(12);
  const buttonRef = useRef(null);
  // Current emojis (in picker order)
  const [kiwis, setKiwis] = useState(
    comment.reactions?.find((r) => r.emoji === "🥝")?.reactors || [],
  );
  const [thumbsUp, setThumbsUp] = useState(
    comment.reactions?.find((r) => r.emoji === "👍")?.reactors || [],
  );
  const [hearts, setHearts] = useState(
    comment.reactions?.find((r) => r.emoji === "❤️")?.reactors || [],
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
  const [cries, setCries] = useState(
    comment.reactions?.find((r) => r.emoji === "😢")?.reactors || [],
  );
  const [parties, setParties] = useState(
    comment.reactions?.find((r) => r.emoji === "🎉")?.reactors || [],
  );
  const [joys, setJoys] = useState(
    comment.reactions?.find((r) => r.emoji === "😂")?.reactors || [],
  );
  // Legacy emojis - still need to track for existing reactions display
  const [smiles, setSmiles] = useState(
    comment.reactions?.find((r) => r.emoji === "😊")?.reactors || [],
  );
  const [laughs, setLaughs] = useState(
    comment.reactions?.find((r) => r.emoji === "🤭")?.reactors || [],
  );

  const account = useAccount();
  const localAccount = getLocalAccount(account.address);
  const provider = useProvider();

  const commonEmojis = ["🥝", "👍", "❤️", "🔥", "😂", "👀", "💯", "😢", "🎉"];
  const address = localAccount?.identity;
  const hasReacted =
    address &&
    (kiwis.includes(address) ||
      thumbsUp.includes(address) ||
      hearts.includes(address) ||
      fires.includes(address) ||
      eyes.includes(address) ||
      hundreds.includes(address) ||
      cries.includes(address) ||
      parties.includes(address) ||
      joys.includes(address) ||
      smiles.includes(address) ||
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
        const identityResolved = resolveIdentity(delegations, addr);
        if (identityResolved) {
          const resolved = await resolveAvatar(identityResolved);
          setPreResolvedAvatar(resolved);
          dynamicPrefetch(resolved);
        }
      }
    }
    fetchAvatar();
  }, [signer, delegations]);

  const handleReaction = async (emoji, isFromExistingReaction = false) => {
    // Close picker immediately
    setIsExpanded(false);

    // Prefer local signer if available; otherwise handle delegation flow for connected wallets
    if (!signer) {
      if (account?.isConnected && account?.address) {
        if (isDelegationModalNeeded(account.address)) {
          openDelegationModalForAction();
          return;
        }
      }
      toast.error("Please connect your wallet first");
      return;
    }

    try {
      const address = await signer.getAddress();
      setIsReacting(true);
      const identity = resolveIdentity(delegations, address);

      if (!identity) {
        window.location.pathname = "/";
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
        case "👍":
          if (!thumbsUp.includes(identity)) {
            setThumbsUp([...thumbsUp, identity]);
          }
          break;
        case "❤️":
          if (!hearts.includes(identity)) {
            setHearts([...hearts, identity]);
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
        case "😢":
          if (!cries.includes(identity)) {
            setCries([...cries, identity]);
          }
          break;
        case "🎉":
          if (!parties.includes(identity)) {
            setParties([...parties, identity]);
          }
          break;
        case "😂":
          if (!joys.includes(identity)) {
            setJoys([...joys, identity]);
          }
          break;
        // Legacy emojis (can still be displayed, but not added via picker)
        case "😊":
          if (!smiles.includes(identity)) {
            setSmiles([...smiles, identity]);
          }
          break;
        case "🤭":
          if (!laughs.includes(identity)) {
            setLaughs([...laughs, identity]);
          }
          break;
      }

      // Send reaction in background
      const response = await API.send(value, signature);
      if (response.status === "success") {
        toast.success("Reaction added!");
        const isAnonMode = localStorage.getItem('anon-mode') === 'true';
        if (!isAnonMode) {
          let variant = "unknown";
          try {
            const el = document.querySelector('meta[name="kiwi-variant"]');
            variant = el?.content || "unknown";
          } catch (_) {}
          posthog.capture("emoji_reaction", {
            emoji: emoji,
            from_existing: isFromExistingReaction,
            variant,
          });
        }
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
    "👍": thumbsUp.length,
    "❤️": hearts.length,
    "🔥": fires.length,
    "😂": joys.length,
    "👀": eyes.length,
    "💯": hundreds.length,
    "😢": cries.length,
    "🎉": parties.length,
    // Legacy emojis
    "😊": smiles.length,
    "🤭": laughs.length,
  };

  const existingReactions = comment.reactions?.filter(r => r.reactors?.length > 0) || [];
  const userReactions = useMemo(() => ({
    "🥝": kiwis.includes(address),
    "👍": thumbsUp.includes(address),
    "❤️": hearts.includes(address),
    "🔥": fires.includes(address),
    "😂": joys.includes(address),
    "👀": eyes.includes(address),
    "💯": hundreds.includes(address),
    "😢": cries.includes(address),
    "🎉": parties.includes(address),
    "😊": smiles.includes(address),
    "🤭": laughs.includes(address),
  }), [address, kiwis, thumbsUp, hearts, fires, eyes, hundreds, cries, parties, joys, smiles, laughs]);
  
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
            const alreadyReacted = userReactions[reaction.emoji];
            
            return (
              <button
                key={reaction.emoji}
                onClick={() => !isOwnComment && !alreadyReacted && !hasReacted && handleReaction(reaction.emoji, true)}
                disabled={isReacting || isOwnComment || alreadyReacted || hasReacted}
                style={{
                  // NOTE: The design's reaction chip (Web 2 · Desktop ·
                  // Story: 1px border, radius-sm, 2px 8px).
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  boxSizing: "border-box",
                  backgroundColor: alreadyReacted ? "var(--kn-kiwi-green-light)" : "transparent",
                  border: "1px solid var(--kn-border)",
                  borderRadius: "var(--kn-radius-sm)",
                  padding: "2px 8px",
                  minHeight: "28px",
                  cursor: (isntLoggedIn || isOwnComment || alreadyReacted || hasReacted) ? "default" : "pointer",
                  transition: "all 0.15s ease",
                  WebkitAppearance: "none",
                  opacity: hasReacted && !alreadyReacted ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isntLoggedIn && !isOwnComment && !alreadyReacted && !hasReacted) {
                    e.currentTarget.style.backgroundColor = "var(--kn-hover-minimal)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = alreadyReacted ? "var(--kn-kiwi-green-light)" : "transparent";
                }}
              >
                <span style={{ fontSize: "13px", lineHeight: "1" }}>{reaction.emoji}</span>
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
                        border: "1.5px solid var(--kn-card)",
                      }}
                    />
                  ));
                })()}
                {reactionCounts[reaction.emoji] > 1 && (
                  <span style={{ color: "var(--kn-text-secondary)", fontFamily: "var(--kn-font-mono)", fontSize: "12px" }}>
                    {reactionCounts[reaction.emoji]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      
      {/* React button - larger touch target */}
      {!isOwnComment && !hasReacted && (
        <button
          ref={buttonRef}
          onClick={() => {
            if (!isExpanded && buttonRef.current) {
              const rect = buttonRef.current.getBoundingClientRect();
              setPickerTop(rect.bottom + 4);
              // Anchor picker to the button's left edge, but keep it within
              // the viewport with a 12px safety margin on both sides.
              const estimatedWidth = Math.min(
                window.innerWidth - 24,
                commonEmojis.length * 44 + 12,
              );
              let left = rect.left;
              if (left + estimatedWidth > window.innerWidth - 12) {
                left = window.innerWidth - 12 - estimatedWidth;
              }
              if (left < 12) left = 12;
              setPickerLeft(left);
            }
            setIsExpanded(!isExpanded);
          }}
          disabled={false}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxSizing: "border-box",
            padding: "2px 8px",
            minWidth: "28px",
            minHeight: "28px",
            background: isExpanded ? "var(--kn-button-bg)" : "transparent",
            border: "1px solid var(--kn-border)",
            borderRadius: "var(--kn-radius-sm)",
            fontSize: "14px",
            color: isExpanded ? "var(--kn-text-tertiary)" : "var(--kn-text-secondary)",
            cursor: "pointer",
            fontFamily: "var(--font-family)",
            WebkitAppearance: "none",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            if (!isntLoggedIn && !isExpanded) {
              e.target.style.backgroundColor = "var(--kn-hover-minimal)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isExpanded) {
              e.target.style.backgroundColor = "transparent";
            }
          }}
        >
          <span style={{ fontSize: "15px", lineHeight: "1" }}>
            {isExpanded ? "−" : "+"}
          </span>
        </button>
      )}
      
      {/* Expanded emoji picker - floating overlay */}
      {isExpanded && (
        <div
          style={{
            position: "fixed",
            top: `${pickerTop}px`,
            left: `${pickerLeft}px`,
            maxWidth: "calc(100vw - 24px)",
            width: "max-content",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: "4px",
            overflowX: "auto",
            backgroundColor: "var(--bg-white)",
            borderRadius: "24px",
            padding: "6px",
            boxShadow: "var(--shadow-default)",
            border: "var(--border-thin)",
            zIndex: 1000,
            animation: "fadeIn 0.15s ease-out",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {commonEmojis.map((emoji) => {
            const alreadyReacted = (
              emoji === "🥝" && kiwis.includes(address) ||
              emoji === "👍" && thumbsUp.includes(address) ||
              emoji === "❤️" && hearts.includes(address) ||
              emoji === "🔥" && fires.includes(address) ||
              emoji === "😂" && joys.includes(address) ||
              emoji === "👀" && eyes.includes(address) ||
              emoji === "💯" && hundreds.includes(address) ||
              emoji === "😢" && cries.includes(address) ||
              emoji === "🎉" && parties.includes(address)
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
                  width: "36px",
                  height: "36px",
                  padding: "0",
                  background: alreadyReacted ? "var(--accent-primary-light)" : "transparent",
                  border: "none",
                  borderRadius: "50%",
                  fontSize: "18px",
                  cursor: disabled ? "default" : "pointer",
                  WebkitAppearance: "none",
                  opacity: disabled ? 0.5 : 1,
                  transition: "all 0.15s ease",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  if (!disabled) {
                    e.target.style.backgroundColor = "var(--bg-hover)";
                    e.target.style.transform = "scale(1.1)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = alreadyReacted ? "var(--accent-primary-light)" : "transparent";
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

const Comment = React.forwardRef(
  ({ comment, storyIndex, storyTitle, delegations, toast, isLastComment }, ref) => {
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
    // NOTE: The #0x… anchor lands on this comment on the story page (scrolled
    // to and highlighted), the same as a notification's link.
    const url = storyTitle
      ? `${window.location.origin}/stories/${getSlug(storyTitle)}?index=${storyIndex}&commentIndex=${comment.index}#0x${comment.index}`
      : `${window.location.origin}/stories?index=${storyIndex}&commentIndex=${comment.index}#0x${comment.index}`;
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

    // NOTE: The same card as the story page's server-rendered comments
    // (views/story.mjs, .kn-comment in news.css), so the feed's expanded
    // comments and the story page can't drift apart. Only the chrome is
    // NEU 2; the comment text keeps its layout.
    return (
      <span
        ref={ref}
        className={`kn-comment${isTargeted ? " kn-comment-targeted" : ""}${
          isLastComment ? " kn-comment-last" : ""
        }`}
      >
        <div className="kn-comment-inner">
          {comment.identity.safeAvatar && (
            <div className="kn-comment-avatar">
              <a
                href={`/upvotes?address=${comment.identity.address}`}
                onClick={() => showSpinnerOverlay()}
              >
                <img
                  loading="lazy"
                  src={comment.identity.safeAvatar}
                  alt="avatar"
                  width="32"
                  height="32"
                />
              </a>
            </div>
          )}
          <div className="kn-comment-main">
            <div className="kn-comment-head" onClick={toggleCollapsed}>
              <a
                className="kn-comment-name"
                href={`/upvotes?address=${comment.identity.address}`}
                onClick={() => showSpinnerOverlay()}
              >
                {comment.identity.displayName}
              </a>
              <span className="kn-comment-time">
                <span>· </span>
                <a
                  href={url}
                  title="Share"
                  onClick={(e) => {
                    if (navigator.share) handleShare(e);
                  }}
                >
                  {formatDistanceToNowStrict(new Date(comment.timestamp * 1000))}{" "}
                  ago
                </a>
              </span>
            </div>
            {!isCollapsed && (
              <>
                <span className="comment-text">
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
                              borderLeft: "3px solid var(--text-secondary)",
                              paddingLeft: "10px",
                              margin: "8px 0 0 0",
                              color: "var(--text-tertiary)",
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
  const { storyIndex, commentCount, hasPreview, alwaysShown, storyTitle: storyTitleProp } = props;
  const [comments, setComments] = useState([]);
  const [loaded, setLoaded] = useState(commentCount === 0);
  const [shown, setShown] = useState(alwaysShown || false);
  const lastCommentRef = useRef(null);
  const [source, setSource] = useState(null);
  const [storyTitle, setStoryTitle] = useState(storyTitleProp || null);

  useEffect(() => {
    if (alwaysShown) return; // Skip toggle logic for story page

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
  }, [shown, storyIndex, alwaysShown]);

  useEffect(() => {
    (async () => {
      if (commentCount === 0) return;

      const story = await API.fetchStory(storyIndex, commentCount);
      if (story && story.comments) setComments(story.comments);
      if (story && story.title && !storyTitleProp) setStoryTitle(story.title);
      setLoaded(true);
    })();
  }, [storyIndex, commentCount, storyTitleProp]);

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
      <div className="comment-section kn-feed-comments">
        <div className="kn-comment kn-comment-loading">Loading comments…</div>
      </div>
    );
  }

  return (
    <div
      // NOTE: On the story page the composer's box lines up with the server
      // rendered comment cards (.kn-comments); .comment-input-host in
      // news.css gives it the same edges, so no margins here.
      // NOTE: In the feed the comments sit in the row's content column
      // (.kn-feed-comments in news.css: no extra side margins).
      className={`comment-section${alwaysShown ? "" : " kn-feed-comments"}`}
      style={alwaysShown ? { padding: "0", fontSize: "1rem" } : undefined}
    >
      {comments.length > 0 &&
        comments.map((comment, index) => (
          <Comment
            {...props}
            ref={index === comments.length - 1 ? lastCommentRef : null}
            key={comment.index}
            comment={comment}
            storyIndex={storyIndex}
            storyTitle={storyTitle}
            isLastComment={index === comments.length - 1}
          />
        ))}
      <CommentInput
        {...props}
        comments={comments}
        setComments={setComments}
        placeholder={
          (alwaysShown ? props.firstComment : comments.length === 0)
            ? "Be the first to comment…"
            : "Add a comment…"
        }
        style={{ margin: "0" }}
      />
    </div>
  );
};

export default CommentsSection;
