import React, { useState, useEffect } from "react";
import { fetchKarma } from "./API.mjs";
import { getCookie } from "./session.mjs";

const GuidelinesDrawer = ({ isOpen, onClose, onContinue }) => {
  if (!isOpen) return null;

  return (
    <>
      <style>
        {`
          @keyframes slideUp {
            from {
              transform: translateY(100%);
            }
            to {
              transform: translateY(0);
            }
          }
        `}
      </style>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 9998,
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "#f6f6ef",
          borderTop: "2px solid #828282",
          borderRadius: "16px 16px 0 0",
          padding: "20px",
          zIndex: 9999,
          animation: "slideUp 0.3s ease-out",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <div style={{ maxWidth: "600px", margin: "0 auto", color: "#000" }}>
          <h2 style={{ marginTop: 0, color: "#000" }}>📝 Before you submit</h2>
          
          <div style={{ marginBottom: "1.5rem" }}>
            <p style={{ margin: "0 0 0.5rem 0", color: "#000" }}>
              Kiwi News is for <strong>builders, engineers, and crypto researchers</strong>. 
              We're looking for content that teaches, informs, or advances the ecosystem.
            </p>
          </div>

          <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
            <div style={{ flex: 1, padding: "1rem", background: "#e8f5e9", borderRadius: "8px" }}>
              <h4 style={{ margin: "0 0 0.5rem 0", color: "#2e7d32" }}>✅ Good content</h4>
              <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "14px", color: "#000" }}>
                <li>Technical resources</li>
                <li>Data insights</li>
                <li>Building updates</li>
                <li>Research & analysis</li>
              </ul>
            </div>
            <div style={{ flex: 1, padding: "1rem", background: "#ffebee", borderRadius: "8px" }}>
              <h4 style={{ margin: "0 0 0.5rem 0", color: "#c62828" }}>❌ Avoid</h4>
              <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "14px", color: "#000" }}>
                <li>Price speculation</li>
                <li>Clickbait headlines</li>
                <li>Shilling/promotion</li>
                <li>Old news</li>
              </ul>
            </div>
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <h4 style={{ color: "#000" }}>Title tips:</h4>
            <ul style={{ paddingLeft: "1.2rem", color: "#000" }}>
              <li>Use the original title when possible</li>
              <li>No emojis or excessive punctuation</li>
              <li>Avoid ALL CAPS</li>
              <li>Be factual and informative</li>
            </ul>
          </div>

          <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
            <button
              onClick={onClose}
              style={{
                padding: "10px 20px",
                background: "transparent",
                border: "1px solid #828282",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "16px",
              }}
            >
              Cancel
            </button>
            <button
              onClick={onContinue}
              style={{
                padding: "10px 20px",
                background: "#000",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "16px",
              }}
            >
              I understand, continue
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export const useGuidelinesCheck = () => {
  const [userKarma, setUserKarma] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkKarma = async () => {
      try {
        const identity = getCookie("identity");
        
        if (!identity) {
          setUserKarma(0);
          setIsLoading(false);
          return;
        }

        const data = await fetchKarma(identity);
        
        if (data && data.karma !== undefined) {
          setUserKarma(data.karma);
        } else {
          setUserKarma(0);
        }
      } catch (err) {
        console.error("Error checking karma:", err);
        setUserKarma(0);
      } finally {
        setIsLoading(false);
      }
    };

    checkKarma();
  }, []);

  const shouldShowGuidelines = !isLoading && userKarma !== null && userKarma < 20;

  return { shouldShowGuidelines, userKarma, isLoading };
};

export default GuidelinesDrawer;