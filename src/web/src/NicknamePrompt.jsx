import React, { useState, useEffect } from "react";

import { EditProfileModal, useIdentity } from "./EditProfile.jsx";

const DISMISSED = "kiwi-nickname-prompt-dismissed";
// Set right after a passkey account is created (LoginModal) so the editor
// opens once the page has reloaded.
export const OPEN_EDITOR = "kiwi-open-profile-editor";

function takeOpenFlag() {
  try {
    const flag = localStorage.getItem(OPEN_EDITOR);
    localStorage.removeItem(OPEN_EDITOR);
    return flag === "true";
  } catch {
    return false;
  }
}
const WEEK = 7 * 24 * 60 * 60 * 1000;

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISSED)) || 0;
    return Date.now() - at < WEEK;
  } catch {
    return false;
  }
}

function consentPending() {
  try {
    return localStorage.getItem("kiwi-analytics-consent") === null;
  } catch {
    return false;
  }
}

// NOTE: Asks people who show up as a truncated address (no Kiwi nickname, ENS
// or Farcaster name) to pick a nickname. It's fixed to the bottom of the
// screen so it never moves the page (CLS), and waits for the analytics
// banner, which sits in the same spot. Other code can open the editor with
// window.dispatchEvent(new Event("kiwi-edit-profile")), e.g. right after
// creating an account.
export default function NicknamePrompt({ toast }) {
  const { identity, local } = useIdentity();
  const [unnamed, setUnnamed] = useState(false);
  const [hidden, setHidden] = useState(dismissedRecently);
  const [waiting, setWaiting] = useState(consentPending);
  const [editing, setEditing] = useState(takeOpenFlag);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 641);

  useEffect(() => {
    const decided = () => setWaiting(consentPending());
    const open = () => setEditing(true);
    const resize = () => setIsDesktop(window.innerWidth >= 641);
    window.addEventListener("analyticsConsentChange", decided);
    window.addEventListener("kiwi-edit-profile", open);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("analyticsConsentChange", decided);
      window.removeEventListener("kiwi-edit-profile", open);
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    setUnnamed(false);
    if (!identity) return;
    fetch(`/api/v1/profile-status/${identity}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (body?.data) setUnnamed(!body.data.hasName);
      })
      .catch(() => {});
  }, [identity]);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED, String(Date.now()));
    } catch {}
    setHidden(true);
  };

  const card = unnamed && !hidden && !waiting && !editing && (
    <div
      className="tf-card"
      role="region"
      aria-label="Pick a nickname"
      style={{
        position: "fixed",
        zIndex: 1000,
        margin: 0,
        right: isDesktop ? "20px" : "8px",
        left: isDesktop ? "auto" : "8px",
        bottom: isDesktop
          ? "20px"
          : "calc(53px + env(safe-area-inset-bottom, 0px))",
        maxWidth: isDesktop ? "360px" : "none",
        boxShadow: "var(--shadow-default)",
      }}
    >
      <div className="tf-card-body">
        <div className="tf-card-title">Pick a nickname</div>
        <div className="tf-card-copy">
          People see you as {identity.slice(0, 6)}...{identity.slice(-4)}.
          Choose a name, picture and bio.
        </div>
        <button
          type="button"
          className="tf-card-get"
          style={{ border: "none", cursor: "pointer" }}
          onClick={() => setEditing(true)}
        >
          Choose a nickname
        </button>
      </div>
      <button
        type="button"
        className="tf-card-close"
        aria-label="Dismiss"
        onClick={dismiss}
      >
        ×
      </button>
    </div>
  );

  return (
    <>
      {card}
      {identity && (
        <EditProfileModal
          identity={identity}
          local={local}
          isOpen={editing}
          toast={toast}
          onClose={() => setEditing(false)}
          onSaved={(profile) => {
            setEditing(false);
            if (profile.name) setUnnamed(false);
          }}
        />
      )}
    </>
  );
}
