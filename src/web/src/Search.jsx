import { useState, useRef, useEffect } from "react";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import { ChatsSVG } from "./icons.jsx";
import { isIOS } from "./session.mjs";

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

  const performSearch = async (searchText) => {
    try {
      const response = await fetch("/api/v1/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchText }),
      });

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();
      if (data.status === "success" && data.data?.data) {
        setResults(data.data.data);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (value) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (value.trim()) {
      setIsLoading(true);
      debounceTimer.current = setTimeout(() => performSearch(value), 300);
    } else {
      setResults([]);
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

  if (!isMobile) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{
          padding: "5px",
          border: "none",
          background: "var(--background-color0)",
          cursor: "pointer",
          border: "var(--border)",
          color: "black", // Explicitly set color
          WebkitTapHighlightColor: "transparent",
          WebkitAppearance: "none", // Reset Safari's default appearance
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
            height: "75vh",
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
          <div style={{ marginBottom: "16px" }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                handleSearch(e.target.value);
              }}
              style={{
                width: "100%",
                padding: "8px",
                fontSize: "16px",
                border: "var(--border-thin)",
                borderRadius: "2px",
                backgroundColor: "white",
                fontFamily: "var(--font-family)",
                outline: "none",
              }}
              placeholder="Search all of Kiwi..."
            />
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
            }}
          >
            {isLoading ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "16px",
                  color: "var(--visited-link)",
                }}
              >
                Loading...
              </div>
            ) : results.length > 0 ? (
              results.map((result) => (
                <SearchResult key={result.index} result={result} />
              ))
            ) : query ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "16px",
                  color: "var(--visited-link)",
                }}
              >
                No results found
              </div>
            ) : null}
          </div>
        </div>
      </SwipeableDrawer>
    </>
  );
};

export default SearchInterface;
