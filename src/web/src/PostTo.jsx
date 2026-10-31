// @format
// The submit page's "Post to" (design 8, as a picker like the iOS app's):
// Kiwi News, or one of the communities you joined. A community preselected
// with /submit?community=<id> comes with the page (views/submit.mjs).
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { colorVars, creator } from "./communities.mjs";
import { Tile, UI, currentIdentity, useJoined } from "./Communities.jsx";

function Kiwi() {
  return (
    <img className="cm-kiwi" src="/kiwi-icon.webp" alt="" width="26" height="26" />
  );
}

function meta(target, identity) {
  if (!target) return "Everyone · main feed";
  return `Community · created by ${creator(target, identity)}`;
}

export function hint(target) {
  return target
    ? `Shows in ${target.name} and on Kiwi News.`
    : "Everyone on Kiwi News sees it.";
}

function Option({ target, selected, onPick }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected ? "true" : "false"}
      className="cm-option"
      onClick={() => onPick(target)}
    >
      {target ? (
        <Tile community={target} size={36} iconSize={20} />
      ) : (
        <img
          className="cm-kiwi"
          src="/kiwi-icon.webp"
          alt=""
          width="36"
          height="36"
          style={{ width: 36, height: 36 }}
        />
      )}
      <span className="cm-post-to-text">
        <span className="cm-post-to-name">
          {target ? target.name : "Kiwi News"}
        </span>
        <span className="cm-post-to-meta">{hint(target)}</span>
      </span>
      <span className="cm-option-state">
        <UI
          name={selected ? "check-circle-fill" : "circle"}
          size={20}
        />
      </span>
    </button>
  );
}

export default function PostTo({ root, target, setTarget }) {
  const joined = useJoined();
  const [open, setOpen] = useState(false);
  const [preset] = useState(() => {
    try {
      return JSON.parse(root.dataset.community || "null");
    } catch (err) {
      return null;
    }
  });
  const field = useRef(null);
  const identity = currentIdentity();

  useEffect(() => {
    if (preset) setTarget(preset);
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (event.type === "mousedown" && field.current.contains(event.target))
        return;
      setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  const options = [...joined];
  if (preset && !options.some((c) => c.id === preset.id)) {
    options.unshift(preset);
  }
  // Nothing to pick from: posts go to Kiwi News, as before communities.
  if (options.length === 0) return null;

  const pick = (next) => {
    setTarget(next);
    setOpen(false);
  };
  const vars = target ? colorVars(target.color) : undefined;
  return createPortal(
    <div ref={field} style={{ display: "contents" }}>
      <span className="n2-label">Post to</span>
      <button
        type="button"
        className={`cm-post-to-button${target ? " cm-c" : ""}`}
        style={vars}
        aria-haspopup="listbox"
        aria-expanded={open ? "true" : "false"}
        onClick={() => setOpen(!open)}
      >
        {target ? (
          <Tile community={target} size={26} iconSize={16} />
        ) : (
          <Kiwi />
        )}
        <span className="cm-post-to-text">
          <span className="cm-post-to-name">
            {target ? target.name : "Kiwi News"}
          </span>
          <span className="cm-post-to-meta">{meta(target, identity)}</span>
        </span>
        <UI name="caret-down-bold" size={13} />
      </button>
      <p className={`cm-post-to-hint${target ? " cm-c" : ""}`} style={vars}>
        <UI name={target ? "sparkle" : "globe"} size={14} />
        {hint(target)}
      </p>
      {open && (
        <div className="cm-menu" role="listbox" aria-label="Post to">
          <Option target={null} selected={!target} onPick={pick} />
          <span className="cm-menu-label">Your communities</span>
          {options.map((community) => (
            <Option
              key={community.id}
              target={community}
              selected={target?.id === community.id}
              onPick={pick}
            />
          ))}
          <a className="cm-menu-browse" href="/communities">
            <UI name="plus-bold" size={14} />
            Browse communities
          </a>
        </div>
      )}
    </div>,
    root,
  );
}
