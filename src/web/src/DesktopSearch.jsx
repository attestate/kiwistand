import React, { useEffect, useState, useRef } from "react";
import { showSpinnerOverlay } from "./spinnerOverlay.js";
import MS from "./ms.jsx";

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
      // NOTE: The surrounding <form> would submit too.
      e.preventDefault();
      // Show spinner before navigation
      showSpinnerOverlay();
      window.location.href = "/search?q=" + encodeURIComponent(e.target.value);
    }
  };

  // NOTE: Renders into the server-rendered <form class="kn-search"> of the
  // top bar (views/components/header.mjs), with the same markup.
  return (
    <>
      {keyIndicator}
      <MS name="magnifying-glass" size={16} />
      <input
        ref={inputRef}
        id="desktop-search-input"
        type="search"
        name="q"
        placeholder="Search stories"
        aria-label="Search stories"
        autoComplete="off"
        defaultValue={
          window.location.pathname === "/search"
            ? new URLSearchParams(window.location.search).get("q")
            : ""
        }
        onKeyDown={handleKeyDown}
      />
      <kbd>{/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘S" : "Ctrl S"}</kbd>
    </>
  );
};

export default DesktopSearch;
