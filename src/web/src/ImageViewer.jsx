import React, { useState, useEffect, useCallback } from "react";

const ImageViewer = () => {
  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");

  const handleClose = useCallback(() => {
    setOpen(false);
    setTimeout(() => setImageUrl(""), 300);
  }, []);

  useEffect(() => {
    window.openImageViewer = (url) => {
      setImageUrl(url);
      setOpen(true);
    };
    return () => {
      delete window.openImageViewer;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <div
      onClick={handleClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "zoom-out",
      }}
    >
      <button
        onClick={handleClose}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          background: "none",
          border: "none",
          color: "#fff",
          fontSize: "28px",
          cursor: "pointer",
          lineHeight: 1,
          padding: "8px",
        }}
        aria-label="Close"
      >
        &#x2715;
      </button>
      {imageUrl && (
        <img
          src={imageUrl}
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: "95vw",
            maxHeight: "90vh",
            objectFit: "contain",
            cursor: "default",
          }}
          alt="Full size"
        />
      )}
    </div>
  );
};

export default ImageViewer;
