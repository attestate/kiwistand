import React, { useRef, useState, useEffect } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import Linkify from "linkify-react";

import CommentInput from "./CommentInput.jsx";
import { fetchStory } from "./API.mjs";
import { isIOS } from "./session.mjs";

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

const Comment = React.forwardRef(({ comment, storyIndex }, ref) => {
  const [isTargeted, setIsTargeted] = useState(
    window.location.hash === `#0x${comment.index}`,
  );

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
        border: "var(--border)",
        backgroundColor: "var(--bg-off-white)",
        padding: "0.55rem 0.75rem",
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
          marginBottom: "0.25rem",
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
          <span style={{ fontWeight: "400", fontSize: "11pt" }}>
            {truncateName(comment.identity.displayName)}
          </span>
        </a>
        <span style={{ fontSize: "10pt", color: "grey", opacity: "0.6" }}>
          {" "}
          •{" "}
        </span>
        <span style={{ fontSize: "9pt", color: "grey" }}>
          {formatDistanceToNowStrict(new Date(comment.timestamp * 1000))}
          <span> ago</span>
        </span>
      </div>
      <br />
      <span
        className="comment-text"
        style={{ fontSize: "11pt", lineHeight: "1.15" }}
      >
        <Linkify
          options={{
            className: "meta-link",
            target: isIOS() ? "_self" : "_blank",
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

      const story = await fetchStory(storyIndex, commentCount);
      if (story && story.comments) setComments(story.comments);
    })();
  }, [storyIndex]);

  if (!shown) return;
  return (
    <div
      style={{
        backgroundColor: "var(--table-bg)",
        padding: "0 11px 0 11px",
        fontSize: "1rem",
      }}
    >
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
