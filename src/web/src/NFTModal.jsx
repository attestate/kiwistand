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
                borderRadius: "2px",
                marginBottom: "15px",
              }}
            />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "2rem",
          }}
        >
          <a
            href="/kiwipass-mint"
            target="_blank"
            style={{ margin: "0px auto" }}
          >
            <button style={{ width: "auto" }} id="button-onboarding">
              Sign up
            </button>
          </a>
          <span
            style={{
              padding: "10px 15px",
              borderRadius: "2px",
              backgroundColor: "rgba(0,0,0,0.1)",
              color: "black",
              cursor: "pointer",
            }}
            onClick={closeModal}
          >
            {closeText}
          </span>
        </div>
      </div>
    </Modal>
  );
};

export default NFTModal;
