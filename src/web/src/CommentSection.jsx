import React, { useRef, useState, useEffect } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import Linkify from "linkify-react";
import { useAccount, WagmiConfig } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { Wallet } from "@ethersproject/wallet";

import { useProvider, client, chains } from "./client.mjs";
import CommentInput from "./CommentInput.jsx";
import * as API from "./API.mjs";
import { getLocalAccount, isIOS, isRunningPWA } from "./session.mjs";

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
function NotificationOptIn(props) {
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

      <WagmiConfig config={client}>
        <RainbowKitProvider chains={chains}>
          <EmailNotificationLink {...props} />
        </RainbowKitProvider>
      </WagmiConfig>
    </div>
  );
}

const EmailNotificationLink = (props) => {
  const [status, setStatus] = useState("");
  const [email, setEmail] = useState("");
  const account = useAccount();
  const localAccount = getLocalAccount(account.address, props.allowlist);
  const provider = useProvider();

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

const Comment = React.forwardRef(({ comment, storyIndex }, ref) => {
  const [isTargeted, setIsTargeted] = useState(
    window.location.hash === `#0x${comment.index}`,
  );

  const url = `${window.location.origin}/stories?index=${storyIndex}#0x${comment.index}`;
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
        boxShadow: isTargeted ? "0 0 0 2px rgb(175, 192, 70, 0.75)" : undefined,
        color: "black",
        border: isTargeted ? "none" : "var(--border)",
        backgroundColor: "var(--bg-off-white)",
        padding: "0.55rem 0.75rem 0.75rem 0.75rem",
        borderRadius: "2px",
        display: "block",
        marginBottom: "12px",
        whiteSpace: "pre-wrap",
        lineHeight: "1.2",
        wordBreak: "break-word",
        overflowWrap: "break-word",
      }}
    >
      <div
        style={{
          whiteSpace: "nowrap",
          gap: "3px",
          marginBottom: "0.5rem",
          display: "inline-flex",
          alignItems: "center",
        }}
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
        >
          {comment.identity.safeAvatar && (
            <img
              loading="lazy"
              src={comment.identity.safeAvatar}
              alt="avatar"
              style={{
                marginRight: "5px",
                width: "10px",
                height: "10px",
                border: "1px solid #828282",
                borderRadius: "2px",
              }}
            />
          )}
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
      <br />
      <span
        className="comment-text"
        style={{ fontSize: "11pt", lineHeight: "1.15" }}
      >
        <Linkify
          options={{
            className: "meta-link selectable-link",
            target: (href) => {
              if (href.startsWith("https://news.kiwistand.com")) return "_self";
              return isIOS() ? "_self" : "_blank";
            },
            defaultProtocol: "https",
            validate: {
              url: (value) => /^https:\/\/.*/.test(value),
              email: () => false,
            },
          }}
        >
          {comment.title}
        </Linkify>
      </span>
    </span>
  );
});

const CommentsSection = (props) => {
  const { storyIndex, commentCount } = props;
  const [comments, setComments] = useState([]);
  const [shown, setShown] = useState(false);
  const lastCommentRef = useRef(null);
  const [source, setSource] = useState(null);

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
        backgroundColor: "var(--table-bg)",
        padding: "0 11px 0 11px",
        fontSize: "1rem",
      }}
    >
      <NotificationOptIn {...props} />
      {comments.length > 0 &&
        comments.map((comment, index) => (
          <Comment
            ref={index === comments.length - 1 ? lastCommentRef : null}
            key={comment.index}
            comment={comment}
            storyIndex={storyIndex}
          />
        ))}
      <CommentInput {...props} style={{ margin: "0 0 1rem 0" }} />
    </div>
  );
};

export default CommentsSection;
