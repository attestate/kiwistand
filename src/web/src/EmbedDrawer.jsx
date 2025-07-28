import { useState, useEffect, useRef } from "react";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";

const EmbedDrawer = ({ toast }) => {
  // Add spinner animation styles
  useEffect(() => {
    const styleId = 'embed-drawer-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes embed-drawer-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
    
    return () => {
      const style = document.getElementById(styleId);
      if (style) {
        style.remove();
      }
    };
  }, []);
  const [open, setOpen] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showFallbackButton, setShowFallbackButton] = useState(false);
  const iframeRef = useRef(null);
  
  const iOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

  // Keep track of domains that block iframes
  const blockedDomains = useRef(new Set());
  
  // Load blocked domains from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('kiwi-iframe-blocked-domains');
    if (stored) {
      try {
        const domains = JSON.parse(stored);
        domains.forEach(d => blockedDomains.current.add(d));
      } catch (e) {
        console.error('Failed to load blocked domains:', e);
      }
    }
  }, []);

  // Expose open/close methods globally
  useEffect(() => {
    window.openEmbedDrawer = (url) => {
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        
        // Check if this domain is known to block iframes
        if (blockedDomains.current.has(hostname)) {
          console.log(`Domain ${hostname} is known to block iframes, opening directly`);
          if (window.sdk && window.sdk.actions && window.sdk.actions.openUrl) {
            window.sdk.actions.openUrl(url);
          } else {
            window.open(url, '_blank');
          }
          return;
        }
      } catch (e) {
        console.error('Invalid URL:', e);
      }
      
      setCurrentUrl(url);
      setOpen(true);
      setIsLoading(true);
      setHasError(false);
      setShowFallbackButton(false);
    };

    window.closeEmbedDrawer = () => {
      setOpen(false);
      // Clean up iframe after closing
      setTimeout(() => {
        setCurrentUrl("");
        setIsLoading(true);
        setHasError(false);
      }, 300);
    };

    // Clean up on unmount
    return () => {
      delete window.openEmbedDrawer;
      delete window.closeEmbedDrawer;
    };
  }, []);

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setCurrentUrl("");
      setIsLoading(true);
      setHasError(false);
    }, 300);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(currentUrl).then(() => {
      toast.success("Link copied!");
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = currentUrl;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        toast.success("Link copied!");
      } catch (err) {
        toast.error("Failed to copy link");
      }
      document.body.removeChild(textArea);
    });
  };

  const getHostname = (url) => {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return "Invalid URL";
    }
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    
    // Check if iframe actually loaded content
    try {
      const iframe = iframeRef.current;
      if (iframe) {
        // Try to access the contentWindow - this will throw if blocked
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        
        // If we can't access the document, it's likely blocked
        if (!iframeDoc) {
          setHasError(true);
          return;
        }
        
        // Additional check: some sites load but show an error page
        const iframeBody = iframeDoc.body;
        if (iframeBody && (
          iframeBody.textContent?.includes('refused to connect') ||
          iframeBody.textContent?.includes('blocked by X-Frame-Options')
        )) {
          setHasError(true);
        }
      }
    } catch (e) {
      // Cross-origin access denied - this is EXPECTED for cross-origin iframes
      // Don't treat this as an error automatically
      console.log('Cross-origin iframe loaded (cannot access content)');
      
      // Show fallback button after a delay for sites that might not work properly
      setTimeout(() => {
        setShowFallbackButton(true);
      }, 2000);
    }
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
    
    // Only remember this domain as blocked when we get an actual error event
    try {
      const urlObj = new URL(currentUrl);
      const hostname = urlObj.hostname;
      blockedDomains.current.add(hostname);
      
      // Save to localStorage
      const domains = Array.from(blockedDomains.current);
      localStorage.setItem('kiwi-iframe-blocked-domains', JSON.stringify(domains));
    } catch (e) {
      console.error('Failed to save blocked domain:', e);
    }
  };

  return (
    <SwipeableDrawer
      anchor="right"
      open={open}
      onClose={handleClose}
      onOpen={() => setOpen(true)}
      disableBackdropTransition={!iOS}
      disableDiscovery={iOS}
      PaperProps={{
        style: {
          width: "100%",
          backgroundColor: "#f6f6ef",
          fontFamily: "var(--font-family)",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <div style={{ 
        display: "flex", 
        flexDirection: "column", 
        height: "100%",
        position: "relative" 
      }}>
        {/* Header */}
        <div style={{ 
          backgroundColor: "#f6f6ef",
          padding: "10px 15px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          borderBottom: "1px solid #ccc",
          minHeight: "44px"
        }}>
          {/* Back button */}
          <button
            onClick={handleClose}
            style={{
              background: "none",
              border: "none",
              display: "inline-flex",
              alignItems: "center",
              textDecoration: "none",
              color: "black",
              fontSize: "11pt",
              fontFamily: "Verdana, Geneva, sans-serif",
              padding: "5px",
              cursor: "pointer"
            }}
          >
            <svg 
              height="21px" 
              viewBox="0 0 13 21" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              fill="none" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              style={{ marginRight: "6px" }}
            >
              <polyline points="11.5 1.5 1.5 10.5 11.5 19.5" />
            </svg>
            <span>Back</span>
          </button>

          {/* URL bar */}
          <div style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            backgroundColor: "white",
            border: "1px solid #d0d0d0",
            borderRadius: "4px",
            padding: "0 12px",
            height: "32px",
            fontSize: "10pt",
            fontFamily: "Verdana, Geneva, sans-serif"
          }}>
            <button
              onClick={copyLink}
              style={{
                background: "none",
                border: "none",
                color: "#666",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
                padding: "4px 0",
                flex: 1,
                textAlign: "left"
              }}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 256 256" 
                width="14" 
                height="14" 
                style={{ opacity: 0.5, flexShrink: 0 }}
              >
                <rect width="256" height="256" fill="none"/>
                <circle cx="128" cy="128" r="96" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
                <line x1="128" y1="128" x2="168" y2="88" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
              </svg>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {getHostname(currentUrl)}
              </span>
            </button>
          </div>

          {/* Open button */}
          <button
            onClick={() => {
              if (window.sdk && window.sdk.actions && window.sdk.actions.openUrl) {
                window.sdk.actions.openUrl(currentUrl);
              } else {
                window.open(currentUrl, '_blank');
              }
            }}
            style={{
              background: "#afc046",
              border: "1px solid #98ad35",
              borderRadius: "4px",
              color: "black",
              fontSize: "10pt",
              fontFamily: "Verdana, Geneva, sans-serif",
              padding: "6px 16px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              height: "32px"
            }}
          >
            Open
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 256 256" 
              width="14" 
              height="14" 
              style={{ opacity: 0.7 }}
            >
              <rect width="256" height="256" fill="none"/>
              <polyline points="216 104 216 40 152 40" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
              <line x1="144" y1="112" x2="216" y2="40" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
              <path d="M184,144v64a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V80a8,8,0,0,1,8-8h64" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
            </svg>
          </button>
        </div>

        {/* Iframe container */}
        <div style={{ 
          flex: 1, 
          position: "relative",
          overflow: "hidden",
          backgroundColor: "white"
        }}>
          {/* Loading spinner */}
          {isLoading && (
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "40px",
              height: "40px",
              marginTop: "-20px",
              marginLeft: "-20px",
              zIndex: 1
            }}>
              <div style={{
                width: "100%",
                height: "100%",
                border: "4px solid #f3f3f3",
                borderTop: "4px solid #afc046",
                borderRadius: "50%",
                animation: "embed-drawer-spin 1s linear infinite"
              }} />
            </div>
          )}

          {/* Iframe */}
          {currentUrl && (
            <iframe
              ref={iframeRef}
              src={currentUrl}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                border: "none",
                backgroundColor: "white"
              }}
              sandbox="allow-scripts allow-same-origin"
              referrerPolicy="no-referrer"
              loading="lazy"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
            />
          )}

          {/* Fallback button for sites that load but might not work */}
          {showFallbackButton && !hasError && !isLoading && (
            <div style={{
              position: "absolute",
              bottom: "20px",
              right: "20px",
              zIndex: 10
            }}>
              <button
                onClick={() => {
                  if (window.sdk && window.sdk.actions && window.sdk.actions.openUrl) {
                    window.sdk.actions.openUrl(currentUrl);
                  } else {
                    window.open(currentUrl, '_blank');
                  }
                }}
                style={{
                  background: "rgba(175, 192, 70, 0.95)",
                  border: "1px solid #98ad35",
                  borderRadius: "4px",
                  color: "black",
                  fontSize: "12pt",
                  fontFamily: "Verdana, Geneva, sans-serif",
                  padding: "8px 16px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                }}
              >
                Not working? Open in browser
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 256 256" 
                  width="14" 
                  height="14" 
                  style={{ opacity: 0.7 }}
                >
                  <rect width="256" height="256" fill="none"/>
                  <polyline points="216 104 216 40 152 40" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
                  <line x1="144" y1="112" x2="216" y2="40" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
                  <path d="M184,144v64a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V80a8,8,0,0,1,8-8h64" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
                </svg>
              </button>
            </div>
          )}

          {/* Error message */}
          {hasError && !isLoading && (
            <div 
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "Verdana, Geneva, sans-serif",
                textAlign: "center"
              }}
            >
              <p style={{ 
                margin: "0 0 20px 0", 
                fontSize: "14px", 
                color: "#666"
              }}>
                Can't show this site here
              </p>
              <button
                onClick={() => {
                  if (window.sdk && window.sdk.actions && window.sdk.actions.openUrl) {
                    window.sdk.actions.openUrl(currentUrl);
                  } else {
                    window.open(currentUrl, '_blank');
                  }
                }}
                style={{
                  background: "#afc046",
                  border: "1px solid #98ad35",
                  borderRadius: "4px",
                  color: "black",
                  fontSize: "14pt",
                  fontFamily: "Verdana, Geneva, sans-serif",
                  padding: "12px 32px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  fontWeight: "500"
                }}
              >
                Open Site
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 256 256" 
                  width="16" 
                  height="16" 
                  style={{ opacity: 0.8 }}
                >
                  <rect width="256" height="256" fill="none"/>
                  <polyline points="216 104 216 40 152 40" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
                  <line x1="144" y1="112" x2="216" y2="40" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
                  <path d="M184,144v64a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V80a8,8,0,0,1,8-8h64" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

    </SwipeableDrawer>
  );
};

export default EmbedDrawer;