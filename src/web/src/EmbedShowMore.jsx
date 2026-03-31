import React, { useState } from "react";

function linkify(text) {
  const parts = text.split(/(\bhttps?:\/\/[^\s]+)/g);
  return parts.map((part, i) => {
    if (/^\bhttps?:\/\//.test(part)) {
      const display = part.length > 40 ? part.substring(0, 40) + "\u2026" : part;
      return (
        <a key={i} href={part} target="_blank" rel="noopener">
          {display}
        </a>
      );
    }
    return part;
  });
}

export default function EmbedShowMore({ text, cutoff }) {
  const [expanded, setExpanded] = useState(false);
  const limit = cutoff || 280;

  if (text.length <= limit) {
    return <>{linkify(text)}</>;
  }

  const preview = text.slice(0, limit);

  return (
    <>
      {expanded ? linkify(text) : (
        <>
          {linkify(preview)}
          <span style={{ opacity: 0.6 }}>&hellip;</span>
        </>
      )}
      <span
        className="embed-show-more"
        style={{ display: "inline", cursor: "pointer", color: "var(--feed-link-color, #1d9bf0)" }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setExpanded(!expanded);
        }}
      >
        {expanded ? " show less" : " show more"}
      </span>
    </>
  );
}
