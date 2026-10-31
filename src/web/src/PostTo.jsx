// @format
// The submit page's "Post to" (designs 8, 16 and 17): a card with Kiwi News
// (its wordmark, "Everyone · goes straight into New") and your communities
// with their members as a list of choices, a search once there are many,
// and "Browse communities". Readers without communities don't get it
// (design 18). A community preselected with /submit?community=<id> comes
// with the page (views/submit.mjs).
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { colorVars, memberCount, suggestable } from "./communities.mjs";
import { WORDMARK } from "./wordmark.mjs";
import { Tile, UI, useIdentity, useJoined } from "./Communities.jsx";

// With more communities than this, the card has a search.
export const SEARCH_FROM = 6;

export function hint(target) {
  return `Shows in ${target.name} and on Kiwi News.`;
}

function Wordmark() {
  return (
    <svg
      className="cm-wordmark"
      viewBox={WORDMARK.viewBox}
      strokeLinejoin="round"
      role="img"
      aria-label="Kiwi News"
    >
      <path
        className="kiwi-wordmark-text"
        strokeWidth={WORDMARK.kiwiStroke}
        d={WORDMARK.kiwi}
      />
      <path
        className="kiwi-wordmark-text"
        strokeWidth={WORDMARK.newsStroke}
        d={WORDMARK.news}
      />
      <path className="kiwi-wordmark-bar" d={WORDMARK.bar} />
    </svg>
  );
}

function Option({ community, selected, onPick }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected ? "true" : "false"}
      className="cm-option"
      onClick={() => onPick(community)}
    >
      {community && (
        <Tile community={community} size={28} iconSize={15} variant="tint" />
      )}
      <span className={`cm-option-text${community ? " cm-option-wrap" : ""}`}>
        {community ? (
          <span className="cm-option-name">{community.name}</span>
        ) : (
          <Wordmark />
        )}
        <span className="cm-option-meta">
          {community
            ? community.members && memberCount(community.members)
            : "Everyone · goes straight into New"}
        </span>
      </span>
      <span className={`cm-option-state${selected ? " is-selected" : ""}`}>
        <UI name={selected ? "radio-button-fill" : "circle"} size={20} />
      </span>
    </button>
  );
}

// Which of your communities the pasted link fits best
// (GET /api/v1/communities/suggest, src/community-suggest.mjs), asked for
// once typing pauses, like the title. `null` until it's there.
function useSuggestion(url, identity, enabled) {
  const [suggestion, setSuggestion] = useState(null);
  useEffect(() => {
    setSuggestion(null);
    if (!enabled || !identity || !suggestable(url)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const query = `url=${encodeURIComponent(url)}&member=${identity}`;
      fetch(`/api/v1/communities/suggest?${query}`, {
        signal: controller.signal,
      })
        .then((response) => response.json())
        .then(({ data }) => {
          if (data?.community) setSuggestion({ url, community: data.community });
        })
        .catch(() => {});
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [url, identity, enabled]);
  return suggestion;
}

// "Suggested: <community>": one click picks it. Never picked for you.
function Suggestion({ community, onUse, onDismiss }) {
  return (
    <span className="cm-c cm-suggest" style={colorVars(community.color)}>
      <button
        type="button"
        className="cm-suggest-use"
        onClick={onUse}
        aria-label={`Suggested: ${community.name}. Post to it`}
      >
        <UI name="sparkle" size={14} />
        <span className="cm-suggest-label">Suggested</span>
        <Tile community={community} size={20} iconSize={12} variant="tint" />
        <span className="cm-suggest-name">{community.name}</span>
        <span className="cm-suggest-action">Use</span>
      </button>
      <button
        type="button"
        className="cm-suggest-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss the suggestion"
      >
        <UI name="x-bold" size={11} />
      </button>
    </span>
  );
}

export default function PostTo({ root, url = "", target, setTarget }) {
  const joined = useJoined();
  const identity = useIdentity();
  const [query, setQuery] = useState("");
  // The link whose suggestion was used or dismissed.
  const [done, setDone] = useState(null);
  const [preset] = useState(() => {
    try {
      return JSON.parse(root.dataset.community || "null");
    } catch (err) {
      return null;
    }
  });

  useEffect(() => {
    if (preset) setTarget(preset);
  }, []);

  const options = [...joined];
  if (preset && !options.some((c) => c.id === preset.id)) {
    options.unshift(preset);
  }
  const suggestion = useSuggestion(url, identity, options.length > 0);
  // Nothing to pick from: posts go to Kiwi News, as before communities.
  if (options.length === 0) return null;

  // Shown while posting to Kiwi News: a community picked by hand (or
  // preset) stays.
  const suggested =
    suggestion &&
    suggestion.url === url &&
    done !== url &&
    !target &&
    options.find(({ id }) => id === suggestion.community.id);

  const search = options.length > SEARCH_FROM;
  const words = query.trim().toLowerCase();
  const shown = words
    ? options.filter(({ name }) => name.toLowerCase().includes(words))
    : options;
  return createPortal(
    <>
      <div className="cm-post-to-head">
        <span className="cm-post-to-label">Post to</span>
        {suggested && (
          <Suggestion
            community={suggested}
            onUse={() => {
              setTarget(suggested);
              setDone(url);
            }}
            onDismiss={() => setDone(url)}
          />
        )}
      </div>
      {search && (
        <label className="cm-search cm-post-to-search">
          <UI name="magnifying-glass" size={16} />
          <input
            type="search"
            value={query}
            placeholder="Search your communities"
            aria-label="Search your communities"
            onChange={(event) => setQuery(event.target.value)}
          />
          {words && (
            <span className="cm-results">
              {shown.length} {shown.length === 1 ? "result" : "results"}
            </span>
          )}
        </label>
      )}
      <div className="cm-options" role="radiogroup" aria-label="Post to">
        {!words && <Option community={null} selected={!target} onPick={setTarget} />}
        {shown.map((community) => (
          <Option
            key={community.id}
            community={community}
            selected={target?.id === community.id}
            onPick={setTarget}
          />
        ))}
      </div>
      <a className="cm-browse" href="/communities">
        <UI name="compass" size={15} />
        Browse communities
      </a>
      {target && (
        <p className="cm-c cm-post-to-hint" style={colorVars(target.color)}>
          <UI name="sparkle" size={14} />
          {hint(target)}
        </p>
      )}
    </>,
    root,
  );
}
