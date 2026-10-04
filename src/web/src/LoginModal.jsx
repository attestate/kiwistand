import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import Modal from "react-modal";
import { useConnectModal } from "@rainbow-me/rainbowkit";

import { createLocalAccount, restoreLocalAccount } from "./session.mjs";

if (typeof document !== "undefined") {
  Modal.setAppElement("body");
}

const SparkleIcon = () => (
  <svg viewBox="0 0 256 256" width="1.2em" height="1.2em" style={{ width: "18px", height: "18px" }}>
    <path fill="currentColor" d="m230.86 109.25l-61.68-22.43l-22.43-61.68a19.95 19.95 0 0 0-37.5 0L86.82 86.82l-61.68 22.43a19.95 19.95 0 0 0 0 37.5l61.68 22.43l22.43 61.68a19.95 19.95 0 0 0 37.5 0l22.43-61.68l61.68-22.43a19.95 19.95 0 0 0 0-37.5m-75.14 39.29a12 12 0 0 0-7.18 7.18L128 212.21l-20.54-56.49a12 12 0 0 0-7.18-7.18L43.79 128l56.49-20.54a12 12 0 0 0 7.18-7.18L128 43.79l20.54 56.49a12 12 0 0 0 7.18 7.18L212.21 128Z"></path>
  </svg>
);

const VerifiedIcon = () => (
  <svg viewBox="0 0 24 24" width="1.2em" height="1.2em" style={{ height: "16px", width: "16px", color: "var(--accent-primary)" }}>
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77a4 4 0 0 1 6.74 0a4 4 0 0 1 4.78 4.78a4 4 0 0 1 0 6.74a4 4 0 0 1-4.77 4.78a4 4 0 0 1-6.75 0a4 4 0 0 1-4.78-4.77a4 4 0 0 1 0-6.76"></path>
      <path d="m9 12l2 2l4-4"></path>
    </g>
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" width="1.2em" height="1.2em" style={{ height: "18px", width: "18px" }}>
    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 6L6 18M6 6l12 12"></path>
  </svg>
);

const GhostIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="1.2em" height="1.2em">
    <rect width="256" height="256" fill="none"/>
    <circle cx="100" cy="116" r="12"/>
    <circle cx="156" cy="116" r="12"/>
    <path d="M216,216l-29.33-24-29.34,24L128,192,98.67,216,69.33,192,40,216V120a88,88,0,0,1,176,0Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
  </svg>
);

const WalletIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="1.2em" height="1.2em">
    <rect width="256" height="256" fill="none"/>
    <path d="M40,56V184a16,16,0,0,0,16,16H216a8,8,0,0,0,8-8V80a8,8,0,0,0-8-8H56A16,16,0,0,1,40,56h0A16,16,0,0,1,56,40H192" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
    <circle cx="180" cy="132" r="12"/>
  </svg>
);

const KeyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="1.2em" height="1.2em">
    <rect width="256" height="256" fill="none"/>
    <path d="M93.17,122.83A71.68,71.68,0,0,1,88,95.91c0-38.58,31.08-70.64,69.64-71.87A72,72,0,0,1,232,98.36C230.73,136.92,198.67,168,160.09,168a71.68,71.68,0,0,1-26.92-5.17h0L120,176H96v24H72v24H40a8,8,0,0,1-8-8V187.31a8,8,0,0,1,2.34-5.65l58.83-58.83Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
    <circle cx="180" cy="76" r="12"/>
  </svg>
);

const LoginModal = forwardRef((props, ref) => {
  const [showModal, setShowModal] = useState(false);
  const [isButtonActive, setIsButtonActive] = useState(false);
  const [isAnonButtonHovered, setIsAnonButtonHovered] = useState(false);
  const [isCreateButtonHovered, setIsCreateButtonHovered] = useState(false);
  const [isWalletButtonHovered, setIsWalletButtonHovered] = useState(false);
  const [view, setView] = useState("main"); // "main" | "restore"
  const [recoveryInput, setRecoveryInput] = useState("");
  const [restoreError, setRestoreError] = useState("");
  const { openConnectModal } = useConnectModal();

  function openModal() {
    setView("main");
    setRecoveryInput("");
    setRestoreError("");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
  }

  useImperativeHandle(ref, () => ({
    openModal,
    closeModal,
  }));

  const handleConnectWallet = () => {
    closeModal();
    if (openConnectModal) {
      openConnectModal();
    }
  };

  const handleCreateAccount = async () => {
    let account;
    try {
      account = createLocalAccount();
    } catch (err) {
      console.error("Could not create account:", err);
      if (props.toast) props.toast.error("Couldn't create your account");
      return;
    }
    closeModal();
    // Show the recovery phrase right away; the modal reloads the page when
    // the user continues so every component picks up the new identity.
    try {
      const { openAccountModal } = await import("./AccountModal.jsx");
      openAccountModal("created");
    } catch (err) {
      console.error("Could not open backup modal:", err);
      window.location.reload();
    }
  };

  const handleRestore = (e) => {
    e.preventDefault();
    try {
      restoreLocalAccount(recoveryInput);
    } catch (err) {
      setRestoreError(err.message);
      return;
    }
    setRecoveryInput("");
    closeModal();
    window.location.reload();
  };

  const handleAnonMode = () => {
    // Enable anon mode
    localStorage.setItem('anon-mode', 'true');
    // Set the theme
    document.documentElement.setAttribute('data-theme', 'anon');
    closeModal();
    // Reload to apply all anon mode changes
    window.location.reload();
  };

  // Modal settings
  const customStyles = {
    overlay: {
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      zIndex: 1000,
    },
    content: {
      fontSize: "15px",
      lineHeight: "1.325",
      fontFamily: "ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
      backgroundColor: "var(--bg-white)",
      border: "var(--border-subtle)",
      overflow: "hidden",
      WebkitOverflowScrolling: "touch",
      borderRadius: "2px",
      outline: "none",
      padding: "0",
      position: "absolute",
      top: "16px",
      left: "50%",
      right: "auto",
      bottom: "auto",
      marginRight: "-50%",
      transform: "translateX(-50%)",
      maxWidth: "360px",
      minWidth: "360px",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      zIndex: 1001,
    },
  };

  // Apply drawer style for mobile (bottom drawer)
  if (typeof window !== "undefined" && window.innerWidth < 480) {
    customStyles.content = {
      ...customStyles.content,
      top: "auto",
      left: "0",
      right: "0",
      bottom: "0",
      transform: "none",
      maxWidth: "460px",
      minWidth: "360px",
      margin: "0 auto",
      borderBottomLeftRadius: "0",
      borderBottomRightRadius: "0",
      borderBottom: "none",
    };
  }

  const domain = typeof window !== "undefined" ? window.location.hostname : "kiwistand.com";
  const domainParts = domain.split(".");
  const subdomain = domainParts.length > 2 ? domainParts[0] : "";
  const mainDomain = domainParts.length > 2 ? domainParts.slice(1).join(".") : domain;

  return (
    <Modal
      isOpen={showModal}
      contentLabel="Log In to Kiwi News"
      shouldCloseOnOverlayClick={true}
      onRequestClose={closeModal}
      style={customStyles}
      closeTimeoutMS={0}
    >
      {/* header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "33px",
        borderBottom: "var(--border-thin)",
        padding: "0 0 0 12px",
        userSelect: "none",
        whiteSpace: "nowrap",
        boxSizing: "border-box",
        width: "100%",
        backgroundColor: "var(--bg-white)",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          flex: 1,
          minWidth: 0,
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            fontSize: "13px",
            gap: "8px",
          }}>
            <div style={{
              borderRadius: "2px",
              height: "20px",
              width: "20px",
              overflow: "hidden",
            }}>
              <img height="20" width="20" alt="" src="data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='20'%20height='20'%20fill='none'%3e%3cpath%20fill='%23D9D9D9'%20d='M0%200h20v20H0z'/%3e%3cg%20stroke='%23000'%20stroke-linecap='round'%20stroke-linejoin='round'%20clip-path='url(%23a)'%3e%3cpath%20d='M15.565%2011.75h-2.648a1.167%201.167%200%200%200-1.167%201.167v2.648M7.083%204.948v.969a1.75%201.75%200%200%200%201.75%201.75A1.167%201.167%200%200%201%2010%208.833a1.167%201.167%200%201%200%202.333%200A1.17%201.17%200%200%201%2013.5%207.667h1.849m-5.932%208.137V13.5a1.167%201.167%200%200%200-1.167-1.167%201.167%201.167%200%200%201-1.166-1.166v-.584a1.167%201.167%200%200%200-1.167-1.166h-1.72'/%3e%3cpath%20d='M10%2015.833a5.833%205.833%200%201%200%200-11.666%205.833%205.833%200%200%200%200%2011.666Z'/%3e%3c/g%3e%3cdefs%3e%3cclipPath%20id='a'%3e%3cpath%20fill='%23fff'%20d='M3%203h14v14H3z'/%3e%3c/clipPath%3e%3c/defs%3e%3c/svg%3e" />
            </div>
            <div style={{ fontSize: "14px", lineHeight: "22px", fontWeight: "normal" }}>
              <div style={{ display: "flex", overflow: "hidden" }} title={`https://${domain}/`}>
                {subdomain && (
                  <>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{subdomain}</div>
                    <div>.</div>
                  </>
                )}
                <div>{mainDomain}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <VerifiedIcon />
            </div>
          </div>
        </div>
        <button
          onClick={closeModal}
          type="button"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            padding: "0 6px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            borderTopRightRadius: "2px",
          }}
          title="Close Dialog"
          aria-label="Close modal"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Modal content */}
      <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
        {/* title section */}
        <div style={{ display: "flex", flexDirection: "column", padding: "12px 12px 8px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingBottom: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                backgroundColor: "var(--color-badge-bg)",
                color: "var(--color-badge-icon)",
              }}>
                <SparkleIcon />
              </div>
              <div style={{ fontSize: "18px", fontWeight: "500", color: "var(--text-primary)" }}>
                Welcome to Kiwi News!
              </div>
            </div>
          </div>
        </div>

        {/* content section */}
        <div style={{ flexGrow: 1, padding: "0 12px 12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "15px", color: "var(--text-primary)", lineHeight: "22px" }}>
              {view === "restore"
                ? "Enter the 12-word recovery phrase you saved when you created your account."
                : "Please sign in to continue"}
            </div>
          </div>
        </div>

        {view === "restore" ? (
          <form
            onSubmit={handleRestore}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              padding: "0 16px 12px",
            }}
          >
            <textarea
              value={recoveryInput}
              onChange={(e) => {
                setRecoveryInput(e.target.value);
                setRestoreError("");
              }}
              rows={3}
              autoFocus
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="word1 word2 word3 ..."
              aria-label="Recovery phrase"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "8px",
                fontSize: "14px",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                border: "var(--border-thin)",
                borderRadius: "4px",
                backgroundColor: "var(--bg-white)",
                color: "var(--text-primary)",
                resize: "vertical",
              }}
            />
            {restoreError && (
              <div style={{ color: "var(--color-error, #d32f2f)", fontSize: "13px" }}>
                {restoreError}
              </div>
            )}
            <button
              type="submit"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: "38px",
                backgroundColor: "var(--accent-primary)",
                border: "1px solid var(--accent-primary)",
                color: "var(--bg-black)",
                borderRadius: "8px",
                fontSize: "15px",
                cursor: "pointer",
              }}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => {
                setView("main");
                setRestoreError("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-secondary)",
                fontSize: "13px",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Back
            </button>
          </form>
        ) : (
        <div style={{
          display: "flex",
          minHeight: "48px",
          width: "100%",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          paddingBottom: "12px",
        }}>
          <div style={{
            display: "flex",
            width: "100%",
            flexDirection: "column",
            gap: "8px",
          }}>
            {/* Primary button - Create a wallet-less account */}
            <button
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: "38px",
                backgroundColor: isCreateButtonHovered ? "var(--accent-primary-hover)" : "var(--accent-primary)",
                border: isCreateButtonHovered ? "1px solid var(--accent-primary-hover)" : "1px solid var(--accent-primary)",
                color: "var(--bg-black)",
                borderRadius: "8px",
                fontSize: "15px",
                fontWeight: "normal",
                cursor: "pointer",
                transform: isButtonActive ? "translateY(1px)" : "translateY(0)",
                transition: "background-color 0.15s ease, border-color 0.15s ease, transform 0.05s ease",
                margin: "0 16px",
                whiteSpace: "nowrap",
              }}
              onClick={handleCreateAccount}
              onMouseEnter={() => setIsCreateButtonHovered(true)}
              onMouseLeave={() => {
                setIsCreateButtonHovered(false);
                setIsButtonActive(false);
              }}
              onMouseDown={() => setIsButtonActive(true)}
              onMouseUp={() => setIsButtonActive(false)}
            >
              <div style={{ display: "flex", alignItems: "center", height: "100%", gap: "8px" }}>
                <SparkleIcon />
                <span>Create account (no wallet needed)</span>
              </div>
            </button>

            {/* Secondary button - Connect wallet */}
            <button
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: "38px",
                backgroundColor: isWalletButtonHovered ? "var(--accent-primary)" : "transparent",
                border: isWalletButtonHovered ? "1px solid var(--accent-primary)" : "var(--border-thin)",
                color: isWalletButtonHovered ? "var(--bg-black)" : "var(--text-primary)",
                borderRadius: "8px",
                fontSize: "15px",
                fontWeight: "normal",
                cursor: "pointer",
                transition: "all 0.15s ease",
                margin: "0 16px",
                whiteSpace: "nowrap",
              }}
              onClick={handleConnectWallet}
              onMouseEnter={() => setIsWalletButtonHovered(true)}
              onMouseLeave={() => setIsWalletButtonHovered(false)}
            >
              <div style={{ display: "flex", alignItems: "center", height: "100%", gap: "8px" }}>
                <WalletIcon />
                <span>Connect wallet</span>
              </div>
            </button>

            {/* Tertiary button - Anon mode */}
            <button
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: "38px",
                backgroundColor: isAnonButtonHovered ? "rgba(124, 152, 133, 0.1)" : "transparent",
                border: isAnonButtonHovered ? "1px solid #7c9885" : "var(--border-thin)",
                color: isAnonButtonHovered ? "#7c9885" : "var(--text-primary)",
                borderRadius: "8px",
                fontSize: "15px",
                fontWeight: "normal",
                cursor: "pointer",
                transition: "all 0.15s ease",
                margin: "0 16px",
                whiteSpace: "nowrap",
              }}
              onClick={handleAnonMode}
              onMouseEnter={() => setIsAnonButtonHovered(true)}
              onMouseLeave={() => setIsAnonButtonHovered(false)}
            >
              <div style={{ display: "flex", alignItems: "center", height: "100%", gap: "8px" }}>
                <GhostIcon />
                <span>Anon mode</span>
              </div>
            </button>

            {/* Restore an existing wallet-less account */}
            <button
              type="button"
              onClick={() => setView("restore")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                background: "none",
                border: "none",
                color: "var(--text-secondary)",
                fontSize: "13px",
                cursor: "pointer",
                textDecoration: "underline",
                margin: "0 16px",
              }}
            >
              <KeyIcon />
              <span>Log in with recovery phrase</span>
            </button>
          </div>
        </div>
        )}
      </div>
    </Modal>
  );
});

LoginModal.displayName = "LoginModal";

export default LoginModal;
