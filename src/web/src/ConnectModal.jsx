import React, { useEffect } from "react";
import Modal from "react-modal";
import { useConnect, useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { permissions } from "./permissions";

const customStyles = {
  content: {
    top: "50%",
    left: "50%",
    right: "auto",
    bottom: "auto",
    marginRight: "-50%",
    transform: "translate(-50%, -50%)",
    padding: "0",
    borderRadius: "2px",
    maxWidth: "400px",
    width: "90%",
    border: "1px solid rgba(166, 110, 78, 0.15)",
    background: "#f6f6ef",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.15)",
  },
  overlay: {
    backgroundColor: "rgba(0, 0, 0, 0.4)",
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
        console.log("Porto: Attempting to connect with permissions:", permissions());
        const result = await connect({
          capabilities: {
            grantPermissions: permissions(),
          },
          connector: portoConnector,
        });
        console.log("Porto: Connection successful:", result);
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
      <div style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "200px"
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid rgba(166, 110, 78, 0.15)",
          background: "#fafafa"
        }}>
          <h2 style={{
            margin: "0",
            fontSize: "18px",
            fontWeight: "600",
            color: "black",
            fontFamily: "var(--font-family)"
          }}>
            Connect to Kiwi News
          </h2>
          <p style={{
            margin: "8px 0 0 0",
            fontSize: "13px",
            color: "#828282",
            fontFamily: "var(--font-family)"
          }}>
            Choose how you'd like to connect
          </p>
        </div>

        {/* Content */}
        <div style={{
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }}>
          <button
            onClick={handlePortoConnect}
            disabled={isPending}
            className="primary-action-button"
            style={{
              padding: "14px 20px",
              fontSize: "15px",
              border: "1px solid black",
              borderRadius: "2px",
              background: "black",
              color: "white",
              cursor: isPending ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              fontFamily: "var(--font-family)",
              fontWeight: "500",
              transition: "all 0.15s ease",
              opacity: isPending ? "0.6" : "1"
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
            <span>{isPending ? "Connecting..." : "Sign in with Email"}</span>
          </button>

          <button
            onClick={handleWalletConnect}
            className="primary-action-button"
            style={{
              padding: "14px 20px",
              fontSize: "15px",
              border: "1px solid rgba(166, 110, 78, 0.3)",
              borderRadius: "2px",
              background: "white",
              color: "black",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              fontFamily: "var(--font-family)",
              fontWeight: "500",
              transition: "all 0.15s ease"
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <span>Connect Wallet</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
