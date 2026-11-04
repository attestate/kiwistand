// @format
// The comment box's suggestions after "@" (GET /api/v1/mentions, see
// src/mentions.mjs) and the mentions in comments (mentions.mjs).
import React, { useEffect, useRef, useState } from "react";

import { typing, insert, split, mentioned, names } from "./mentions.mjs";
import { showSpinnerOverlay } from "./spinnerOverlay.js";

const storyPattern = /^0x[a-fA-F0-9]{72}$/;
const results = new Map();
function search(query, story) {
  const params = new URLSearchParams({ q: query });
  if (storyPattern.test(story || "")) params.set("index", story);
  const key = params.toString();
  if (!results.has(key)) {
    results.set(
      key,
      fetch(`/api/v1/mentions?${key}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((body) => body?.data?.people || [])
        .catch(() => {
          results.delete(key);
          return [];
        }),
    );
  }
  return results.get(key);
}

// NOTE: For the comment box: its textarea calls `track` when its text or
// caret changes, `onKeyDown` on keys and `close` on blur, and `list` goes
// above it. The names it put in the text are `inserted` ({name: address}),
// which CommentInput keeps with the draft and posts with encode().
export function useMentions({ text, setText, storyIndex, inserted, setInserted }) {
  const element = useRef(null);
  const [at, setAt] = useState(null);
  const [people, setPeople] = useState([]);
  const [active, setActive] = useState(0);

  const track = (event) => {
    const field = event.target;
    element.current = field;
    const { selectionStart, selectionEnd, value } = field;
    setAt(
      selectionStart === selectionEnd ? typing(value, selectionStart) : null,
    );
  };

  useEffect(() => {
    if (!at) {
      setPeople([]);
      return;
    }
    let live = true;
    const timer = setTimeout(async () => {
      const found = await search(at.query, storyIndex);
      if (!live) return;
      setPeople(found);
      setActive(0);
    }, 150);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [at?.start, at?.query, storyIndex]);

  const open = !!at && people.length > 0;

  const pick = (person) => {
    const field = element.current;
    const caret = at.start + 1 + at.query.length;
    const next = insert(text, caret, at, person.name);
    setText(next.text);
    setInserted({ ...inserted, [person.name]: person.address });
    setAt(null);
    if (!field) return;
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(next.caret, next.caret);
    });
  };

  const onKeyDown = (event) => {
    if (!open) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : people.length - 1;
      setActive((active + step) % people.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      pick(people[active]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setAt(null);
    }
  };

  const list = open ? (
    <ul className="kn-mentions" role="listbox" aria-label="People to mention">
      {people.map((person, i) => (
        <li key={person.address} role="option" aria-selected={i === active}>
          <button
            type="button"
            className="kn-mention-option"
            // Keep the field focused (and the keyboard up) while picking.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => pick(person)}
          >
            {person.avatar ? (
              <img src={person.avatar} alt="" width="24" height="24" />
            ) : (
              <span className="kn-mention-avatar" aria-hidden="true" />
            )}
            <span className="kn-mention-name">{person.name}</span>
          </button>
        </li>
      ))}
    </ul>
  ) : null;

  return { track, onKeyDown, close: () => setAt(null), list };
}

// NOTE: Names come from the profiles (/api/v1/profile), each asked once.
const profiles = new Map();
function profile(address) {
  if (!profiles.has(address)) {
    profiles.set(
      address,
      fetch(`/api/v1/profile/${address}`)
        .then((response) => response.json())
        .then((body) => body.data),
    );
  }
  return profiles.get(address);
}

// A comment's text with each mention as a link to the person's profile,
// "@<name>" (the short address until the name is there).
export function useMentionNames(text) {
  const [found, setFound] = useState({});
  useEffect(() => {
    if (mentioned(text).length === 0) return;
    let live = true;
    names([text], profile).then((result) => live && setFound(result));
    return () => {
      live = false;
    };
  }, [text]);
  return found;
}

export function withMentions(text, found) {
  return split(text, found).map((part, i) =>
    typeof part === "string" ? (
      part
    ) : (
      <a
        key={i}
        className="kn-mention"
        href={`/upvotes?address=${part.address}`}
        onClick={() => showSpinnerOverlay()}
      >
        @{part.name}
      </a>
    ),
  );
}
