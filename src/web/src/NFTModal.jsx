import { useState } from "react";
import Modal from "react-modal";

import { PriceComponent } from "./NFTPrice.jsx";

Modal.setAppElement("nav-nft-modal");

const NFTModal = ({ modalIsOpen, setIsOpen, headline, text, closeText }) => {
  const closeModal = () => {
    setIsOpen(false);
  };

  let contentWidth, modalWidth;
  if (window.innerWidth <= 768) {
    modalWidth = "80%";
    contentWidth = "70%";
  } else {
    modalWidth = "45%";
    contentWidth = "60%";
  }

  return (
    <Modal
      isOpen={modalIsOpen}
      onRequestClose={closeModal}
      contentLabel="Kiwi News Modal"
      shouldCloseOnOverlayClick={true}
      style={{
        overlay: {
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 6,
        },
        content: {
          fontSize: "0.9rem",
          backgroundColor: "#e6e6df",
          border: "1px solid #ccc",
          overflow: "auto",
          WebkitOverflowScrolling: "touch",
          borderRadius: "4px",
          outline: "none",
          padding: "20px",
          position: "absolute",
          top: "50%",
          left: "50%",
          right: "auto",
          bottom: "auto",
          marginRight: "-50%",
          transform: "translate(-50%, -50%)",
          maxWidth: modalWidth,
          width: "600px",
          maxHeight: "80vh",
        },
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ width: contentWidth }}>
          <div style={{ textAlign: "left" }}>
            <p style={{ fontWeight: "bold" }}>{headline}</p>
            <p style={{ fontWeight: "normal" }}>{text}</p>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <img
              src="pass.jpeg"
              alt="Kiwi News NFT"
              style={{
                width: "100%",
                borderRadius: "3px",
                marginBottom: "15px",
              }}
            />
          </div>
        </div>
        <a href="/welcome" target="_blank" style={{ margin: "0px auto" }}>
          <button
            style={{
              backgroundColor: "black",
              border: "none",
              color: "white",
              padding: "10px 20px",
              textAlign: "center",
              textDecoration: "none",
              fontSize: "0.9rem",
              cursor: "pointer",
              borderRadius: "3px",
              fontFamily: "'Helvetica', 'Arial', sans-serif",
              display: "flex",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <span>
              Buy for <PriceComponent /> ETH
            </span>
          </button>
        </a>
        <u
          style={{ cursor: "pointer", textAlign: "center", width: "80%" }}
          onClick={closeModal}
        >
          {closeText}
        </u>
      </div>
    </Modal>
  );
};

export default NFTModal;
