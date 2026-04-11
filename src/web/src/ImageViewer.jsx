import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";

const ImageViewer = () => {
  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => setImageUrl(""), 300);
  };

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
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.touchAction = "";
    };
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={false}
      PaperProps={{
        style: {
          background: "transparent",
          boxShadow: "none",
          margin: 0,
          maxWidth: "95vw",
          maxHeight: "95vh",
          overflow: "visible",
          touchAction: "none",
        },
      }}
      slotProps={{
        backdrop: {
          style: {
            backgroundColor: "rgba(0,0,0,0.9)",
            cursor: "zoom-out",
            touchAction: "none",
          },
        },
      }}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          style={{
            display: "block",
            maxWidth: "95vw",
            maxHeight: "95vh",
            objectFit: "contain",
            touchAction: "none",
          }}
          alt="Full size"
        />
      )}
    </Dialog>
  );
};

export default ImageViewer;
