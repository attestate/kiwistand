import { useState, useRef, useEffect } from "react";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import { ChatsSVG } from "./icons.jsx";
import { isIOS } from "./session.mjs";

// List of paths where the search component should be hidden
const HIDDEN_PATHS = [
  '/indexing',
  '/passkeys',
  '/demonstration',
  '/email-notifications',
  '/invite'
];

const UpvoteSVG = (props) => (
  <svg
    style={props.style}
    viewBox="0 0 200 200"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M99.84 52.0801L55.04 96.8001L68.44 110.04L90.36 88.0401L90.3747 148H109.8V88.0401L131.84 110.04L144.96 96.8001L100.24 52.0801H99.84Z" />
  </svg>
);

const SearchInterface = () => {
  const [isOpen, setIsOpen] = useState(false);
  window.drawerIsOpen = isOpen;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const inputRef = useRef(null);
  const debounceTimer = useRef(null);

  const iOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth >= 300 && window.innerWidth <= 640);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Check if current path is in the hidden paths list
  const shouldHideSearch = () => {
    const currentPath = window.location.pathname;
    return HIDDEN_PATHS.some(path => currentPath === path);
  };

  const handleSearch = (value) => {
    if (value.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(value.trim())}`;
    }
  };

  const SearchResult = ({ result }) => (
    <div
      style={{
        padding: "8px 0",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        {/* Title and stats row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px",
          }}
        >
          <a
            href={result.url}
            target={isIOS() ? "_self" : "_blank"}
            style={{
              fontSize: "13pt",
              lineHeight: "1.4",
              color: "inherit",
              textDecoration: "none",
              flex: 1,
            }}
          >
            {result.title}
          </a>

          {/* Stats as labels */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              fontSize: "9pt",
              color: "var(--visited-link)",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
              <UpvoteSVG style={{ width: "25px", fill: "rgba(0,0,0,0.75)" }} />
              {result.votes || 0}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
              <ChatsSVG style={{ width: "20px", color: "black" }} />
              {result.comments || 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  // Hide if not mobile or if on a path where search should be hidden
  if (!isMobile || shouldHideSearch()) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{
          padding: "5px",
          border: "none",
          borderRadius: "2px",
          cursor: "pointer",
          color: "black",
          WebkitTapHighlightColor: "transparent",
          WebkitAppearance: "none",
          appearance: "none",
          "-webkit-text-fill-color": "black",
        }}
        aria-label="Open search"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 256 256"
          style={{
            fill: "currentColor",
            width: "1.5rem",
          }}
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
      </button>

      <SwipeableDrawer
        anchor="bottom"
        open={isOpen}
        onClose={() => setIsOpen(false)}
        onOpen={() => setIsOpen(true)}
        disableBackdropTransition={!iOS}
        disableDiscovery={iOS}
        PaperProps={{
          style: {
            height: "20vh",
            borderTopLeftRadius: "2px",
            borderTopRightRadius: "2px",
            backgroundColor: "var(--background-color0)",
            fontFamily: "var(--font-family)",
          },
        }}
      >
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ padding: "16px 16px 0 16px" }}>
            <div style={{ 
              display: "flex",
              gap: "8px",
              alignItems: "center"
            }}>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch(e.target.value);
                  }
                }}
                style={{
                  flex: "0 0 70%",
                  padding: "8px",
                  fontSize: "16px",
                  border: "var(--border-thin)",
                  borderRadius: "2px",
                  backgroundColor: "white",
                  fontFamily: "var(--font-family)",
                  outline: "none",
                }}
                placeholder="Search..."
              />
              <button
                onClick={() => handleSearch(query)}
                style={{
                  flex: "1",
                  padding: "8px 12px",
                  background: "black",
                  color: "white",
                  border: "var(--border)",
                  borderRadius: "2px",
                  cursor: "pointer",
                  fontSize: "10pt",
                  fontFamily: "var(--font-family)",
                }}
              >
                Search
              </button>
            </div>
          </div>
        </div>
      </SwipeableDrawer>
    </>
  );
};

export default SearchInterface;
