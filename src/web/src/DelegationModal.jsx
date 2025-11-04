import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import Modal from "react-modal";
import { useAccount } from "wagmi";
import { resolveIdentity } from "@attestate/delegator2";

import { getLocalAccount } from "./session.mjs";
import DelegateButton from "./DelegateButton.jsx";

if (document.querySelector("nav-delegation-modal")) {
  Modal.setAppElement("nav-delegation-modal");
}

const SimpleModal = forwardRef((props, ref) => {
  const [showModal, setShowModal] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const account = useAccount();

  const { toast, delegations } = props;
  
  const MODAL_DISMISSED_KEY = `delegation-modal-dismissed-${account.address}`;

  function openModal(forceOpen = false) {
    if (!account.isConnected) {
      closeModal();
      return;
    }

    // Allow modal on main pages and any story page (including dynamic routes like /stories/some-title)
    const allowedPaths = ["/", "/new", "/submit", "/gateway", "/best"];
    const isStoryPage = window.location.pathname.startsWith("/stories");
    const isAllowedPath = allowedPaths.includes(window.location.pathname) || isStoryPage;

    if (!isAllowedPath) {
      closeModal();
      return;
    }

    const isEligible = resolveIdentity(delegations, account.address);
    const localAccount = getLocalAccount(account.address);
    const wasDismissed = localStorage.getItem(MODAL_DISMISSED_KEY) === "true";

    if (isEligible && !localAccount && (forceOpen || !wasDismissed)) {
      setShowModal(true);
    }
  }

  function closeModal() {
    setShowModal(false);
    if (account.address) {
      localStorage.setItem(MODAL_DISMISSED_KEY, "true");
    }
  }

  useEffect(() => {
    openModal();
  }, [account.address, account.isConnected]);

  useImperativeHandle(ref, () => ({
    openModalForAction: () => {
      const isEligible = resolveIdentity(delegations, account.address);
      const localAccount = getLocalAccount(account.address);
      
      if (isEligible && !localAccount) {
        openModal(true);
      }
    }
  }));

  // Porto-style modal settings
  const customStyles = {
    overlay: {
      backgroundColor: "var(--bg-overlay)",
      zIndex: 1000,
    },
    content: {
      fontSize: "15px",
      lineHeight: "1.325",
      fontFamily: "ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
      backgroundColor: "var(--bg-white)",
      border: "1px solid rgba(0, 0, 0, 0.1)",
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

  // Apply Porto drawer style for mobile (bottom drawer)
  if (window.innerWidth < 480) {
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

  const domain = typeof window !== "undefined" ? window.location.hostname : "kiwistand.com";
  const domainParts = domain.split(".");
  const subdomain = domainParts.length > 2 ? domainParts[0] : "";
  const mainDomain = domainParts.length > 2 ? domainParts.slice(1).join(".") : domain;

  return (
    <Modal
      isOpen={showModal}
      contentLabel="Kiwi News Modal"
      shouldCloseOnOverlayClick={false}
      style={customStyles}
      closeTimeoutMS={0}
    >
      {/* Porto-style header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "33px",
        borderBottom: "1px solid rgba(0, 0, 0, 0.1)",
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
        {!isIndexing && (
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
        )}
      </div>

      <DelegateButton
        callback={closeModal}
        delegations={delegations}
        toast={toast}
        onIndexingStateChange={setIsIndexing}
        style={{
          border: "none",
          backgroundColor: "transparent",
          padding: "0",
          boxShadow: "none",
        }}
        isAppOnboarding={false}
      />
    </Modal>
  );
});

SimpleModal.displayName = "SimpleModal";

export default SimpleModal;
