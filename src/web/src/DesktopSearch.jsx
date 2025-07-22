import React, { useEffect, useState, useRef } from "react";
import { isIOS, isSafariOnMacOS } from "./session.mjs";

const DesktopSearch = () => {
  const [keyIndicator, setKeyIndicator] = useState(null);
  const inputRef = useRef(null);

  // Listen for shortcut key (Command/CTRL + s) to focus search
  useEffect(() => {
    const handleShortcut = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (inputRef.current) inputRef.current.focus();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      // Show spinner before navigation
      document.getElementById('spinner-overlay').style.display = 'block';
      window.location.href = "/search?q=" + encodeURIComponent(e.target.value);
    }
  };

  return (
    <div
      className="desktop-search"
      style={{ display: "flex", alignItems: "center" }}
    >
      {keyIndicator}
      <div style={{ position: "relative" }}>
        <span
          style={{
            position: "absolute",
            left: "8px",
            top: "50%",
            transform: "translateY(-50%)",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 256"
            style={{ width: "1.2rem", color: "black" }}
          >
            <rect width="256" height="256" fill="none" />
            <circle
              cx="112"
              cy="112"
              r="80"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="16"
            />
            <line
              x1="168.57"
              y1="168.57"
              x2="224"
              y2="224"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="16"
            />
          </svg>
        </span>
        <input
          ref={inputRef}
          id="desktop-search-input"
          type="text"
          placeholder="Search..."
          defaultValue={
            window.location.pathname === "/search"
              ? new URLSearchParams(window.location.search).get("q")
              : ""
          }
          style={{
            width: "200px",
            height: "32px",
            padding: "4px 4px 4px 32px",
            fontSize: "0.75rem",
            fontVariant: "small-caps",
            border: "var(--border-thin)",
          }}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
};

export default DesktopSearch;
