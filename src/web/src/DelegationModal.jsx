import { useState, useEffect, useImperativeHandle, forwardRef } from "react";
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
  const account = useAccount();

  const { toast, delegations } = props;
  
  const MODAL_DISMISSED_KEY = `delegation-modal-dismissed-${account.address}`;

  function openModal(forceOpen = false) {
    if (
      !account.isConnected ||
      (window.location.pathname !== "/" &&
        window.location.pathname !== "/new" &&
        window.location.pathname !== "/submit" &&
        window.location.pathname !== "/stories" &&
        window.location.pathname !== "/gateway" &&
        window.location.pathname !== "/best")
    ) {
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

  const customStyles = {
    overlay: {
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      zIndex: 1000,
    },
    content: {
      fontSize: "1.025rem",
      backgroundColor: "#e6e6df",
      border: "1px solid #828282",
      overflow: "auto",
      WebkitOverflowScrolling: "touch",
      borderRadius: "2px",
      outline: "none",
      padding: "3px 20px",
      position: "absolute",
      top: "50%",
      left: "50%",
      right: "auto",
      bottom: "auto",
      marginRight: "-50%",
      transform: "translate(-50%, -50%)",
      maxWidth: "80%",
      width: "400px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      zIndex: 1001,
    },
  };

  // Apply different styles for mobile
  if (window.innerWidth <= 768) {
    customStyles.content = {
      ...customStyles.content,
      top: "15%",
      left: "5%",
      right: "5%",
      transform: "none",
      width: "80%",
    };
  }

  // Apply different styles for tablet
  if (window.innerWidth <= 1024 && window.innerWidth > 768) {
    customStyles.content = {
      ...customStyles.content,
      inset: "10% 25% auto",
      top: "40%",
      left: "10%",
      right: "10%",
      width: "80%",
      transform: "none",
      maxWidth: "50%",
    };
  }
  return (
    <Modal
      isOpen={showModal}
      contentLabel="Kiwi News Modal"
      shouldCloseOnOverlayClick={false}
      style={customStyles}
      closeTimeoutMS={0}
    >
      <button
        onClick={closeModal}
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          background: "none",
          border: "none",
          fontSize: "1.5rem",
          cursor: "pointer",
          color: "#828282",
          padding: "0",
          width: "30px",
          height: "30px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-label="Close modal"
      >
        ×
      </button>
      <DelegateButton
        callback={closeModal}
        delegations={delegations}
        toast={toast}
        style={{
          border: "none",
        }}
        isAppOnboarding={false}
      />
    </Modal>
  );
});

SimpleModal.displayName = "SimpleModal";

export default SimpleModal;
