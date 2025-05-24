import { useState, useEffect } from "react";
import Modal from "react-modal";
import { useAccount } from "wagmi";
import { eligible } from "@attestate/delegator2";
import { fetchBalance } from "@wagmi/core";
import { optimism } from "wagmi/chains";
import { parseEther } from "viem";

import { Connector } from "./Navigation.jsx";
import { getLocalAccount } from "./session.mjs";
import { requestFaucet } from "./API.mjs";

if (document.querySelector("nav-kiwipass-modal")) {
  Modal.setAppElement("nav-kiwipass-modal");
}

function SimpleModal(props) {
  const [showModal, setShowModal] = useState(null);
  const account = useAccount();
  const [faucetRequested, setFaucetRequested] = useState(false);

  const { toast, allowlist, delegations } = props;

  // Add useEffect to check balance and silently request funds from faucet if needed
  useEffect(() => {
    const checkBalanceAndRequestFaucet = async () => {
      // Only proceed if user is connected and hasn't requested faucet yet
      if (!account.address || faucetRequested || !account.isConnected) {
        return;
      }

      try {
        // Check user's balance on Optimism
        const balance = await fetchBalance({
          address: account.address,
          chainId: optimism.id,
        });

        // Faucet sends 0.000005 ETH (from faucet.mjs)
        const faucetAmount = parseEther("0.000005");

        // Only request from faucet if balance is less than what the faucet sends
        if (balance.value < faucetAmount) {
          setFaucetRequested(true);

          // Silently request funds without notification
          await requestFaucet(account.address);
          console.log("Faucet requested silently for:", account.address);
        } else {
          console.log(
            "User already has sufficient funds, skipping faucet request",
          );
          setFaucetRequested(true); // Mark as requested to avoid checking again
        }
      } catch (err) {
        console.log("Error in faucet check:", err);
      }
    };

    checkBalanceAndRequestFaucet();
  }, [account.address, account.isConnected, faucetRequested]);

  function openModal() {
    if (
      !account.isConnected ||
      window.location.pathname === "/gateway" ||
      window.location.pathname === "/kiwipass-mint" ||
      window.location.pathname === "/app-onboarding" ||
      window.location.pathname === "/app-testflight" ||
      window.location.pathname === "/demonstration" ||
      window.location.pathname === "/email-notifications" ||
      window.location.pathname === "/invite" ||
      window.location.pathname === "/notifications" ||
      window.location.pathname === "/whattosubmit" ||
      window.location.pathname === "/indexing"
    ) {
      closeModal();
      return;
    }

    if (sessionStorage.getItem("kiwipass-modal-reacted")) {
      return;
    }

    const isEligible = eligible(allowlist, delegations, account.address);
    const localAccount = getLocalAccount(account.address, allowlist);

    if (!isEligible && account.isConnected) {
      setShowModal(true);
    }
  }

  function closeModal() {
    setShowModal(false);
  }

  function declineModal() {
    // Set flag in sessionStorage to not show modal again for this session
    sessionStorage.setItem("kiwipass-modal-reacted", "true");
    closeModal();
  }

  function navigateToMint() {
    sessionStorage.setItem("kiwipass-modal-reacted", "true");
    window.location.pathname = "/kiwipass-mint";
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
      padding: "20px",
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
      isOpen={showModal === true}
      contentLabel="Kiwi News Modal"
      shouldCloseOnOverlayClick={true}
      onRequestClose={declineModal}
      style={customStyles}
    >
      <h2 style={{ textAlign: "center", marginTop: "0" }}>Kiwipass Required</h2>
      <p style={{ margin: "0 2rem" }}>
        To access all features of Kiwi News, you need to get a Kiwipass.
      </p>
      <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
        <button
          id="button-onboarding"
          onClick={navigateToMint}
          style={{ cursor: "pointer" }}
        >
          Get Kiwipass
        </button>
        <button
          onClick={declineModal}
          style={{
            backgroundColor: "transparent",
            border: "1px solid black",
            borderRadius: "2px",
            padding: "8px 16px",
            cursor: "pointer",
          }}
        >
          Not Now
        </button>
      </div>
    </Modal>
  );
}

const Container = (props) => {
  return (
    <Connector {...props}>
      <SimpleModal {...props}>{props.children}</SimpleModal>
    </Connector>
  );
};

export default Container;
