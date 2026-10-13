import React, { useEffect, useState } from "react";

import { paths, wordmark } from "./icons.mjs";

// The site's mobile/desktop breakpoint (news.css: max-width 640px).
const DESKTOP = "(min-width: 641px)";

export function useDesktop() {
  const query = () => window.matchMedia(DESKTOP).matches;
  const [desk, setDesk] = useState(query);
  useEffect(() => {
    const list = window.matchMedia(DESKTOP);
    const change = () => setDesk(list.matches);
    list.addEventListener("change", change);
    return () => list.removeEventListener("change", change);
  }, []);
  return desk;
}

export function Icon({ name, size = 24 }) {
  return (
    <svg
      className="kob-icon"
      viewBox="0 -960 960 960"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="kob-logo">
      <img src="/kiwi-icon.webp" alt="" width="40" height="40" />
      <svg
        className="kob-wordmark"
        viewBox="9 15 192 28"
        role="img"
        aria-label="Kiwi News"
      >
        {wordmark.kiwi.map((d) => (
          <path key={d} className="kob-wm-kiwi" d={d} />
        ))}
        {wordmark.news.map((d) => (
          <path key={d} className="kob-wm-news" d={d} />
        ))}
      </svg>
    </div>
  );
}

export function Tile({ icon, desk }) {
  return (
    <div className="kob-tile-wrap">
      <div className="kob-tile">
        <Icon name={icon} size={desk ? 24 : 26} />
      </div>
    </div>
  );
}

// Title and explanation paragraphs.
export function Heading({ title, children }) {
  return (
    <div className="kob-heading">
      <h2 className="kob-title">{title}</h2>
      {children && <div className="kob-copy">{children}</div>}
    </div>
  );
}

// Mobile: a centered text button right under the main button ("Skip", "Not
// now"). Desktop: a text link at the bottom of the content panel.
export function Skip({ desk, label, deskLabel, onClick, disabled }) {
  if (desk) {
    return (
      <div className="kob-bottom">
        <button type="button" onClick={onClick} disabled={disabled}>
          {deskLabel || label}
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="kob-skip"
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

// "Confirm in your wallet" and other waiting states.
export function Status({ title, hint, chain }) {
  return (
    <div className="kob-status" role="status">
      <div className="kob-spinner" />
      <div className="kob-status-text">
        <div className="kob-status-title">{title}</div>
        <div className="kob-status-hint">{hint}</div>
      </div>
      {chain && <div className="kob-status-chain">{chain}</div>}
    </div>
  );
}

export function ErrorText({ children }) {
  if (!children) return null;
  return (
    <div role="alert" className="kob-error">
      {children}
    </div>
  );
}
