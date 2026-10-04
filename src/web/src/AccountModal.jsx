// Backup / logout-warning modal for wallet-less local accounts.
//
// Modes:
// - "created": shown right after a new account was generated. Shows the
//   recovery phrase and asks the user to save it before continuing.
// - "backup": lets the user look at (and copy) their recovery phrase later.
// - "logout": warns that logging out deletes the account from this browser
//   and that it can only be recovered with the recovery phrase.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import Modal from "react-modal";

import {
  getLocalAccountBackup,
  markLocalAccountBackedUp,
  flagAccountCreated,
  logout,
} from "./session.mjs";

if (typeof document !== "undefined") {
  Modal.setAppElement("body");
}

const buttonBase = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "38px",
  borderRadius: "8px",
  fontSize: "15px",
  cursor: "pointer",
  whiteSpace: "nowrap",
  padding: "0 16px",
};

const primaryButton = {
  ...buttonBase,
  backgroundColor: "var(--accent-primary)",
  border: "1px solid var(--accent-primary)",
  color: "var(--bg-black)",
};

const secondaryButton = {
  ...buttonBase,
  backgroundColor: "transparent",
  border: "var(--border-thin)",
  color: "var(--text-primary)",
};

const dangerButton = {
  ...buttonBase,
  backgroundColor: "var(--color-error, #d32f2f)",
  border: "1px solid var(--color-error, #d32f2f)",
  color: "#fff",
};

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    } catch (err2) {
      return false;
    }
  }
}

const RecoveryPhrase = ({ backup }) => {
  const [copied, setCopied] = useState(false);
  const secret = backup.phrase || backup.privateKey;
  const words = backup.phrase ? backup.phrase.split(" ") : null;

  const handleCopy = async () => {
    const ok = await copyText(secret);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div
        style={{
          fontSize: "12px",
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {words ? "Your recovery phrase" : "Your private key"}
      </div>
      {words ? (
        <ol
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "6px",
            margin: 0,
            padding: "10px",
            listStyle: "none",
            border: "var(--border-thin)",
            borderRadius: "4px",
            backgroundColor: "var(--bg-off-white, transparent)",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: "13px",
            userSelect: "all",
          }}
        >
          {words.map((word, i) => (
            <li key={i} style={{ whiteSpace: "nowrap" }}>
              <span style={{ color: "var(--text-secondary)" }}>{i + 1}.</span>{" "}
              {word}
            </li>
          ))}
        </ol>
      ) : (
        <code
          style={{
            display: "block",
            padding: "10px",
            border: "var(--border-thin)",
            borderRadius: "4px",
            wordBreak: "break-all",
            fontSize: "12px",
            userSelect: "all",
          }}
        >
          {secret}
        </code>
      )}
      <button type="button" style={secondaryButton} onClick={handleCopy}>
        {copied ? "Copied!" : "Copy to clipboard"}
      </button>
    </div>
  );
};

const Warning = ({ children }) => (
  <div
    style={{
      padding: "10px",
      borderRadius: "4px",
      border: "1px solid var(--color-error, #d32f2f)",
      color: "var(--text-primary)",
      fontSize: "13px",
      lineHeight: "1.4",
    }}
  >
    {children}
  </div>
);

const AccountModal = ({ mode, onClose }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [revealed, setRevealed] = useState(mode === "created");
  const backup = getLocalAccountBackup();

  const close = () => {
    setIsOpen(false);
    onClose && onClose();
  };

  const finishCreation = () => {
    if (confirmed) markLocalAccountBackedUp();
    if (backup) flagAccountCreated(backup.address);
    setIsOpen(false);
    window.location.reload();
  };

  const handleRequestClose = () => {
    // A freshly created account must still reload the page so that every
    // component picks up the new identity.
    if (mode === "created") return finishCreation();
    close();
  };

  const customStyles = {
    overlay: {
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      zIndex: 1002,
    },
    content: {
      fontSize: "15px",
      lineHeight: "1.325",
      fontFamily:
        "ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
      backgroundColor: "var(--bg-white)",
      color: "var(--text-primary)",
      border: "var(--border-subtle)",
      borderRadius: "2px",
      outline: "none",
      padding: "16px",
      position: "absolute",
      top: "16px",
      left: "50%",
      right: "auto",
      bottom: "auto",
      transform: "translateX(-50%)",
      width: "calc(100% - 32px)",
      maxWidth: "400px",
      maxHeight: "calc(100% - 32px)",
      overflowY: "auto",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      zIndex: 1003,
    },
  };

  if (!backup) {
    return (
      <Modal
        isOpen={isOpen}
        onRequestClose={close}
        style={customStyles}
        contentLabel="Account"
      >
        <div>No wallet-less account found in this browser.</div>
        <button type="button" style={secondaryButton} onClick={close}>
          Close
        </button>
      </Modal>
    );
  }

  let title;
  if (mode === "created") title = "Your account is ready!";
  else if (mode === "logout") title = "Before you log out";
  else title = "Back up your account";

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={handleRequestClose}
      shouldCloseOnOverlayClick={mode !== "created"}
      style={customStyles}
      contentLabel={title}
    >
      <div style={{ fontSize: "18px", fontWeight: 500 }}>{title}</div>

      {mode === "created" && (
        <div style={{ fontSize: "14px" }}>
          No wallet needed. Your account lives in this browser. Write down the
          12 words below: they're the only way to log in on another device or
          to get your account back if this browser's data gets cleared.
        </div>
      )}

      {mode === "logout" && (
        <Warning>
          <b>Your account only exists in this browser.</b> Logging out deletes
          it from here. Without your recovery phrase, the account (and your
          name, karma and history) is lost forever. Nobody, including the Kiwi
          team, can recover it.
        </Warning>
      )}

      {mode !== "logout" && (
        <Warning>
          <b>Keep this secret.</b> Anyone with these words can post as you.
          Never share them. If you lose them and this browser's data is
          cleared, your account is gone for good.
        </Warning>
      )}

      {revealed ? (
        <RecoveryPhrase backup={backup} />
      ) : (
        <button
          type="button"
          style={secondaryButton}
          onClick={() => setRevealed(true)}
        >
          Show recovery phrase
        </button>
      )}

      {(mode === "created" || mode === "logout") && (
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            style={{ marginTop: "3px" }}
          />
          <span>I saved my recovery phrase somewhere safe</span>
        </label>
      )}

      {mode === "created" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <button
            type="button"
            style={{
              ...primaryButton,
              opacity: confirmed ? 1 : 0.5,
              cursor: confirmed ? "pointer" : "not-allowed",
            }}
            disabled={!confirmed}
            onClick={finishCreation}
          >
            Continue
          </button>
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-secondary)",
              fontSize: "13px",
              cursor: "pointer",
              textDecoration: "underline",
            }}
            onClick={finishCreation}
          >
            I'll do it later (you can find it in the menu under "Back up
            account")
          </button>
        </div>
      )}

      {mode === "backup" && (
        <button
          type="button"
          style={primaryButton}
          onClick={() => {
            if (revealed) markLocalAccountBackedUp();
            close();
          }}
        >
          Done
        </button>
      )}

      {mode === "logout" && (
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button type="button" style={secondaryButton} onClick={close}>
            Cancel
          </button>
          <button
            type="button"
            style={{
              ...dangerButton,
              opacity: confirmed ? 1 : 0.5,
              cursor: confirmed ? "pointer" : "not-allowed",
            }}
            disabled={!confirmed}
            onClick={() => logout({ force: true })}
          >
            Log out
          </button>
        </div>
      )}
    </Modal>
  );
};

let root = null;
let container = null;

export function openAccountModal(mode = "backup") {
  if (!container) {
    container = document.createElement("div");
    container.id = "kiwi-account-modal";
    document.body.appendChild(container);
    root = createRoot(container);
  }
  // NOTE: A changing key remounts the modal so its state starts fresh.
  root.render(
    <AccountModal
      key={`${mode}-${Date.now()}`}
      mode={mode}
      onClose={() => root.render(null)}
    />,
  );
}

export default AccountModal;
