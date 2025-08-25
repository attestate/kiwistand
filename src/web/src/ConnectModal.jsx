import React, { useEffect } from "react";
import Modal from "react-modal";
import { useConnect, useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";

const customStyles = {
  content: {
    top: "50%",
    left: "50%",
    right: "auto",
    bottom: "auto",
    marginRight: "-50%",
    transform: "translate(-50%, -50%)",
    padding: "30px",
    borderRadius: "12px",
    maxWidth: "400px",
    width: "90%",
    border: "2px solid black",
    background: "white",
  },
  overlay: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 1000,
  },
};

export const ConnectModal = ({ isOpen, onClose }) => {
  const { connectors, connect, isPending } = useConnect();
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  
  // Auto-close modal when connected
  useEffect(() => {
    if (isConnected && isOpen) {
      onClose();
    }
  }, [isConnected, isOpen, onClose]);
  
  const handlePortoConnect = async () => {
    // Find Porto connector - it has ID 'xyz.ithaca.porto'
    const portoConnector = connectors.find(c => c.id === "xyz.ithaca.porto");
    
    if (portoConnector) {
      try {
        await connect({ connector: portoConnector });
        // Modal will auto-close when connected via useEffect
      } catch (error) {
        console.error("Porto connection error:", error);
      }
    } else {
      console.error("Porto connector not found. Available connectors:", connectors.map(c => c.id));
    }
  };
  
  const handleWalletConnect = () => {
    onClose();
    // Use RainbowKit's modal for traditional wallets
    if (openConnectModal) {
      openConnectModal();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      style={customStyles}
      contentLabel="Connect Account"
      ariaHideApp={false}
    >
      <div style={{ textAlign: "center" }}>
        <h2 style={{ marginBottom: "20px", fontSize: "24px" }}>
          Connect to Kiwi News
        </h2>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <button
            onClick={handlePortoConnect}
            disabled={isPending}
            style={{
              padding: "15px 20px",
              fontSize: "16px",
              border: "2px solid black",
              borderRadius: "8px",
              background: "black",
              color: "white",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "#333";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "black";
            }}
          >
            <span>📧</span>
            <span>{isPending ? "Connecting..." : "Sign in with Email"}</span>
          </button>
          
          <button
            onClick={handleWalletConnect}
            style={{
              padding: "15px 20px",
              fontSize: "16px",
              border: "2px solid black",
              borderRadius: "8px",
              background: "white",
              color: "black",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "#f0f0f0";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "white";
            }}
          >
            <span>👛</span>
            <span>Connect Wallet</span>
          </button>
        </div>
        
        <p style={{ marginTop: "20px", fontSize: "14px", color: "#666" }}>
          Email sign-in uses secure passkeys. No passwords needed.
        </p>
      </div>
    </Modal>
  );
};