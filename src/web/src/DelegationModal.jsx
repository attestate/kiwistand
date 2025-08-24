import { useState, useEffect } from "react";
import Modal from "react-modal";
import { useAccount } from "wagmi";
import { eligible } from "@attestate/delegator2";

import { getLocalAccount } from "./session.mjs";
import DelegateButton from "./DelegateButton.jsx";

if (document.querySelector("nav-delegation-modal")) {
  Modal.setAppElement("nav-delegation-modal");
}

function SimpleModal(props) {
  const [showModal, setShowModal] = useState(false);
  const account = useAccount();

  const { toast, allowlist, delegations } = props;

  function openModal() {
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

    const isEligible = eligible(allowlist, delegations, account.address);
    const localAccount = getLocalAccount(account.address, allowlist);

    if (isEligible && !localAccount) {
      setShowModal(true);
    }
  }

  function closeModal() {
    setShowModal(false);
  }

  useEffect(() => {
    openModal();
  }, [account.address, account.isConnected]);

  const customStyles = {
    overlay: {
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      zIndex: 6,
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
    >
      <DelegateButton
        callback={closeModal}
        allowlist={allowlist}
        delegations={delegations}
        toast={toast}
        style={{
          border: "none",
        }}
        isAppOnboarding={false}
      />
    </Modal>
  );
}

export default SimpleModal;
